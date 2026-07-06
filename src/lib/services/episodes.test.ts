import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  getImportState,
  saveImportState,
  getEpisodeById,
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

describe('getEpisodeById (meta.json 부재 폴백)', () => {
  async function writeState(status: ImportState['status']): Promise<void> {
    await fs.mkdir(episodeDir(TEST_VIDEO_ID), { recursive: true });
    await fs.writeFile(
      statePath(TEST_VIDEO_ID),
      JSON.stringify({
        videoId: TEST_VIDEO_ID,
        status,
        progress: status === 'completed' ? 100 : 50,
        currentStep: status,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  it("[정상] meta 부재 + status 'completed'이면 제목에 '(임포트 중)'을 붙이지 않는다", async () => {
    await writeState('completed');
    const ep = await getEpisodeById(TEST_VIDEO_ID);
    expect(ep).not.toBeNull();
    expect(ep!.title).not.toContain('임포트 중');
  });

  it("[정상] meta 부재 + 진행 중 status이면 '(임포트 중)'을 표시한다", async () => {
    await writeState('aligning');
    const ep = await getEpisodeById(TEST_VIDEO_ID);
    expect(ep!.title).toContain('임포트 중');
  });

  it('[정상] meta.json 존재 시 실제 제목·재생시간을 사용한다 (AC1/AC2 #74)', async () => {
    await fs.mkdir(episodeDir(TEST_VIDEO_ID), { recursive: true });
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'meta.json'),
      JSON.stringify({
        id: TEST_VIDEO_ID,
        title: 'What Is the Optimal Way to Be Angry?',
        duration: 2078,
        youtubeUrl: 'https://youtu.be/x',
        addedAt: new Date().toISOString(),
      }),
    );
    await writeState('completed');
    const ep = await getEpisodeById(TEST_VIDEO_ID);
    expect(ep!.title).toBe('What Is the Optimal Way to Be Angry?');
    expect(ep!.duration).toBe(2078);
  });
});

describe('getEpisodeSegments', () => {
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

  it('[정상] should return the stored official-text segments as-is', async () => {
    await writeSegments();
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('hello there');
  });

  it('[경계] should return [] when segments.json does not exist', async () => {
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result).toEqual([]);
  });

  it('[정상] should attach wordStarts from VTT tokens within each segment window (AC1)', async () => {
    await writeSegments();
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].wordStarts).toHaveLength(2);
    // 첫 단어는 세그먼트 시작(0) 근처의 첫 토큰 시각에서 시작한다.
    expect(result[0].wordStarts![0]).toBeGreaterThanOrEqual(0);
    expect(result[0].wordStarts![1]).toBeGreaterThan(result[0].wordStarts![0]);
    expect(result[0].text).toBe('hello there'); // AC3: 텍스트는 공식 대본 그대로
  });

  it('[경계] should not attach wordStarts when subtitle.en.vtt is missing (AC2)', async () => {
    await writeSegments();
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].wordStarts).toBeUndefined();
  });

  it('[예외] should fall back (no wordStarts) when subtitle.en.vtt is malformed (AC2)', async () => {
    await writeSegments();
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'NOT VALID VTT CONTENT @@@@',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].wordStarts).toBeUndefined();
  });

  it('[정상] should attach audioStart = first VTT token time in the segment window (AC1)', async () => {
    await writeSegments(); // s1: start 0, end 3, text "hello there"
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      // 큐가 0.5초에 시작 → 실제 첫 단어는 세그먼트 시작(0)보다 늦다.
      'WEBVTT\n\n00:00.500 --> 00:03.000\nhello there\n',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].audioStart).toBeCloseTo(0.5);
  });

  it('[경계] should not attach audioStart when the segment window has no VTT tokens (AC1)', async () => {
    const twoSegs: Segment[] = [
      { id: 's1', start: 0, end: 3, speaker: 'DUCKWORTH', text: 'hello there' },
      { id: 's2', start: 10, end: 13, speaker: 'DUBNER', text: 'goodbye now' },
    ];
    await fs.mkdir(episodeDir(TEST_VIDEO_ID), { recursive: true });
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'segments.json'),
      JSON.stringify(twoSegs),
    );
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[1].audioStart).toBeUndefined();
  });

  it('[경계] should attach wordStarts only to segments whose window has VTT tokens (AC2)', async () => {
    // VTT는 존재하지만 s2 구간(10~13s)엔 겹치는 토큰이 없다 → s1만 부착.
    const twoSegs: Segment[] = [
      { id: 's1', start: 0, end: 3, speaker: 'DUCKWORTH', text: 'hello there' },
      { id: 's2', start: 10, end: 13, speaker: 'DUBNER', text: 'goodbye now' },
    ];
    await fs.mkdir(episodeDir(TEST_VIDEO_ID), { recursive: true });
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'segments.json'),
      JSON.stringify(twoSegs),
    );
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID);
    expect(result[0].wordStarts).toHaveLength(2);
    expect(result[1].wordStarts).toBeUndefined();
  });
});
