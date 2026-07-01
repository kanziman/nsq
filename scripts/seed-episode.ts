import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ImportState, Segment, EpisodeMeta } from '@/lib/types';

export interface SeedEpisodeOptions {
  id?: string;
  segmentCount?: number;
  status?: ImportState['status'];
  baseDir?: string;
}

const SPEAKERS: Segment['speaker'][] = [
  'DUCKWORTH',
  'DUBNER',
  'BOTH',
  'NARRATOR',
];

/**
 * 개발/테스트용 mock 에피소드를 baseDir/id 아래에 시딩한다.
 * meta.json / import-state.json / segments.json / audio.mp3(stub) 생성.
 */
export async function seedEpisode(
  options?: SeedEpisodeOptions,
): Promise<{ id: string; dir: string }> {
  const id = options?.id ?? 'mock-episode';
  const segmentCount = options?.segmentCount ?? 10;
  const status = options?.status ?? 'completed';
  const baseDir =
    options?.baseDir ?? path.join(process.cwd(), '.shadowing', 'episodes');
  const dir = path.join(baseDir, id);

  await fs.mkdir(dir, { recursive: true });

  const segments: Segment[] = Array.from({ length: segmentCount }, (_, i) => ({
    id: `seg-${i + 1}`,
    start: i * 3,
    end: i * 3 + 3,
    speaker: SPEAKERS[i % SPEAKERS.length],
    text: `Sample shadowing sentence number ${i + 1}.`,
    translation: `샘플 쉐도잉 문장 ${i + 1}.`,
  }));

  const meta: EpisodeMeta = {
    id,
    title: `Mock Episode (${id})`,
    duration: segmentCount * 3,
    youtubeUrl: `https://youtube.com/watch?v=${id}`,
    addedAt: new Date().toISOString(),
  };

  const state: ImportState = {
    videoId: id,
    status,
    progress: status === 'completed' ? 100 : 0,
    currentStep: status,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(dir, 'meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8',
  );
  await fs.writeFile(
    path.join(dir, 'import-state.json'),
    JSON.stringify(state, null, 2),
    'utf-8',
  );
  await fs.writeFile(
    path.join(dir, 'segments.json'),
    JSON.stringify(segments, null, 2),
    'utf-8',
  );
  await fs.writeFile(path.join(dir, 'audio.mp3'), Buffer.from(''));

  return { id, dir };
}

// CLI: npx tsx scripts/seed-episode.ts
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seedEpisode()
    .then(({ dir }) => console.log(`Seeded mock episode at: ${dir}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
