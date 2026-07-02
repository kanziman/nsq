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
