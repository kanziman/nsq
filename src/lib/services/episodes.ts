import fs from 'fs/promises';
import path from 'path';
import { Episode, Segment, ImportState } from '../types';
import { parseVtt } from './import/vtt/parse';
import { computeWordStarts, splitWords } from '../utils/words';

const BASE_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

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

// videoId의 import-state.json 경로를 반환하는 헬퍼
function importStatePath(videoId: string): string {
  return path.join(BASE_DIR, videoId, 'import-state.json');
}

/**
 * 로컬에 임포트된 모든 에피소드 목록을 반환합니다.
 */
export async function getEpisodes(): Promise<Episode[]> {
  try {
    await ensureDir(BASE_DIR);
    const dirs = await fs.readdir(BASE_DIR, { withFileTypes: true });
    const episodes: Episode[] = [];

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const episodeId = dir.name;
        const episode = await getEpisodeById(episodeId);
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
export async function getEpisodeById(id: string): Promise<Episode | null> {
  const episodeDir = path.join(BASE_DIR, id);
  const metaPath = path.join(episodeDir, 'meta.json');
  const statePath = importStatePath(id);

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
export async function getEpisodeSegments(id: string): Promise<Segment[]> {
  const segmentsPath = path.join(BASE_DIR, id, 'segments.json');
  const segments = await readJson<Segment[]>(segmentsPath);
  if (!segments) return [];

  // subtitle.en.vtt가 있으면 단어별 실제 발화 시각(wordStarts)을 부착한다(표시가 아닌 강조 타이밍 전용).
  // 부재/파싱 실패/구간 토큰 없음 시 부착하지 않고 균등분할 폴백에 맡긴다.
  try {
    const vttPath = path.join(BASE_DIR, id, 'subtitle.en.vtt');
    if (await exists(vttPath)) {
      const vtt = await fs.readFile(vttPath, 'utf-8');
      const tokens = parseVtt(vtt);
      return segments.map((seg) => {
        const times = tokens
          .filter((t) => t.start >= seg.start && t.start < seg.end)
          .map((t) => t.start);
        if (times.length === 0) return seg;
        const wordCount = splitWords(seg.text).length;
        return {
          ...seg,
          wordStarts: computeWordStarts(wordCount, seg.start, seg.end, times),
          // 실제 첫 발화 단어 시각 — 직접 클릭 탐색이 경계 대신 이 지점으로 향한다.
          audioStart: times[0],
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
  await ensureDir(path.join(BASE_DIR, videoId));
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
  const episodeDir = path.join(BASE_DIR, id);
  if (await exists(episodeDir)) {
    await fs.rm(episodeDir, { recursive: true, force: true });
  }
}
