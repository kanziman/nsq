import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getImportState, saveImportState } from './episodes';
import type { ImportState } from '../types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const TEST_VIDEO_ID = 'test-episodes-vid';

function episodeDir(id: string): string {
  return path.join(BASE, id);
}
function statePath(id: string): string {
  return path.join(episodeDir(id), 'import-state.json');
}

function makeState(): ImportState {
  return {
    videoId: TEST_VIDEO_ID,
    status: 'downloading',
    progress: 10,
    currentStep: 'download',
    updatedAt: new Date().toISOString(),
  };
}

afterEach(async () => {
  await fs.rm(episodeDir(TEST_VIDEO_ID), { recursive: true, force: true });
});

describe('saveImportState', () => {
  it('should write import-state.json and create the directory when it does not exist', async () => {
    const state = makeState();

    await saveImportState(TEST_VIDEO_ID, state);

    const raw = await fs.readFile(statePath(TEST_VIDEO_ID), 'utf-8');
    expect(JSON.parse(raw)).toEqual(state);
  });
});

describe('getImportState', () => {
  it('should return the persisted ImportState when import-state.json exists', async () => {
    const state = makeState();
    await fs.mkdir(episodeDir(TEST_VIDEO_ID), { recursive: true });
    await fs.writeFile(statePath(TEST_VIDEO_ID), JSON.stringify(state));

    const result = await getImportState(TEST_VIDEO_ID);

    expect(result).toEqual(state);
  });

  it('should return null when import-state.json does not exist', async () => {
    const result = await getImportState(TEST_VIDEO_ID);

    expect(result).toBeNull();
  });

  it('should return null when import-state.json is corrupt/invalid JSON', async () => {
    await fs.mkdir(episodeDir(TEST_VIDEO_ID), { recursive: true });
    await fs.writeFile(statePath(TEST_VIDEO_ID), '{ not valid json');

    const result = await getImportState(TEST_VIDEO_ID);

    expect(result).toBeNull();
  });
});
