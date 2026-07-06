import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { translate, type SegmentTranslator } from './translation';
import type { Segment } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-issue103-vid';

function dir(id: string): string {
  return path.join(BASE, id);
}

function seg(i: number, over: Partial<Segment> = {}): Segment {
  return {
    id: `seg-${i}`,
    start: i,
    end: i + 1,
    speaker: 'DUBNER',
    text: `line ${i}`,
    ...over,
  };
}

async function writeSegments(segments: Segment[]): Promise<void> {
  await fs.mkdir(dir(VID), { recursive: true });
  await fs.writeFile(
    path.join(dir(VID), 'segments.json'),
    JSON.stringify(segments, null, 2),
    'utf-8',
  );
}

async function readSegments(): Promise<Segment[]> {
  const raw = await fs.readFile(path.join(dir(VID), 'segments.json'), 'utf-8');
  return JSON.parse(raw) as Segment[];
}

// 각 배치를 기록하고 `[KO] {text}`로 번역하는 스텁.
function recordingTranslator(): {
  calls: Segment[][];
  translator: SegmentTranslator;
} {
  const calls: Segment[][] = [];
  const translator: SegmentTranslator = async (batch) => {
    calls.push(batch);
    return batch.map((s) => `[KO] ${s.text}`);
  };
  return { calls, translator };
}

afterEach(async () => {
  await fs.rm(dir(VID), { recursive: true, force: true });
});

describe('translate (import-translation 이슈 #103)', () => {
  it('[정상] AC1: 번역 없는 segments 전부에 translation 주입 후 재기록', async () => {
    await writeSegments([seg(0), seg(1), seg(2)]);
    const { translator } = recordingTranslator();

    await translate(VID, { translator });

    const out = await readSegments();
    expect(out.map((s) => s.translation)).toEqual([
      '[KO] line 0',
      '[KO] line 1',
      '[KO] line 2',
    ]);
  });

  it('[정상] AC2: 이미 translation 있는 세그먼트는 보존, 누락분만 translator에 전달', async () => {
    await writeSegments([
      seg(0, { translation: '기존 번역' }),
      seg(1),
      seg(2, { translation: '기존 번역2' }),
    ]);
    const { calls, translator } = recordingTranslator();

    await translate(VID, { translator });

    // translator에는 누락분(seg-1)만 전달
    expect(calls.flat().map((s) => s.id)).toEqual(['seg-1']);
    const out = await readSegments();
    expect(out[0].translation).toBe('기존 번역'); // 보존
    expect(out[1].translation).toBe('[KO] line 1'); // 신규
    expect(out[2].translation).toBe('기존 번역2'); // 보존
  });

  it('[정상] AC3: 45개·batchSize=20 → 3회(20/20/5) 인접 묶음 호출', async () => {
    const segments = Array.from({ length: 45 }, (_, i) => seg(i));
    await writeSegments(segments);
    const { calls, translator } = recordingTranslator();

    await translate(VID, { translator, batchSize: 20 });

    expect(calls.map((c) => c.length)).toEqual([20, 20, 5]);
    expect(calls[0][0].id).toBe('seg-0');
    expect(calls[1][0].id).toBe('seg-20');
    expect(calls[2][0].id).toBe('seg-40');
  });

  it('[예외] AC4: 특정 배치 throw는 그 배치만 스킵, 나머지 정상, 함수 정상 종료', async () => {
    const segments = Array.from({ length: 5 }, (_, i) => seg(i));
    await writeSegments(segments);
    // 두 번째 배치(seg-2,3)에서만 throw
    const translator: SegmentTranslator = async (batch) => {
      if (batch.some((s) => s.id === 'seg-2')) throw new Error('boom');
      return batch.map((s) => `[KO] ${s.text}`);
    };

    await expect(
      translate(VID, { translator, batchSize: 2 }),
    ).resolves.toBeUndefined();

    const out = await readSegments();
    expect(out[0].translation).toBe('[KO] line 0');
    expect(out[1].translation).toBe('[KO] line 1');
    expect(out[2].translation).toBeUndefined(); // 실패 배치
    expect(out[3].translation).toBeUndefined(); // 실패 배치
    expect(out[4].translation).toBe('[KO] line 4');
  });

  it('[경계] AC5: 입력≠출력 길이면 그 배치 미주입(스킵)', async () => {
    await writeSegments([seg(0), seg(1)]);
    const translator: SegmentTranslator = async () => ['only-one']; // 길이 1 ≠ 2

    await translate(VID, { translator, batchSize: 20 });

    const out = await readSegments();
    expect(out[0].translation).toBeUndefined();
    expect(out[1].translation).toBeUndefined();
  });

  it('[정상] 증분 저장: 각 배치 성공 직후 즉시 segments.json에 누적 반영 (#109 AC1)', async () => {
    await writeSegments([seg(0), seg(1), seg(2), seg(3)]); // batchSize 2 → 2배치
    let diskWhenBatch2Runs: Segment[] | null = null;
    const translator: SegmentTranslator = async (batch) => {
      // 2번째 배치(seg-2 포함) 실행 시점에 1번째 배치가 이미 디스크에 저장돼 있어야 한다.
      if (batch.some((s) => s.id === 'seg-2')) {
        diskWhenBatch2Runs = await readSegments();
      }
      return batch.map((s) => `[KO] ${s.text}`);
    };

    await translate(VID, { translator, batchSize: 2 });

    // 끝에 한 번만 저장하는 구현이라면 여기서 translation이 undefined다(→ 실패).
    expect(diskWhenBatch2Runs).not.toBeNull();
    expect(diskWhenBatch2Runs![0].translation).toBe('[KO] line 0');
    expect(diskWhenBatch2Runs![1].translation).toBe('[KO] line 1');
  });

  it('[예외] 배치 실패/길이불일치는 console.warn으로 사유 로깅 (#109 AC2)', async () => {
    await writeSegments([seg(0), seg(1)]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const translator: SegmentTranslator = async () => {
      throw new Error('boom');
    };

    await translate(VID, { translator, batchSize: 2 });

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('[경계] AC6: 공백/빈 text는 번역 대상 제외·통과', async () => {
    await writeSegments([
      seg(0, { text: '   ' }),
      seg(1, { text: '' }),
      seg(2),
    ]);
    const { calls, translator } = recordingTranslator();

    await translate(VID, { translator });

    expect(calls.flat().map((s) => s.id)).toEqual(['seg-2']); // 빈 것 제외
    const out = await readSegments();
    expect(out[0].translation).toBeUndefined();
    expect(out[1].translation).toBeUndefined();
    expect(out[2].translation).toBe('[KO] line 2');
  });
});
