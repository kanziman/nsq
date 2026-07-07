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
/** 루비 조각 — 단어 경계와 병합된 최소 렌더 단위. 경계에서 잘린 루비 토큰은 rt 폐기. */
export interface RubyPiece {
  text: string;
  rt?: string;
}

/** 단어 스팬 1개에 대응하는 합성 결과(하이라이트·사전 클릭 계약 유지). */
export interface ComposedWord {
  pieces: RubyPiece[];
  isWord: boolean;
  word: string; // 사전 클릭용 단어 원문
}

/**
 * 단어 토큰과 루비 토큰을 문자 오프셋으로 병합(#128).
 * ruby가 없거나 join !== text면 단어 토큰만으로 폴백(모든 조각 rt 없음).
 * 단어 경계에서 잘린 루비 토큰은 rt를 폐기한다(요미가나 분할 불가 — 보수적).
 */
export function composeRuby(
  words: WordToken[],
  ruby: import('@/lib/types').RubyToken[] | undefined,
  text: string,
): ComposedWord[] {
  const validRuby =
    ruby && ruby.map((r) => r.text).join('') === text ? ruby : undefined;

  // 루비 토큰 절대 오프셋 범위 사전 계산.
  const ranges: { start: number; end: number; rt?: string }[] = [];
  if (validRuby) {
    let offset = 0;
    for (const r of validRuby) {
      ranges.push({ start: offset, end: offset + r.text.length, rt: r.rt });
      offset += r.text.length;
    }
  }

  const result: ComposedWord[] = [];
  let pos = 0;
  for (const w of words) {
    const end = pos + w.text.length;
    const pieces: RubyPiece[] = [];
    if (!validRuby) {
      pieces.push({ text: w.text });
    } else {
      for (const r of ranges) {
        if (r.end <= pos || r.start >= end) continue;
        const pieceStart = Math.max(pos, r.start);
        const pieceEnd = Math.min(end, r.end);
        const piece: RubyPiece = { text: text.slice(pieceStart, pieceEnd) };
        // 루비 토큰이 온전히 이 단어 안에 있을 때만 rt 유지.
        if (r.rt && pieceStart === r.start && pieceEnd === r.end) {
          piece.rt = r.rt;
        }
        pieces.push(piece);
      }
    }
    result.push({ pieces, isWord: w.isWord, word: w.text });
    pos = end;
  }
  return result;
}

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
