import type { Segment, VttToken } from '@/lib/types';

/**
 * VTT 토큰을 각 세그먼트의 [start, end) 시간 범위로 매핑해 words를 채운다.
 * 매칭되는 토큰이 없는 세그먼트는 words를 부여하지 않는다(폴백 대상).
 */
export function mapWordsToSegments(
  segments: Segment[],
  tokens: VttToken[],
): Segment[] {
  return segments.map((seg) => {
    const words = tokens.filter(
      (t) => t.start >= seg.start && t.start < seg.end,
    );
    return words.length > 0 ? { ...seg, words } : seg;
  });
}

/**
 * 현재 시간(t)에 해당하는 단어 인덱스. start <= t 인 마지막 단어를 반환한다.
 * 첫 단어 시작 이전이거나 words가 없으면 -1.
 */
export function findCurrentWordIndex(
  words: VttToken[] | undefined,
  t: number,
): number {
  if (!words || words.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].start) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}
