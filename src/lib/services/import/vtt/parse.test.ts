import { describe, it, expect } from 'vitest';
import { parseVtt } from './parse';

describe('parseVtt', () => {
  it('should produce word tokens with monotonic times distributed across each cue', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
one two

00:00:02.000 --> 00:00:04.000
three four`;
    const tokens = parseVtt(vtt);
    expect(tokens.map((t) => t.word)).toEqual(['one', 'two', 'three', 'four']);
    expect(tokens[0]).toEqual({ word: 'one', start: 0, end: 1 });
    expect(tokens[1]).toEqual({ word: 'two', start: 1, end: 2 });
    expect(tokens[2]).toEqual({ word: 'three', start: 2, end: 3 });
    expect(tokens[3]).toEqual({ word: 'four', start: 3, end: 4 });
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i].start).toBeGreaterThanOrEqual(tokens[i - 1].start);
      expect(tokens[i].start).toBeLessThan(tokens[i].end);
    }
  });

  it('should dedupe YouTube rolling auto-captions via inline word timestamps', () => {
    const vtt = `WEBVTT
Kind: captions

00:00:00.080 --> 00:00:01.910
do<00:00:00.240><c> I</c><00:00:00.560><c> seem</c>

00:00:01.910 --> 00:00:01.920
do I seem

00:00:01.920 --> 00:00:04.870
do I seem<00:00:02.000><c> like</c>`;
    const tokens = parseVtt(vtt);
    // 롤링 스냅샷/이월 중복을 타임스탬프로 제거 → 발화 단어당 1회.
    expect(tokens.map((t) => t.word)).toEqual(['I', 'seem', 'like']);
    expect(tokens[0].start).toBeCloseTo(0.24);
    expect(tokens[1].start).toBeCloseTo(0.56);
    expect(tokens[2].start).toBeCloseTo(2.0);
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i].start).toBeGreaterThan(tokens[i - 1].start);
      expect(tokens[i].end).toBeGreaterThan(tokens[i].start);
    }
  });
});
