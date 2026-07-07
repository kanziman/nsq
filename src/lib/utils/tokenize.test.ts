import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  tokenizeJa,
  naverJaDictUrl,
  composeRuby,
  type WordToken,
} from './tokenize';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tokenizeJa', () => {
  // [정상] 무손실 분해: 토큰 join === 원문, 단어 토큰 존재
  it('should split ja text into word tokens covering the original text losslessly', () => {
    const text = '今日はいい天気ですね。';
    const tokens = tokenizeJa(text);
    expect(tokens.map((t) => t.text).join('')).toBe(text);
    expect(tokens.filter((t) => t.isWord).length).toBeGreaterThan(1);
  });

  // [정상] 구두점은 비단어 토큰
  it('should mark punctuation as non-word tokens', () => {
    const tokens = tokenizeJa('はい、そうです。');
    const punct = tokens.filter((t) => t.text === '、' || t.text === '。');
    expect(punct.length).toBe(2);
    for (const p of punct) expect(p.isWord).toBe(false);
  });

  // [경계] 빈 문자열 → []
  it('should return empty array for empty text', () => {
    expect(tokenizeJa('')).toEqual([]);
  });

  // [예외] Intl.Segmenter 미지원 → 전체 1개 단어 토큰 폴백
  it('should fall back to a single word token when Intl.Segmenter is unavailable', () => {
    const original = Intl.Segmenter;
    vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
    try {
      expect(tokenizeJa('今日はいい天気')).toEqual([
        { text: '今日はいい天気', isWord: true },
      ]);
    } finally {
      vi.stubGlobal('Intl', { ...Intl, Segmenter: original });
    }
  });
});

describe('composeRuby', () => {
  const WORDS: WordToken[] = [
    { text: '今日', isWord: true },
    { text: 'は', isWord: true },
    { text: '天気', isWord: true },
    { text: '。', isWord: false },
  ];
  const TEXT = '今日は天気。';

  // [정상] 단어 경계 안의 루비 토큰은 rt 유지
  it('should align ruby tokens inside word boundaries keeping rt', () => {
    const composed = composeRuby(
      WORDS,
      [
        { text: '今日', rt: 'きょう' },
        { text: 'は' },
        { text: '天気', rt: 'てんき' },
        { text: '。' },
      ],
      TEXT,
    );
    expect(composed).toHaveLength(4);
    expect(composed[0]).toEqual({
      pieces: [{ text: '今日', rt: 'きょう' }],
      isWord: true,
      word: '今日',
    });
    expect(composed[2].pieces).toEqual([{ text: '天気', rt: 'てんき' }]);
    expect(composed[3].isWord).toBe(false);
  });

  // [경계] 단어 경계를 걸치는 루비 토큰은 분할되고 rt 폐기
  it('should drop rt when a ruby token straddles a word boundary', () => {
    const composed = composeRuby(
      WORDS,
      [
        { text: '今日は', rt: 'きょうは' }, // 今日|は 경계를 걸침
        { text: '天気', rt: 'てんき' },
        { text: '。' },
      ],
      TEXT,
    );
    expect(composed[0].pieces).toEqual([{ text: '今日' }]);
    expect(composed[1].pieces).toEqual([{ text: 'は' }]);
    expect(composed[2].pieces).toEqual([{ text: '天気', rt: 'てんき' }]);
  });

  // [경계] 루비 join 불일치 → 단어 전용 폴백(rt 전무)
  it('should fall back to word-only pieces when ruby join mismatches text', () => {
    const composed = composeRuby(
      WORDS,
      [{ text: '今日', rt: 'きょう' }], // join ≠ text
      TEXT,
    );
    expect(composed).toHaveLength(4);
    for (const w of composed) {
      for (const p of w.pieces) expect(p.rt).toBeUndefined();
    }
    expect(composed.map((w) => w.word).join('')).toBe(TEXT);
  });
});

describe('naverJaDictUrl', () => {
  // [정상] 인코딩된 네이버 일본어사전 검색 URL
  it('should build an encoded naver ja dictionary search url', () => {
    expect(naverJaDictUrl('天気')).toBe(
      `https://ja.dict.naver.com/#/search?query=${encodeURIComponent('天気')}`,
    );
  });
});
