/**
 * 띄어쓰기 없는 언어(ja)의 단어 토큰 분해 유틸 (#127).
 * Intl.Segmenter 기반 — kuromoji 등 사전 다운로드형 라이브러리 미도입(Out of Scope §4-6).
 */

/** Intl.Segmenter 기반 단어 토큰. isWord=false는 구두점·공백 등 비단어. */
export interface WordToken {
  text: string;
  isWord: boolean;
}

/** 네이버 일본어사전 검색 URL (spec-fixed B8). */
export function naverJaDictUrl(word: string): string {
  return `https://ja.dict.naver.com/#/search?query=${encodeURIComponent(word)}`;
}

// Intl.Segmenter 최소 계약(런타임 미지원 환경 폴백 판정용).
type SegmenterCtor = new (
  locale: string,
  options: { granularity: 'word' },
) => {
  segment(text: string): Iterable<{ segment: string; isWordLike?: boolean }>;
};

/**
 * ja 텍스트를 Intl.Segmenter('ja', {granularity:'word'})로 단어 토큰 분해.
 * - 토큰 join === 원문(무손실).
 * - Intl.Segmenter 미지원 환경: 전체 텍스트 1개 단어 토큰 폴백(크래시 없음).
 * - 빈 문자열 → [].
 */
export function tokenizeJa(text: string): WordToken[] {
  if (text === '') return [];
  const Segmenter = (Intl as { Segmenter?: SegmenterCtor }).Segmenter;
  if (!Segmenter) return [{ text, isWord: true }];

  const segmenter = new Segmenter('ja', { granularity: 'word' });
  return [...segmenter.segment(text)].map((s) => ({
    text: s.segment,
    isWord: Boolean(s.isWordLike),
  }));
}
