/**
 * #124: fetchSubtitle lang 인자 + writeEpisodeMeta language 영속 (다국어).
 * 기존 en 동작 회귀는 youtube.test.ts가 커버한다(시그니처 갱신 시 함께 정렬).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  fetchSubtitle,
  writeEpisodeMeta,
  type Runner,
  type RunnerResult,
} from './youtube';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-issue124-vid';
const URL = 'https://www.youtube.com/watch?v=test124';

function subPath(id: string, lang: string): string {
  return path.join(BASE, id, `subtitle.${lang}.vtt`);
}

// 성공 runner: --sub-langs 값으로 subtitle.{lang}.vtt를 실제 기록한다.
function subtitleRunner(): Runner {
  return vi.fn(async (_cmd: string, args: string[]): Promise<RunnerResult> => {
    const langIdx = args.indexOf('--sub-langs');
    const lang = args[langIdx + 1];
    await fs.mkdir(path.join(BASE, VID), { recursive: true });
    await fs.writeFile(subPath(VID, lang), 'WEBVTT\n');
    return { code: 0, stderr: '' };
  });
}

// 산출물 없는 runner: 정상 종료하지만 아무 파일도 만들지 않는다.
function noArtifactRunner(): Runner {
  return vi.fn(async (): Promise<RunnerResult> => ({ code: 0, stderr: '' }));
}

// 메타 성공 runner: --dump-single-json 출력 반환.
function metaRunner(): Runner {
  return vi.fn(
    async (): Promise<RunnerResult> => ({
      code: 0,
      stderr: '',
      stdout: JSON.stringify({
        title: 'T',
        duration: 10,
        thumbnail: 'http://x/t.jpg',
      }),
    }),
  );
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('fetchSubtitle (lang)', () => {
  // [정상] lang 'ja' → --sub-langs ja + subtitle.ja.vtt 산출
  it("should pass --sub-langs ja and produce subtitle.ja.vtt when lang is 'ja'", async () => {
    const runner = subtitleRunner();
    await fetchSubtitle(VID, URL, 'ja', runner);
    const [, args] = (
      runner as unknown as { mock: { calls: [string, string[]][] } }
    ).mock.calls[0];
    const langIdx = args.indexOf('--sub-langs');
    expect(langIdx).toBeGreaterThanOrEqual(0);
    expect(args[langIdx + 1]).toBe('ja');
    await expect(fs.access(subPath(VID, 'ja'))).resolves.toBeUndefined();
  });

  // [정상] lang 'en' → 기존 subtitle.en.vtt 경로 유지(회귀)
  it("should produce subtitle.en.vtt when lang is 'en'", async () => {
    await fetchSubtitle(VID, URL, 'en', subtitleRunner());
    await expect(fs.access(subPath(VID, 'en'))).resolves.toBeUndefined();
  });

  // [예외] 수동+자동 모두 산출 없음 → throw (ja 경로)
  it('should throw when neither manual nor auto subtitle artifact is produced', async () => {
    await expect(
      fetchSubtitle(VID, URL, 'ja', noArtifactRunner()),
    ).rejects.toThrow(/produced no subtitle/);
  });
});

describe('writeEpisodeMeta (language)', () => {
  // [정상] language 'ja' → meta.json에 영속
  it("should persist language in meta.json when language is 'ja'", async () => {
    await writeEpisodeMeta(VID, URL, 'ja', metaRunner());
    const meta = JSON.parse(
      await fs.readFile(path.join(BASE, VID, 'meta.json'), 'utf-8'),
    );
    expect(meta.language).toBe('ja');
    expect(meta.title).toBe('T');
  });

  // [정상] language 'en' 기본 경로(회귀)
  it("should persist language 'en' in meta.json when language is 'en'", async () => {
    await writeEpisodeMeta(VID, URL, 'en', metaRunner());
    const meta = JSON.parse(
      await fs.readFile(path.join(BASE, VID, 'meta.json'), 'utf-8'),
    );
    expect(meta.language).toBe('en');
  });
});
