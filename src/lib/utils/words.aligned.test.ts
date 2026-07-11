/**
 * #139: computeWordStartsAligned — 대본↔VTT 표면형 앵커 정렬 + 구간 선형 보간.
 * 위치-비례(computeWordStarts) 대비 ASR 오인식/토큰 발산에 강건하며, 앵커 부재 시 폴백.
 */
import { describe, it, expect } from 'vitest';
import { computeWordStartsAligned, computeWordStarts } from './words';

type Tok = { word: string; start: number };

describe('computeWordStartsAligned', () => {
  it('should set each non-first anchored word start exactly to its matched VTT token time', () => {
    // words: x0(비앵커) a b c — a/b/c가 표면형 일치.
    const words = ['x0', 'a', 'b', 'c'];
    const toks: Tok[] = [
      { word: 'a', start: 3 },
      { word: 'b', start: 6 },
      { word: 'c', start: 9 },
    ];
    const ws = computeWordStartsAligned(words, 0, 10, toks);
    expect(ws[1]).toBeCloseTo(3);
    expect(ws[2]).toBeCloseTo(6);
    expect(ws[3]).toBeCloseTo(9);
    // 첫 단어는 세그먼트 시작에 앵커(기존 계약).
    expect(ws[0]).toBeCloseTo(0);
  });

  it('should reproduce the #137 fixture times for シェア/する/プラットフォーム/風', () => {
    const words = ['シェア', 'する', 'プラットフォーム', '風'];
    const toks: Tok[] = [
      { word: 'シェア', start: 7.01 },
      { word: 'する', start: 8.87 },
      { word: 'プラットフォーム', start: 12.14 },
      { word: '風', start: 14.1 },
    ];
    const ws = computeWordStartsAligned(words, 7.01, 15.34, toks);
    [7.01, 8.87, 12.14, 14.1].forEach((v, i) =>
      expect(ws[i]).toBeCloseTo(v, 2),
    );
  });

  it('should linearly interpolate non-anchor words between two adjacent anchors by index', () => {
    // x a p q b y — a@2(idx1), b@10(idx4) 앵커. p,q는 사이 보간, y는 뒤 보간, x는 앞 보간.
    const words = ['x', 'a', 'p', 'q', 'b', 'y'];
    const toks: Tok[] = [
      { word: 'a', start: 2 },
      { word: 'b', start: 10 },
    ];
    const ws = computeWordStartsAligned(words, 0, 12, toks);
    expect(ws[1]).toBeCloseTo(2); // anchor
    expect(ws[4]).toBeCloseTo(10); // anchor
    // 사이 보간: 2 + (10-2)*((idx-1)/(4-1))
    expect(ws[2]).toBeCloseTo(2 + 8 * (1 / 3)); // 4.667
    expect(ws[3]).toBeCloseTo(2 + 8 * (2 / 3)); // 7.333
  });

  it('should anchor the first word to segment start (pre-first-anchor)', () => {
    const words = ['x', 'a', 'b'];
    const toks: Tok[] = [
      { word: 'a', start: 4 },
      { word: 'b', start: 8 },
    ];
    const ws = computeWordStartsAligned(words, 0, 10, toks);
    expect(ws[0]).toBeCloseTo(0);
  });

  it('should interpolate post-last-anchor words from the last anchor toward segment end', () => {
    const words = ['a', 'b', 'y'];
    const toks: Tok[] = [
      { word: 'a', start: 2 },
      { word: 'b', start: 10 },
    ];
    const ws = computeWordStartsAligned(words, 0, 12, toks);
    // y(idx2): 10 + (12-10)*((2-1)/(3-1)) = 11
    expect(ws[2]).toBeCloseTo(11);
  });

  it('should keep wordStarts monotonically non-decreasing within [start, end)', () => {
    const words = ['x', 'a', 'p', 'q', 'b', 'y'];
    const toks: Tok[] = [
      { word: 'a', start: 2 },
      { word: 'b', start: 10 },
    ];
    const ws = computeWordStartsAligned(words, 0, 12, toks);
    for (let i = 0; i < ws.length; i++) {
      expect(ws[i]).toBeGreaterThanOrEqual(0);
      expect(ws[i]).toBeLessThan(12);
      if (i > 0) expect(ws[i]).toBeGreaterThanOrEqual(ws[i - 1]);
    }
  });

  it('should place a katakana word between anchors closer to its true time than positional mapping', () => {
    // 진실: a@1, kata@2, b@3, c@8. ASR: a·b·c는 맞고 kata는 오인식('g2'), 잉여 토큰('g1') 삽입.
    const words = ['a', 'kata', 'b', 'c'];
    const toks: Tok[] = [
      { word: 'a', start: 1 },
      { word: 'g1', start: 1.5 },
      { word: 'g2', start: 2 },
      { word: 'b', start: 3 },
      { word: 'c', start: 8 },
    ];
    const aligned = computeWordStartsAligned(words, 0, 9, toks);
    const positional = computeWordStarts(
      words.length,
      0,
      9,
      toks.map((t) => t.start),
    );
    // kata 진실 2, c 진실 8 — 앵커 보간이 위치-비례보다 진실에 더 가깝다.
    expect(Math.abs(aligned[1] - 2)).toBeLessThan(Math.abs(positional[1] - 2));
    expect(Math.abs(aligned[3] - 8)).toBeLessThan(Math.abs(positional[3] - 8));
  });

  it('should anchor consistently in-order despite repeated common tokens and stay monotonic', () => {
    const words = ['の', 'は', 'の', 'は'];
    const toks: Tok[] = [
      { word: 'の', start: 1 },
      { word: 'は', start: 2 },
      { word: 'の', start: 3 },
      { word: 'は', start: 4 },
    ];
    const ws = computeWordStartsAligned(words, 0, 5, toks);
    expect(ws).toHaveLength(4);
    for (let i = 1; i < ws.length; i++) {
      expect(ws[i]).toBeGreaterThanOrEqual(ws[i - 1]);
    }
  });

  it('should fall back to positional computeWordStarts when there are no surface-form anchors', () => {
    const words = ['a', 'b', 'c'];
    const toks: Tok[] = [
      { word: 'x', start: 1 },
      { word: 'y', start: 2 },
      { word: 'z', start: 3 },
    ];
    const ws = computeWordStartsAligned(words, 0, 6, toks);
    const positional = computeWordStarts(3, 0, 6, [1, 2, 3]);
    expect(ws).toEqual(positional);
  });

  it('should fall back to uniform split when vttTokens is empty', () => {
    const words = ['a', 'b'];
    const ws = computeWordStartsAligned(words, 0, 4, []);
    const uniform = computeWordStarts(2, 0, 4, []);
    expect(ws).toEqual(uniform);
  });

  it('should return [] when officialWords is empty', () => {
    expect(
      computeWordStartsAligned([], 0, 10, [{ word: 'a', start: 1 }]),
    ).toEqual([]);
  });

  // 설계 못박기: word[0]은 그 자체가 앵커여도 세그먼트 시작에 앵커한다(첫 강조 사각 제거).
  // 실 파이프라인은 seg.start === 첫 VTT 토큰 시각이라 무손실이지만, 그 불변식과 무관하게
  // word[0]===start를 보장한다. (AC1의 "앵커=실측 정확 일치"는 word[0] 제외)
  it('should anchor word[0] to segment start even when word[0] itself is an exact anchor', () => {
    const words = ['a', 'b', 'c'];
    const toks: Tok[] = [
      { word: 'a', start: 5 },
      { word: 'b', start: 6 },
      { word: 'c', start: 7 },
    ];
    const ws = computeWordStartsAligned(words, 0, 10, toks);
    expect(ws[0]).toBeCloseTo(0); // start override (앵커 'a'@5가 아님)
    expect(ws[1]).toBeCloseTo(6); // 이후 앵커는 실측 시각 그대로
    expect(ws[2]).toBeCloseTo(7);
  });

  // AC5 부분 앵커링: en 대본 단어(구두점 포함)와 VTT 토큰(구두점 제거)이 부분만 일치해도
  // 단조·범위 불변식을 유지하며 길이가 보존된다.
  it('should stay monotonic and bounded under partial anchoring (en punctuation mismatch)', () => {
    const words = ['hello', 'there.', 'friend']; // 'there.' != VTT 'there' → 부분 앵커
    const toks: Tok[] = [
      { word: 'hello', start: 1 },
      { word: 'there', start: 2 },
      { word: 'friend', start: 3 },
    ];
    const ws = computeWordStartsAligned(words, 0, 4, toks);
    expect(ws).toHaveLength(3);
    for (let i = 0; i < ws.length; i++) {
      expect(ws[i]).toBeGreaterThanOrEqual(0);
      expect(ws[i]).toBeLessThan(4);
      if (i > 0) expect(ws[i]).toBeGreaterThanOrEqual(ws[i - 1]);
    }
  });
});
