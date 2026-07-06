/**
 * 세그먼트 텍스트의 단어 단위 강조를 위한 유틸.
 *
 * 자막(VTT) 자동 캡션은 공식 대본과 단어가 일치하지 않으므로(누락/치환) 화면 텍스트로
 * 쓰지 않는다. 대신 공식 대본 텍스트를 단어로 분해하고, 세그먼트 [start, end) 구간에
 * 균등 분포시켜 현재 시간에 해당하는 단어를 근사 강조한다.
 */

// 0 division 방지용 최소 구간 길이.
const MIN_DURATION = 0.001;

/** 공백 기준 단어 분해(빈 토큰 제거). */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * 세그먼트 [start, end) 구간에 wordCount개 단어를 균등 분포시켜, 현재 시간 t의 단어
 * 인덱스를 반환한다. start 이전이면 -1, end 이후이거나 구간을 벗어나면 마지막 단어로 클램프.
 */
export function findCurrentWordIndex(
  wordCount: number,
  start: number,
  end: number,
  t: number,
): number {
  if (wordCount <= 0 || t < start) return -1;
  const dur = Math.max(end - start, MIN_DURATION);
  const idx = Math.floor(((t - start) / dur) * wordCount);
  return Math.min(wordCount - 1, Math.max(0, idx));
}

/**
 * 세그먼트 [start,end) 구간의 VTT 토큰 시각(오름차순)을 공식 단어 수에 비례 매핑해
 * 각 공식 단어의 시작 시각 배열을 만든다. 토큰이 없으면 균등분할로 폴백한다.
 */
export function computeWordStarts(
  wordCount: number,
  start: number,
  end: number,
  tokenTimes: number[],
): number[] {
  if (wordCount <= 0) return [];
  const m = tokenTimes.length;
  // 구간 내 토큰이 없으면 균등분할로 폴백.
  if (m === 0) {
    const dur = Math.max(end - start, MIN_DURATION);
    return Array.from(
      { length: wordCount },
      (_, i) => start + (dur * i) / wordCount,
    );
  }
  // 공식 단어 i를 토큰 시각에 비례 매핑(실제 발화 리듬 반영).
  return Array.from({ length: wordCount }, (_, i) => {
    const j = Math.min(m - 1, Math.floor((i * m) / wordCount));
    return tokenTimes[j];
  });
}

/**
 * 명시적 시작 시각 배열에서 현재 시간 t의 단어 인덱스. starts[i] <= t 인 마지막 i,
 * 첫 시작 이전이거나 비어 있으면 -1.
 */
export function currentWordIndexFromStarts(
  starts: number[],
  t: number,
): number {
  let idx = -1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= t) idx = i;
    else break;
  }
  return idx;
}
