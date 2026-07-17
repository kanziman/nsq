import fs from 'fs/promises';
import path from 'path';
import { Episode, Segment, ImportState, LanguageCode } from '../types';
import { parseVtt } from '../utils/vtt-parser';
import { computeWordStartsAligned, splitWords } from '../utils/words';
import { tokenizeJa } from '../utils/tokenize';

// 조회(read)와 임포트 쓰기(write)의 소스를 분리한다(#160, R2 하이브리드 배포).
// 조회는 git 추적 정적 자산 public/episodes를 읽어 Vercel outputFileTracing 문제를
// 피한다. 임포트 쓰기는 로컬 작업본 .shadowing에 남고, publish(S4)가 public으로 복사한다.
const READ_BASE = path.join(process.cwd(), 'public', 'episodes');
// DELETE 라우트 등 로컬 작업본을 대상으로 하는 소비자가 존재확인에 사용하도록 export한다(#162).
export const WRITE_BASE = path.join(process.cwd(), '.shadowing', 'episodes');

// 디렉토리가 존재하는지 확인하고, 없으면 생성하는 헬퍼
async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// 파일이 존재하는지 확인하는 헬퍼
async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// JSON 파일을 안전하게 읽어오는 헬퍼
async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

// videoId의 import-state.json 경로를 반환하는 헬퍼 (임포트 쓰기 소스)
function importStatePath(videoId: string): string {
  return path.join(WRITE_BASE, videoId, 'import-state.json');
}

/**
 * 로컬에 임포트된 모든 에피소드 목록을 반환합니다.
 */
export async function getEpisodes(
  baseDir: string = READ_BASE,
): Promise<Episode[]> {
  try {
    await ensureDir(baseDir);
    const dirs = await fs.readdir(baseDir, { withFileTypes: true });
    const episodes: Episode[] = [];

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const episodeId = dir.name;
        const episode = await getEpisodeById(episodeId, baseDir);
        if (episode) {
          episodes.push(episode);
        }
      }
    }

    // 추가된 날짜 기준 최신순 정렬
    return episodes.sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    );
  } catch (error) {
    console.error('Failed to get episodes:', error);
    return [];
  }
}

/**
 * ID(유튜브 비디오 ID)로 에피소드를 조회합니다.
 */
export async function getEpisodeById(
  id: string,
  baseDir: string = READ_BASE,
): Promise<Episode | null> {
  const episodeDir = path.join(baseDir, id);
  const metaPath = path.join(episodeDir, 'meta.json');
  const statePath = path.join(episodeDir, 'import-state.json');

  if (!(await exists(episodeDir))) {
    return null;
  }

  const meta = await readJson<any>(metaPath);
  const importState = await readJson<ImportState>(statePath);

  // meta.json이 존재하지 않지만 임포트 상태가 있는 경우.
  // 완료된 임포트는 '(임포트 중)'을 붙이지 않는다(완료 후 meta 미기록 시에도 상태를 정확히 반영).
  if (!meta) {
    if (importState) {
      const inProgress = importState.status !== 'completed';
      return {
        id,
        title: inProgress ? `Episode: ${id} (임포트 중)` : `Episode: ${id}`,
        duration: 0,
        youtubeUrl: `https://youtube.com/watch?v=${id}`,
        addedAt: importState.updatedAt || new Date().toISOString(),
        importState,
      };
    }
    return null;
  }

  return {
    ...meta,
    importState: importState || undefined,
  };
}

/**
 * 에피소드에 해당하는 정합 완료된 세그먼트 배열을 조회합니다.
 */
export async function getEpisodeSegments(
  id: string,
  baseDir: string = READ_BASE,
): Promise<Segment[]> {
  const segmentsPath = path.join(baseDir, id, 'segments.json');
  const segments = await readJson<Segment[]>(segmentsPath);
  if (!segments) return [];

  // subtitle.{language}.vtt가 있으면 단어별 실제 발화 시각(wordStarts)을 부착한다
  // (표시가 아닌 강조 타이밍 전용). 부재/파싱 실패/구간 토큰 없음 시 부착하지 않고
  // 균등분할 폴백에 맡긴다. 언어는 meta.language(부재 시 'en')로 결정한다.
  try {
    const meta = await readJson<{ language?: LanguageCode }>(
      path.join(baseDir, id, 'meta.json'),
    );
    const language: LanguageCode = meta?.language ?? 'en';
    const vttPath = path.join(baseDir, id, `subtitle.${language}.vtt`);
    if (await exists(vttPath)) {
      const vtt = await fs.readFile(vttPath, 'utf-8');
      const tokens = parseVtt(vtt);
      return segments.map((seg) => {
        const winTokens = tokens.filter(
          (t) => t.start >= seg.start && t.start < seg.end,
        );
        if (winTokens.length === 0) return seg;
        // 대본 단어 표면형. ja는 공백이 없어 Intl.Segmenter 단어 토큰 기준(SegmentText
        // ja 렌더 서수 수와 일치). 표면형을 넘겨 VTT 토큰과 앵커 정렬한다(#139).
        const officialWords =
          language === 'ja'
            ? tokenizeJa(seg.text)
                .filter((t) => t.isWord)
                .map((t) => t.text)
            : splitWords(seg.text);
        if (officialWords.length === 0) return seg;
        return {
          ...seg,
          wordStarts: computeWordStartsAligned(
            officialWords,
            seg.start,
            seg.end,
            winTokens,
          ),
          // 실제 첫 발화 단어 시각 — 직접 클릭 탐색이 경계 대신 이 지점으로 향한다.
          audioStart: winTokens[0].start,
        };
      });
    }
  } catch (error) {
    console.error('Failed to attach VTT word timings:', error);
  }
  return segments;
}

/**
 * videoId의 현재 import-state.json을 읽는다. 없거나 손상 시 null. (readJson 재사용)
 */
export async function getImportState(
  videoId: string,
): Promise<ImportState | null> {
  return readJson<ImportState>(importStatePath(videoId));
}

/**
 * import-state.json을 기록한다 (디렉토리 없으면 생성).
 */
export async function saveImportState(
  videoId: string,
  state: ImportState,
): Promise<void> {
  await ensureDir(path.join(WRITE_BASE, videoId));
  await fs.writeFile(
    importStatePath(videoId),
    JSON.stringify(state, null, 2),
    'utf-8',
  );
}

/**
 * 에피소드 저장소 디렉토리를 완전히 삭제합니다.
 */
export async function deleteEpisode(id: string): Promise<void> {
  const episodeDir = path.join(WRITE_BASE, id);
  if (await exists(episodeDir)) {
    await fs.rm(episodeDir, { recursive: true, force: true });
  }
}
