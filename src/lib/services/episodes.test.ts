import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  getImportState,
  saveImportState,
  getEpisodeSegments,
} from './episodes';
import type { ImportState, Segment } from '../types';

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

describe('getEpisodeSegments (VTT 단어 매핑)', () => {
  const SEGMENTS: Segment[] = [
    { id: 's1', start: 0, end: 3, speaker: 'DUCKWORTH', text: 'hello there' },
  ];

  async function writeSegments(): Promise<void> {
    await fs.mkdir(episodeDir(TEST_VIDEO_ID), { recursive: true });
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'segments.json'),
      JSON.stringify(SEGMENTS),
    );
  }

  it('[경계] should return raw segments (no words) when no VTT file exists (AC2)', async () => {
    await writeSegments();
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].words).toBeUndefined();
    expect(result[0].text).toBe('hello there');
  });

  it('[예외] should fall back to raw segments when subtitle.en.vtt is malformed (AC2)', async () => {
    await writeSegments();
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'NOT VALID VTT CONTENT @@@@',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].words).toBeUndefined();
    expect(result[0].text).toBe('hello there');
  });

  it('[정상] should map VTT words into segments when subtitle.en.vtt exists (AC1)', async () => {
    await writeSegments();
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].words?.length).toBeGreaterThan(0);
  });
});
