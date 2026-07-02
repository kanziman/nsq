import { describe, it, expect } from 'vitest';
import { splitWords, findCurrentWordIndex } from './words';

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
