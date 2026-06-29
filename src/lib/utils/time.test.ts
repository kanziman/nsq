import { describe, it, expect } from 'vitest';
import { formatTime, parseVttTimecode } from './time';

describe('formatTime', () => {
  it('[정상] should return "mm:ss" when seconds < 3600', () => {
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(599)).toBe('09:59');
  });

  it('[정상] should return "h:mm:ss" when seconds >= 3600', () => {
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(3600)).toBe('1:00:00');
  });

  it('[경계] should return "00:00" when seconds is 0', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('[예외] should return "00:00" when seconds is negative', () => {
    expect(formatTime(-5)).toBe('00:00');
  });

  it('[예외] should return "00:00" when seconds is NaN or Infinity', () => {
    expect(formatTime(NaN)).toBe('00:00');
    expect(formatTime(Infinity)).toBe('00:00');
  });
});

describe('parseVttTimecode', () => {
  it('[정상] should parse "MM:SS.mmm" to seconds', () => {
    expect(parseVttTimecode('01:05.500')).toBeCloseTo(65.5, 3);
  });

  it('[정상] should parse "HH:MM:SS.mmm" to seconds', () => {
    expect(parseVttTimecode('01:01:01.000')).toBeCloseTo(3661, 3);
  });

  it('[경계] should accept comma decimal', () => {
    expect(parseVttTimecode('00:01,500')).toBeCloseTo(1.5, 3);
  });

  it('[예외] should throw Error when format is invalid', () => {
    expect(() => parseVttTimecode('abc')).toThrow(/Invalid VTT timecode/);
  });
});
