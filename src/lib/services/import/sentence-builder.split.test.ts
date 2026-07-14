/**
 * #147: 과병합 완화 — 그룹을 완결 문장(。！？) 단위로 분할.
 *  - AC1: 세그먼트당 완결 문장 1개.
 *  - AC2: 분할 시각을 글자수 비례로 재분배(양끝 보존, 단조).
 *  - AC3: speaker 계승 + sent-N 연속.
 *  - AC4: 짧은 완결 문장도 독립 유지(최소길이 병합 없음).
 *  - AC5: 병합이 화자 경계를 넘지 않음.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type { Segment } from '@/lib/types';
import { buildSentences, type SentenceBuilder } from './sentence-builder';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-sb-split-vid';

function cue(i: number, text: string, speaker = 'SPEAKER'): Segment {
  return { id: `cue-${i + 1}`, start: i * 2, end: i * 2 + 2, speaker, text };
}

async function writeSegments(segments: Segment[]): Promise<void> {
  await fs.mkdir(path.join(BASE, VID), { recursive: true });
  await fs.writeFile(
    path.join(BASE, VID, 'segments.json'),
    JSON.stringify(segments, null, 2),
    'utf-8',
  );
}

async function readSegments(): Promise<Segment[]> {
  const raw = await fs.readFile(path.join(BASE, VID, 'segments.json'), 'utf-8');
  return JSON.parse(raw) as Segment[];
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('buildSentences (#147 sentence-level split)', () => {
  // AC1: 여러 완결 문장을 담은 그룹은 문장별 세그먼트로 분리된다.
  it('should emit one segment per complete sentence when a group merges multiple sentences', async () => {
    const cues = [cue(0, 'x'), cue(1, 'y'), cue(2, 'z')];
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: '文A。文B。文C。', cueCount: 3 },
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out.map((s) => s.text)).toEqual(['文A。', '文B。', '文C。']);
  });

  // AC2: 분할 시각은 글자수 비례로 재분배, 첫.start=그룹.start, 마지막.end=그룹.end, 단조.
  it('should redistribute the group span across split sentences preserving endpoints and monotonicity', async () => {
    const cues = [cue(0, 'x'), cue(1, 'y'), cue(2, 'z')]; // 그룹 [0, 6]
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: 'AA。B。CCC。', cueCount: 3 },
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out).toHaveLength(3);
    expect(out[0].start).toBe(0);
    expect(out[out.length - 1].end).toBe(6);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].start);
    }
  });

  // AC3: 분할 세그먼트는 speaker 계승 + sent-N 연속 재번호.
  it('should inherit speaker and assign sequential sent-N to split segments', async () => {
    const cues = [cue(0, 'x'), cue(1, 'y'), cue(2, 'z')];
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: '文A。文B。文C。', cueCount: 3 },
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out.map((s) => s.id)).toEqual(['sent-1', 'sent-2', 'sent-3']);
    expect(out.every((s) => s.speaker === 'SPEAKER')).toBe(true);
  });

  // AC4: 짧은 완결 문장도 인접에 흡수하지 않고 독립 세그먼트로 둔다.
  it('should keep a short complete sentence as its own segment without min-length coalescing', async () => {
    const cues = [cue(0, 'x'), cue(1, 'y')];
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: 'はい。皆さんこんにちは。', cueCount: 2 },
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out.map((s) => s.text)).toEqual(['はい。', '皆さんこんにちは。']);
  });

  // AC5: 병합이 서로 다른 speaker의 큐를 가로질러 묶이지 않는다.
  it('should not merge cues across a speaker change into one batch/segment', async () => {
    const cues = [cue(0, 'a', 'A'), cue(1, 'b', 'A'), cue(2, 'c', 'B')];
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async (batch) => [
      {
        text: batch.map((c: Segment) => c.text).join('') + '。',
        cueCount: batch.length,
      },
    ]);

    await buildSentences(VID, { builder });

    const calls = (builder as unknown as { mock: { calls: Segment[][][] } })
      .mock.calls;
    expect(
      calls.every((c) => new Set(c[0].map((x) => x.speaker)).size === 1),
    ).toBe(true);
  });

  // AC2 강화: 균등분할이 아니라 글자수 비례여야 한다(부호 포함 3/2/4 → 경계 2, 10/3).
  it('should place split boundaries proportional to sentence char length, not evenly', async () => {
    const cues = [cue(0, 'x'), cue(1, 'y'), cue(2, 'z')]; // 그룹 [0, 6]
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: 'AA。B。CCC。', cueCount: 3 }, // 길이 3,2,4 (합 9)
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out[0].end).toBeCloseTo(2, 5); // 6*3/9
    expect(out[1].start).toBeCloseTo(2, 5);
    expect(out[1].end).toBeCloseTo(10 / 3, 5); // 6*5/9
    expect(out[2].start).toBeCloseTo(10 / 3, 5);
  });

  // AC1 경계: 마지막 문장이 종결부호로 안 끝나도 조각으로 유지하고 end=그룹.end.
  it('should keep an unterminated trailing clause as its own piece ending at group end', async () => {
    const cues = [cue(0, 'x'), cue(1, 'y')]; // 그룹 [0, 4]
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: '文A。文B', cueCount: 2 },
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out.map((s) => s.text)).toEqual(['文A。', '文B']);
    expect(out[out.length - 1].end).toBe(4);
  });

  // AC1 경계: 말미 공백은 빈 조각을 만들지 않고 정돈된 단일 세그먼트로 남는다.
  it('should trim trailing whitespace without producing an empty piece', async () => {
    const cues = [cue(0, 'x')];
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: '文A。 ', cueCount: 1 },
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out.map((s) => s.text)).toEqual(['文A。']);
  });

  // 멀티그룹: 한 배치가 그룹 2개를 반환하고 각각 분할될 때 offset·시간 연속성 유지.
  it('should split multiple groups in a batch keeping cue offsets and time continuity', async () => {
    const cues = [cue(0, 'x'), cue(1, 'y'), cue(2, 'z')]; // [0,2][2,4][4,6]
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: 'AA。BB。', cueCount: 2 }, // 그룹1 [0,4]
      { text: 'CC。', cueCount: 1 }, // 그룹2 [4,6]
    ]);

    await buildSentences(VID, { builder });

    const out = await readSegments();
    expect(out.map((s) => s.text)).toEqual(['AA。', 'BB。', 'CC。']);
    expect(out[0].start).toBe(0);
    expect(out[2].start).toBe(4); // 그룹2는 cue2에서 시작
    expect(out[2].end).toBe(6);
  });
});
