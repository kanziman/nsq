import { describe, it, expect } from 'vitest';
import { mapWordsToSegments, findCurrentWordIndex } from './words';
import type { Segment, VttToken } from '@/lib/types';

const SEGMENTS: Segment[] = [
  { id: 's1', start: 0, end: 5, speaker: 'DUCKWORTH', text: 'hello there' },
  { id: 's2', start: 5, end: 10, speaker: 'DUBNER', text: 'how are you' },
];

const TOKENS: VttToken[] = [
  { word: 'hello', start: 0, end: 1 },
  { word: 'there', start: 1, end: 2 },
  { word: 'how', start: 5, end: 6 },
  { word: 'are', start: 6, end: 7 },
  { word: 'you', start: 7, end: 8 },
];

describe('mapWordsToSegments', () => {
  it('[정상] should assign tokens within a segment time range', () => {
    const mapped = mapWordsToSegments(SEGMENTS, TOKENS);
    expect(mapped[0].words?.map((w) => w.word)).toEqual(['hello', 'there']);
    expect(mapped[1].words?.map((w) => w.word)).toEqual(['how', 'are', 'you']);
  });

  it('[경계] should leave words undefined when no token matches', () => {
    const mapped = mapWordsToSegments(SEGMENTS, [
      { word: 'x', start: 100, end: 101 },
    ]);
    expect(mapped[0].words).toBeUndefined();
    expect(mapped[1].words).toBeUndefined();
  });
});

describe('findCurrentWordIndex', () => {
  const words: VttToken[] = [
    { word: 'a', start: 0, end: 1 },
    { word: 'b', start: 1, end: 2 },
    { word: 'c', start: 2, end: 3 },
  ];

  it('[정상] should return the last word with start <= t', () => {
    expect(findCurrentWordIndex(words, 0.5)).toBe(0);
    expect(findCurrentWordIndex(words, 1.5)).toBe(1);
    expect(findCurrentWordIndex(words, 2.9)).toBe(2);
    expect(findCurrentWordIndex(words, 10)).toBe(2); // 마지막 유지
  });

  it('[경계] should return -1 before the first word or when words undefined', () => {
    expect(findCurrentWordIndex(words, -1)).toBe(-1);
    expect(findCurrentWordIndex(undefined, 5)).toBe(-1);
    expect(findCurrentWordIndex([], 5)).toBe(-1);
  });
});
