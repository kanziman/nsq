/**
 * #143: buildSentences — 대형 배치 all-or-nothing 폐기 완화.
 *  - AC1: 기본 배치 크기 축소(≤20).
 *  - AC2: 파티션 불일치를 하위 청크로 격리(전체 배치 폐기 금지).
 *  - AC3: 재시도 시 sent-* passthrough, cue-* 런만 재병합.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type { Segment } from '@/lib/types';
import { buildSentences, type SentenceBuilder } from './sentence-builder';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-sb-adaptive-vid';

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

describe('buildSentences (#143 adaptive batching)', () => {
  // AC1: 기본 배치 크기가 축소되어 각 builder 호출이 ≤20개 큐를 받는다.
  it('should split cues into batches no larger than 20 when using the default batch size', async () => {
    const cues = Array.from({ length: 25 }, (_, i) => cue(i, `c${i}`));
    await writeSegments(cues);
    const sizes: number[] = [];
    const builder: SentenceBuilder = vi.fn(async (batch) => {
      sizes.push(batch.length);
      return [
        {
          text: batch.map((c: Segment) => c.text).join(''),
          cueCount: batch.length,
        },
      ];
    });

    await buildSentences(VID, { builder });

    expect(Math.max(...sizes)).toBeLessThanOrEqual(20);
  });

  // AC2: 배치 전체가 파티션 불일치여도 절반 분할로 유효 하위 청크는 병합된다.
  it('should isolate a partition mismatch to sub-chunks and keep valid sub-chunks merged', async () => {
    const cues = Array.from({ length: 8 }, (_, i) => cue(i, `c${i}`));
    await writeSegments(cues);
    // 큐 5개 이상이면 합 불일치(무효), 4개 이하면 유효 파티션.
    const builder: SentenceBuilder = vi.fn(async (batch) =>
      batch.length > 4
        ? [{ text: 'bad', cueCount: batch.length + 1 }]
        : [
            {
              text: batch.map((c: Segment) => c.text).join(''),
              cueCount: batch.length,
            },
          ],
    );

    await buildSentences(VID, { builder, minChunk: 2 });

    const out = await readSegments();
    // 전량 원본(8 cue-*)이 아니라 병합 문장이 생겨야 한다.
    expect(out.length).toBeLessThan(8);
    expect(out.some((s) => s.id.startsWith('sent-'))).toBe(true);
  });

  // AC3: 재시도(혼합 입력)에서 sent-*는 통과, cue-* 런만 builder로 재병합.
  it('should pass through existing sent-* segments and re-merge only cue-* runs', async () => {
    const merged: Segment = {
      id: 'sent-1',
      start: 0,
      end: 6,
      speaker: 'SPEAKER',
      text: '이미 병합된 문장.',
    };
    const cues = [cue(3, 'a'), cue(4, 'b'), cue(5, 'c')];
    await writeSegments([merged, ...cues]);
    const builder: SentenceBuilder = vi.fn(async (batch) => [
      { text: 'remerged', cueCount: batch.length },
    ]);

    await buildSentences(VID, { builder });

    // builder는 cue-* 런(3개)만 받아야 한다.
    expect(builder).toHaveBeenCalledTimes(1);
    const callCues = (builder as unknown as { mock: { calls: Segment[][][] } })
      .mock.calls[0][0];
    expect(callCues).toHaveLength(3);
    expect(callCues.every((c) => c.id.startsWith('cue-'))).toBe(true);
    // 기존 sent-* 텍스트는 보존된다.
    const out = await readSegments();
    expect(out[0].text).toBe('이미 병합된 문장.');
  });

  // AC2 경계: 부분 성공/부분 실패 — 한쪽 서브체인은 floor까지 불일치라 원본 유지,
  // 다른 쪽은 병합. 전체 배치 all-or-nothing 폐기가 아님을 확인.
  it('should keep raw cues for a sub-chain that mismatches down to the floor while merging the valid side', async () => {
    const cues = Array.from({ length: 10 }, (_, i) => cue(i, `c${i}`));
    await writeSegments(cues);
    // 시작 큐가 앞쪽(start<10, 좌측 5개)이면 항상 무효, 우측이면 유효.
    const builder: SentenceBuilder = vi.fn(async (batch) =>
      batch[0].start < 10
        ? [{ text: 'bad', cueCount: batch.length + 1 }]
        : [{ text: 'right', cueCount: batch.length }],
    );

    await buildSentences(VID, { builder, minChunk: 2 });

    const out = await readSegments();
    expect(out.some((s) => s.id.startsWith('cue-'))).toBe(true); // 좌측 원본 유지
    expect(out.some((s) => s.id.startsWith('sent-'))).toBe(true); // 우측 병합
  });

  // AC3 경계: 다중 sent-*/cue-* 교차 — 순서·텍스트 보존 + contextHint가 직전 세그먼트 텍스트.
  it('should preserve order and thread context hints across interleaved sent-* and cue-* runs', async () => {
    const s1: Segment = {
      id: 'sent-1',
      start: 0,
      end: 2,
      speaker: 'SPEAKER',
      text: 'S1',
    };
    const s2: Segment = {
      id: 'sent-2',
      start: 8,
      end: 10,
      speaker: 'SPEAKER',
      text: 'S2',
    };
    const run1 = [cue(1, 'a'), cue(2, 'b')];
    const run2 = [cue(5, 'd'), cue(6, 'e')];
    await writeSegments([s1, ...run1, s2, ...run2]);
    const hints: (string | undefined)[] = [];
    const builder: SentenceBuilder = vi.fn(async (batch, hint) => {
      hints.push(hint);
      return [{ text: 'M', cueCount: batch.length }];
    });

    await buildSentences(VID, { builder });

    // 각 cue-* 런의 hint는 직전 통과된 sent-* 텍스트.
    expect(hints).toEqual(['S1', 'S2']);
    const out = await readSegments();
    expect(out.map((s) => s.text)).toEqual(['S1', 'M', 'S2', 'M']);
  });

  // AC4 예외: throw 시 분할하지 않고(1회 호출) 원본 큐 유지, minChunk보다 큰 청크여도 동일.
  it('should not split on throw and keep original cues even when the chunk exceeds minChunk', async () => {
    const cues = Array.from({ length: 10 }, (_, i) => cue(i, `c${i}`));
    await writeSegments(cues);
    const builder: SentenceBuilder = vi.fn(async () => {
      throw new Error('boom');
    });

    await buildSentences(VID, { builder, minChunk: 2 });

    expect(builder).toHaveBeenCalledTimes(1); // 분할 없음
    const out = await readSegments();
    expect(out).toHaveLength(10);
    expect(out.every((s) => s.id.startsWith('cue-'))).toBe(true);
  });
});
