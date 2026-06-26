import fs from 'fs/promises';
import path from 'path';
import { Episode, Segment, ImportState } from '../types';

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

  // meta.json이 존재하지 않지만 임포트 상태가 있는 경우 (임포트 진행 중)
  if (!meta) {
    if (importState) {
      return {
        id,
        title: `Episode: ${id} (임포트 중)`,
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
  return segments || [];
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
