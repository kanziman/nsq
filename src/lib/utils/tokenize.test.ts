import { describe, it, expect, afterEach, vi } from 'vitest';
import { tokenizeJa, naverJaDictUrl } from './tokenize';

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

describe('naverJaDictUrl', () => {
  // [정상] 인코딩된 네이버 일본어사전 검색 URL
  it('should build an encoded naver ja dictionary search url', () => {
    expect(naverJaDictUrl('天気')).toBe(
      `https://ja.dict.naver.com/#/search?query=${encodeURIComponent('天気')}`,
    );
  });
});
