import { describe, it, expect } from 'vitest';
import { isSubmittable } from './import-form';

describe('isSubmittable', () => {
  it('should return true when both are non-empty http(s) URLs', () => {
    expect(
      isSubmittable('https://youtu.be/abc', 'https://freakonomics.com/x'),
    ).toBe(true);
    expect(isSubmittable('http://a.com', 'http://b.com')).toBe(true);
  });

  // #124: 공백 대본은 자막 전용 제출로 허용되므로 여기서 제외(language describe에서 검증).
  it('should return false when youtubeUrl is empty/invalid or transcriptUrl is not http(s)', () => {
    expect(isSubmittable('', 'https://b.com')).toBe(false);
    expect(isSubmittable('ftp://a.com', 'https://b.com')).toBe(false);
    expect(isSubmittable('not a url', 'https://b.com')).toBe(false);
    expect(isSubmittable('https://a.com', 'not a url')).toBe(false);
  });
});

// #124: language 인자 — en은 대본 선택, ja는 대본 없음이 전제.
describe('isSubmittable (language)', () => {
  // [정상] en + 대본 비움 → 자막 전용 제출 가능
  it('should return true when en + valid youtubeUrl + empty transcriptUrl', () => {
    expect(isSubmittable('https://youtu.be/abc', '', 'en')).toBe(true);
    expect(isSubmittable('https://youtu.be/abc', '   ', 'en')).toBe(true);
  });

  // [정상] ja + 대본 비움 → 제출 가능
  it('should return true when ja + valid youtubeUrl + empty transcriptUrl', () => {
    expect(isSubmittable('https://youtu.be/abc', '', 'ja')).toBe(true);
  });

  // [정상] en + 유효 대본 → 기존 정합 경로(회귀)
  it('should return true when en + valid youtubeUrl + valid transcriptUrl', () => {
    expect(
      isSubmittable('https://youtu.be/abc', 'https://freakonomics.com/x', 'en'),
    ).toBe(true);
  });

  // [경계] en + 비어있지 않지만 http(s) 아님 → 불가
  it('should return false when en + transcriptUrl is non-empty but not http(s)', () => {
    expect(isSubmittable('https://youtu.be/abc', 'ftp://x', 'en')).toBe(false);
    expect(isSubmittable('https://youtu.be/abc', 'not a url', 'en')).toBe(
      false,
    );
  });

  // [예외] ja + 대본 입력 → 불가 (조합 불허)
  it('should return false when ja + non-empty transcriptUrl', () => {
    expect(isSubmittable('https://youtu.be/abc', 'https://x.com/t', 'ja')).toBe(
      false,
    );
  });
});
