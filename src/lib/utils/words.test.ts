import { describe, it, expect } from 'vitest';
import {
  splitWords,
  findCurrentWordIndex,
  computeWordStarts,
  currentWordIndexFromStarts,
} from './words';

describe('splitWords', () => {
  it('[정상] should split on whitespace and drop empty tokens', () => {
    expect(splitWords('hello   there  world')).toEqual([
      'hello',
      'there',
      'world',
    ]);
  });

  it('[경계] should return [] for empty/whitespace-only text', () => {
    expect(splitWords('')).toEqual([]);
    expect(splitWords('   ')).toEqual([]);
  });
});

describe('findCurrentWordIndex', () => {
  // 3 단어, [0, 3) 구간 → 각 단어 1초.
  it('[정상] should distribute words evenly across [start,end)', () => {
    expect(findCurrentWordIndex(3, 0, 3, 0.5)).toBe(0);
    expect(findCurrentWordIndex(3, 0, 3, 1.5)).toBe(1);
    expect(findCurrentWordIndex(3, 0, 3, 2.9)).toBe(2);
  });

  it('[경계] should clamp to last word at/after end and to -1 before start', () => {
    expect(findCurrentWordIndex(3, 0, 3, 3)).toBe(2);
    expect(findCurrentWordIndex(3, 0, 3, 10)).toBe(2);
    expect(findCurrentWordIndex(3, 0, 3, -1)).toBe(-1);
  });

  it('[경계] should return -1 when there are no words', () => {
    expect(findCurrentWordIndex(0, 0, 3, 1)).toBe(-1);
  });

  it('[예외] should not divide by zero for degenerate [start,end) (start===end)', () => {
    // t === start === end: 크래시(NaN) 없이 첫 단어를 반환한다.
    expect(findCurrentWordIndex(2, 5, 5, 5)).toBe(0);
  });
});

describe('computeWordStarts', () => {
  it('[정상] should map official words to VTT token times proportionally when tokens exist (AC1)', () => {
    expect(computeWordStarts(4, 0, 4, [0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
  });

  it('[정상] should place the first word at the first token time, not the segment start (AC1)', () => {
    // 세그먼트 시작(0)과 무관하게 첫 단어는 첫 토큰(1.0)에 강조된다.
    expect(computeWordStarts(3, 0, 6, [1, 3, 5])).toEqual([1, 3, 5]);
  });

  it('[정상] should proportionally sample when token/word counts differ', () => {
    // n=2, m=4 → i=0→tokens[0], i=1→tokens[2]
    expect(computeWordStarts(2, 0, 4, [10, 20, 30, 40])).toEqual([10, 30]);
  });

  it('[경계] should fall back to even distribution when no tokens in the window (AC2)', () => {
    expect(computeWordStarts(2, 0, 4, [])).toEqual([0, 2]);
  });

  it('[경계] should return [] when wordCount is 0', () => {
    expect(computeWordStarts(0, 0, 4, [1, 2])).toEqual([]);
  });
});

describe('currentWordIndexFromStarts', () => {
  const starts = [1, 3, 5];

  it('[정상] should return the last word whose start <= t', () => {
    expect(currentWordIndexFromStarts(starts, 1)).toBe(0);
    expect(currentWordIndexFromStarts(starts, 4)).toBe(1);
    expect(currentWordIndexFromStarts(starts, 5)).toBe(2);
    expect(currentWordIndexFromStarts(starts, 100)).toBe(2);
  });

  it('[경계] should return -1 before the first word start', () => {
    expect(currentWordIndexFromStarts(starts, 0)).toBe(-1);
  });

  it('[경계] should return -1 for empty starts', () => {
    expect(currentWordIndexFromStarts([], 5)).toBe(-1);
  });
});
