import { describe, it, expect } from 'vitest';
import { extractVideoId } from './youtube';

describe('extractVideoId', () => {
  // --- 정상 ---
  it('should return videoId when given a watch?v= URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('should return videoId when given a youtu.be/ short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  // --- 경계 ---
  it('should still extract videoId when URL has extra query params', () => {
    expect(
      extractVideoId(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL12345',
      ),
    ).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('should extract videoId from /embed/ID and /shorts/ID formats', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  // --- 예외 ---
  it('should return null when url is not a valid YouTube URL', () => {
    expect(
      extractVideoId('https://example.com/watch?v=dQw4w9WgXcQ'),
    ).toBeNull();
    expect(extractVideoId('not a url at all')).toBeNull();
  });

  it('should return null when url is empty string or non-string', () => {
    expect(extractVideoId('')).toBeNull();
    // 비문자열 입력도 안전하게 null 반환 (throw 금지)
    expect(extractVideoId(undefined as unknown as string)).toBeNull();
    expect(extractVideoId(null as unknown as string)).toBeNull();
  });
});
