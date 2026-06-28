import { describe, it, expect } from 'vitest';
import { isSubmittable } from './import-form';

describe('isSubmittable', () => {
  it('should return true when both are non-empty http(s) URLs', () => {
    expect(
      isSubmittable('https://youtu.be/abc', 'https://freakonomics.com/x'),
    ).toBe(true);
    expect(isSubmittable('http://a.com', 'http://b.com')).toBe(true);
  });

  it('should return false when either url is empty or not http(s)', () => {
    expect(isSubmittable('', 'https://b.com')).toBe(false);
    expect(isSubmittable('https://a.com', '   ')).toBe(false);
    expect(isSubmittable('ftp://a.com', 'https://b.com')).toBe(false);
    expect(isSubmittable('not a url', 'https://b.com')).toBe(false);
  });
});
