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
});
