import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type { Segment } from '@/lib/types';
import {
  buildSentences,
  type SentenceBuilder,
  type SentenceGroup,
} from './sentence-builder';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-sentence-builder-vid';

function cue(i: number, text: string): Segment {
  return {
    id: `cue-${i + 1}`,
    start: i * 2,
    end: i * 2 + 2,
    speaker: 'SPEAKER',
    text,
  };
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

const CUES = [cue(0, '今日は'), cue(1, 'いい天気'), cue(2, 'ですね')];

describe('buildSentences', () => {
  // [정상] 유효 파티션 → 문장 세그먼트 재기록
  it('should rewrite segments.json with sentence segments consuming cueCounts when builder returns a valid partition', async () => {
    await writeSegments(CUES);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: '今日はいい天気ですね。', cueCount: 3 },
    ]);

    await buildSentences(VID, { builder });

    const segments = await readSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      id: 'sent-1',
      text: '今日はいい天気ですね。',
    });
  });

  // [정상] start/end = 그룹 첫/끝 큐 시각, speaker 승계
  it('should set sentence start/end from first/last consumed cue and inherit speaker', async () => {
    await writeSegments(CUES);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: '今日は。', cueCount: 1 },
      { text: 'いい天気ですね。', cueCount: 2 },
    ]);

    await buildSentences(VID, { builder });

    const segments = await readSegments();
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ start: 0, end: 2, speaker: 'SPEAKER' });
    expect(segments[1]).toMatchObject({ start: 2, end: 6, speaker: 'SPEAKER' });
    expect(segments[1].id).toBe('sent-2');
  });

  // [정상] 다음 배치에 이전 배치 마지막 문장을 문맥 힌트로 전달
  it('should pass previous batch last sentence as context hint when processing subsequent batches', async () => {
    await writeSegments([cue(0, 'a'), cue(1, 'b'), cue(2, 'c'), cue(3, 'd')]);
    const hints: Array<string | undefined> = [];
    const builder: SentenceBuilder = vi.fn(
      async (cues: Segment[], hint?: string): Promise<SentenceGroup[]> => {
        hints.push(hint);
        return [
          {
            text: `S(${cues.map((c) => c.text).join('')})`,
            cueCount: cues.length,
          },
        ];
      },
    );

    await buildSentences(VID, { builder, batchSize: 2 });

    expect(hints).toEqual([undefined, 'S(ab)']);
    const segments = await readSegments();
    expect(segments.map((s) => s.text)).toEqual(['S(ab)', 'S(cd)']);
  });

  // [경계] cueCount 합 불일치 배치 → 원본 큐 유지
  it('should keep original cue segments for a batch when cueCount sum mismatches batch length', async () => {
    await writeSegments(CUES);
    const builder: SentenceBuilder = vi.fn(async () => [
      { text: '불일치 문장.', cueCount: 2 }, // 합 2 ≠ 3
    ]);

    await buildSentences(VID, { builder });

    const segments = await readSegments();
    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.id)).toEqual(['cue-1', 'cue-2', 'cue-3']);
  });

  // [경계] 합 초과·0·음수 cueCount → 모두 무효 파티션으로 원본 큐 유지
  it('should keep original cue segments when cueCount exceeds batch, is zero, or negative', async () => {
    const invalidGroups = [
      [{ text: '초과.', cueCount: 5 }],
      [
        { text: '영.', cueCount: 0 },
        { text: '나머지.', cueCount: 3 },
      ],
      [
        { text: '음수.', cueCount: -1 },
        { text: '나머지.', cueCount: 4 },
      ],
    ];
    for (const groups of invalidGroups) {
      await writeSegments(CUES);
      const builder: SentenceBuilder = vi.fn(async () => groups);
      await buildSentences(VID, { builder });
      const segments = await readSegments();
      expect(segments.map((s) => s.id)).toEqual(['cue-1', 'cue-2', 'cue-3']);
    }
  });

  // [경계] 앞 배치 실패해도 뒤 배치는 처리(격리)
  it('should process later batches when an earlier batch fails', async () => {
    await writeSegments([cue(0, 'a'), cue(1, 'b'), cue(2, 'c'), cue(3, 'd')]);
    let call = 0;
    const builder: SentenceBuilder = vi.fn(async (cues) => {
      call += 1;
      if (call === 1) throw new Error('llm boom');
      return [{ text: 'S(cd)', cueCount: cues.length }];
    });

    await buildSentences(VID, { builder, batchSize: 2 });

    const segments = await readSegments();
    expect(segments.map((s) => s.text)).toEqual(['a', 'b', 'S(cd)']);
    expect(segments[0].id).toBe('cue-1');
  });

  // [예외] 전 배치 실패 → 파일 무변경(큐 유지)
  it('should leave segments.json unchanged when builder throws for every batch', async () => {
    await writeSegments(CUES);
    const builder: SentenceBuilder = vi
      .fn()
      .mockRejectedValue(new Error('llm down'));

    await buildSentences(VID, { builder });

    const segments = await readSegments();
    expect(segments).toEqual(CUES);
  });

  // [예외] segments.json 부재 → throw
  it('should throw when segments.json is missing', async () => {
    const builder: SentenceBuilder = vi.fn(async () => []);
    await expect(buildSentences(VID, { builder })).rejects.toThrow();
  });
});
