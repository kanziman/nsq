import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seedEpisode } from './seed-episode';
import type { Segment, ImportState } from '@/lib/types';

const tmpDirs: string[] = [];
async function makeBaseDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'seed-test-'));
  tmpDirs.push(dir);
  return dir;
}
async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, 'utf-8')) as T;
}

afterEach(async () => {
  while (tmpDirs.length) {
    await fs.rm(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe('seedEpisode', () => {
  it('[정상] should create meta/import-state/segments/audio under baseDir/id', async () => {
    const baseDir = await makeBaseDir();
    const { id, dir } = await seedEpisode({ baseDir });
    expect(dir).toBe(path.join(baseDir, id));
    for (const f of [
      'meta.json',
      'import-state.json',
      'segments.json',
      'audio.mp3',
    ]) {
      await expect(fs.access(path.join(dir, f))).resolves.toBeUndefined();
    }
  });

  it('[정상] should generate segmentCount segments with valid speaker keys', async () => {
    const baseDir = await makeBaseDir();
    const { dir } = await seedEpisode({ baseDir, segmentCount: 4 });
    const segments = await readJson<Segment[]>(path.join(dir, 'segments.json'));
    expect(segments).toHaveLength(4);
    const valid = new Set(['DUCKWORTH', 'DUBNER', 'BOTH', 'NARRATOR']);
    for (const s of segments) {
      expect(valid.has(s.speaker)).toBe(true);
      expect(typeof s.start).toBe('number');
      expect(typeof s.end).toBe('number');
      expect(typeof s.text).toBe('string');
    }
  });

  it('[경계] should use defaults when options omitted', async () => {
    const baseDir = await makeBaseDir();
    const { id, dir } = await seedEpisode({ baseDir });
    expect(id).toBe('mock-episode');
    const segments = await readJson<Segment[]>(path.join(dir, 'segments.json'));
    expect(segments).toHaveLength(10);
    const state = await readJson<ImportState>(
      path.join(dir, 'import-state.json'),
    );
    expect(state.status).toBe('completed');
  });

  it('[정상] should write import-state with the given status', async () => {
    const baseDir = await makeBaseDir();
    const { dir } = await seedEpisode({ baseDir, status: 'failed' });
    const state = await readJson<ImportState>(
      path.join(dir, 'import-state.json'),
    );
    expect(state.status).toBe('failed');
  });
});
