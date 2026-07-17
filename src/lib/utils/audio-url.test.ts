import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAudioUrl } from './audio-url';

const R2 = 'https://pub-abc123.r2.dev';
const ID = 'C9VabhxOPbA';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('buildAudioUrl', () => {
  // ---------- [정상] ----------
  it('should return `${base}/${id}/audio.mp3` when baseUrl is provided', () => {
    expect(buildAudioUrl(ID, R2)).toBe(`${R2}/${ID}/audio.mp3`);
  });

  it('should read baseUrl from NEXT_PUBLIC_R2_BASE_URL when arg omitted', () => {
    vi.stubEnv('NEXT_PUBLIC_R2_BASE_URL', R2);
    expect(buildAudioUrl(ID)).toBe(`${R2}/${ID}/audio.mp3`);
  });

  it('should compose URL for a typical youtube videoId', () => {
    expect(buildAudioUrl('dQw4w9WgXcQ', R2)).toBe(
      `${R2}/dQw4w9WgXcQ/audio.mp3`,
    );
  });

  // ---------- [경계] ----------
  it('should strip a single trailing slash from baseUrl before composing', () => {
    expect(buildAudioUrl(ID, `${R2}/`)).toBe(`${R2}/${ID}/audio.mp3`);
  });

  it('should strip multiple trailing slashes from baseUrl', () => {
    expect(buildAudioUrl(ID, `${R2}///`)).toBe(`${R2}/${ID}/audio.mp3`);
  });

  it('should not produce double slashes between base and id', () => {
    const url = buildAudioUrl(ID, `${R2}/`);
    expect(url).not.toContain(`${R2}//${ID}`);
  });

  // ---------- [예외] ----------
  it('should warn and return root-relative path when baseUrl is empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildAudioUrl(ID, '')).toBe(`/${ID}/audio.mp3`);
    expect(warn).toHaveBeenCalled();
  });

  it('should warn and return root-relative path when NEXT_PUBLIC_R2_BASE_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_R2_BASE_URL', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildAudioUrl(ID)).toBe(`/${ID}/audio.mp3`);
    expect(warn).toHaveBeenCalled();
  });

  it('should not throw when baseUrl is empty (build/type safety)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => buildAudioUrl(ID, '')).not.toThrow();
  });

  it('should treat whitespace-only baseUrl as empty (warn + root-relative)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildAudioUrl(ID, '   ')).toBe(`/${ID}/audio.mp3`);
    expect(warn).toHaveBeenCalled();
  });
});

// AC2 회귀 가드 — 서버리스 오디오 라우트가 다시 추가되지 않도록 막는다.
describe('audio route removal (AC2)', () => {
  it('should not have a serverless audio route file', () => {
    const routePath = fileURLToPath(
      new URL('../../app/api/episodes/[id]/audio/route.ts', import.meta.url),
    );
    expect(existsSync(routePath)).toBe(false);
  });
});
