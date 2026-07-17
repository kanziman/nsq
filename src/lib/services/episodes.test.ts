import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'os';
import path from 'path';
import {
  getImportState,
  saveImportState,
  getEpisodes,
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
    const ep = await getEpisodeById(TEST_VIDEO_ID, BASE);
    expect(ep).not.toBeNull();
    expect(ep!.title).not.toContain('임포트 중');
  });

  it("[정상] meta 부재 + 진행 중 status이면 '(임포트 중)'을 표시한다", async () => {
    await writeState('aligning');
    const ep = await getEpisodeById(TEST_VIDEO_ID, BASE);
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
    const ep = await getEpisodeById(TEST_VIDEO_ID, BASE);
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
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('hello there');
  });

  it('[경계] should return [] when segments.json does not exist', async () => {
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
    expect(result).toEqual([]);
  });

  it('[정상] should attach wordStarts from VTT tokens within each segment window (AC1)', async () => {
    await writeSegments();
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
    expect(result[0].wordStarts).toHaveLength(2);
    // 첫 단어는 세그먼트 시작(0) 근처의 첫 토큰 시각에서 시작한다.
    expect(result[0].wordStarts![0]).toBeGreaterThanOrEqual(0);
    expect(result[0].wordStarts![1]).toBeGreaterThan(result[0].wordStarts![0]);
    expect(result[0].text).toBe('hello there'); // AC3: 텍스트는 공식 대본 그대로
  });

  it('[경계] should not attach wordStarts when subtitle.en.vtt is missing (AC2)', async () => {
    await writeSegments();
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
    expect(result[0].wordStarts).toBeUndefined();
  });

  it('[예외] should fall back (no wordStarts) when subtitle.en.vtt is malformed (AC2)', async () => {
    await writeSegments();
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      'NOT VALID VTT CONTENT @@@@',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
    expect(result[0].wordStarts).toBeUndefined();
  });

  it('[정상] should attach audioStart = first VTT token time in the segment window (AC1)', async () => {
    await writeSegments(); // s1: start 0, end 3, text "hello there"
    await fs.writeFile(
      path.join(episodeDir(TEST_VIDEO_ID), 'subtitle.en.vtt'),
      // 큐가 0.5초에 시작 → 실제 첫 단어는 세그먼트 시작(0)보다 늦다.
      'WEBVTT\n\n00:00.500 --> 00:03.000\nhello there\n',
    );
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
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
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
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
    const result = await getEpisodeSegments(TEST_VIDEO_ID, BASE);
    expect(result[0].wordStarts).toHaveLength(2);
    expect(result[1].wordStarts).toBeUndefined();
  });
});

// S2(#160): 조회 함수가 주입된 baseDir(= public/episodes)에서 읽는다.
describe('조회 함수 baseDir 주입 (#160)', () => {
  let fixture: string;

  beforeEach(async () => {
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'ep-fixture-'));
  });
  afterEach(async () => {
    await fs.rm(fixture, { recursive: true, force: true });
  });

  async function writeEpisode(
    id: string,
    meta: Record<string, unknown>,
    segments?: Segment[],
    vtt?: string,
  ): Promise<void> {
    const dir = path.join(fixture, id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta));
    if (segments) {
      await fs.writeFile(
        path.join(dir, 'segments.json'),
        JSON.stringify(segments),
      );
    }
    if (vtt) {
      await fs.writeFile(path.join(dir, 'subtitle.en.vtt'), vtt);
    }
  }

  it('should return episode from meta.json in given baseDir', async () => {
    await writeEpisode('vid1', {
      id: 'vid1',
      title: 'T1',
      duration: 100,
      addedAt: '2026-01-01T00:00:00Z',
    });
    const ep = await getEpisodeById('vid1', fixture);
    expect(ep?.title).toBe('T1');
  });

  it('should return episodes from given baseDir sorted by addedAt desc', async () => {
    await writeEpisode('old', {
      id: 'old',
      title: 'Old',
      duration: 1,
      addedAt: '2026-01-01T00:00:00Z',
    });
    await writeEpisode('new', {
      id: 'new',
      title: 'New',
      duration: 1,
      addedAt: '2026-06-01T00:00:00Z',
    });
    const eps = await getEpisodes(fixture);
    expect(eps.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('should return segments from segments.json in given baseDir', async () => {
    await writeEpisode(
      'vid2',
      { id: 'vid2', title: 'T', duration: 1, addedAt: '2026-01-01' },
      [{ id: 's1', start: 0, end: 3, speaker: 'A', text: 'hi' }],
    );
    const segs = await getEpisodeSegments('vid2', fixture);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe('hi');
  });

  it('should attach wordStarts when subtitle vtt present in baseDir', async () => {
    await writeEpisode(
      'vid4',
      { id: 'vid4', title: 'T', duration: 1, addedAt: '2026-01-01' },
      [{ id: 's1', start: 0, end: 3, speaker: 'A', text: 'hello there' }],
      'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    );
    const segs = await getEpisodeSegments('vid4', fixture);
    expect(segs[0].wordStarts).toHaveLength(2);
  });

  it('should return empty array when baseDir has no episode dirs', async () => {
    expect(await getEpisodes(fixture)).toEqual([]);
  });

  it('should return null when episode dir absent in baseDir', async () => {
    expect(await getEpisodeById('nope', fixture)).toBeNull();
  });

  it('should return empty array when segments.json absent', async () => {
    await fs.mkdir(path.join(fixture, 'vid3'), { recursive: true });
    expect(await getEpisodeSegments('vid3', fixture)).toEqual([]);
  });

  it('should return empty array when baseDir does not exist', async () => {
    expect(await getEpisodes(path.join(fixture, 'missing'))).toEqual([]);
  });
});

// S2(#160) AC1 — 조회 함수의 기본 소스가 public/episodes여야 한다(.shadowing 아님).
describe('조회 기본 소스 = public/episodes (#160 AC1)', () => {
  const PUBLIC_BASE = path.join(process.cwd(), 'public', 'episodes');
  const SHADOW_BASE = path.join(process.cwd(), '.shadowing', 'episodes');
  const PUB_ID = 'ac1-public-fixture';
  const SHADOW_ID = 'ac1-shadow-fixture';

  afterEach(async () => {
    await fs.rm(path.join(PUBLIC_BASE, PUB_ID), {
      recursive: true,
      force: true,
    });
    await fs.rm(path.join(SHADOW_BASE, SHADOW_ID), {
      recursive: true,
      force: true,
    });
  });

  it('should read from public/episodes when called without baseDir', async () => {
    await fs.mkdir(path.join(PUBLIC_BASE, PUB_ID), { recursive: true });
    await fs.writeFile(
      path.join(PUBLIC_BASE, PUB_ID, 'meta.json'),
      JSON.stringify({
        id: PUB_ID,
        title: 'PublicTitle',
        duration: 1,
        addedAt: '2026-01-01',
      }),
    );
    const ep = await getEpisodeById(PUB_ID);
    expect(ep?.title).toBe('PublicTitle');
  });

  it('should NOT read from .shadowing by default (only public)', async () => {
    await fs.mkdir(path.join(SHADOW_BASE, SHADOW_ID), { recursive: true });
    await fs.writeFile(
      path.join(SHADOW_BASE, SHADOW_ID, 'meta.json'),
      JSON.stringify({
        id: SHADOW_ID,
        title: 'ShadowTitle',
        duration: 1,
        addedAt: '2026-01-01',
      }),
    );
    // 기본 소스는 public이므로 .shadowing에만 있는 에피소드는 조회되지 않는다.
    expect(await getEpisodeById(SHADOW_ID)).toBeNull();
  });
});

// S2(#160) AC4 — 조회용 API 라우트가 제거되어 존재하지 않아야 한다.
describe('조회 API 라우트 제거 (#160 AC4)', () => {
  it('should not have a GET /api/episodes route file', () => {
    const p = fileURLToPath(
      new URL('../../app/api/episodes/route.ts', import.meta.url),
    );
    expect(existsSync(p)).toBe(false);
  });

  it('should not have a /api/episodes/[id]/segments route file', () => {
    const p = fileURLToPath(
      new URL('../../app/api/episodes/[id]/segments/route.ts', import.meta.url),
    );
    expect(existsSync(p)).toBe(false);
  });
});
