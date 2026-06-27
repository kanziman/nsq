import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  downloadAudio,
  fetchSubtitle,
  type Runner,
  type RunnerResult,
} from './youtube';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-issue9-vid';
const URL = 'https://www.youtube.com/watch?v=test9';

function audioPath(id: string): string {
  return path.join(BASE, id, 'audio.mp3');
}

function subPath(id: string): string {
  return path.join(BASE, id, 'subtitle.en.vtt');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// 성공 runner: 실제로 audio.mp3를 기록해 산출물 검증을 통과시킨다.
function successRunner(): Runner {
  return vi.fn(async (_cmd: string, args: string[]): Promise<RunnerResult> => {
    const oIdx = args.indexOf('-o');
    const out = args[oIdx + 1];
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, 'FAKE_MP3');
    return { code: 0, stderr: '' };
  });
}

function callArgs(runner: Runner): [string, string[]] {
  return (runner as unknown as { mock: { calls: [string, string[]][] } }).mock
    .calls[0];
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
  delete process.env.YT_DLP_PATH;
  delete process.env.YT_DLP_TIMEOUT_MS;
  vi.restoreAllMocks();
});

describe('downloadAudio', () => {
  // [정상]
  it('should call runner once with mp3 args and audio.mp3 output path when given valid url and successful runner', async () => {
    const runner = successRunner();
    await downloadAudio(VID, URL, runner);
    expect(runner).toHaveBeenCalledTimes(1);
    const [, args] = callArgs(runner);
    expect(args).toContain('--extract-audio');
    expect(args).toContain('--audio-format');
    expect(args).toContain('mp3');
    expect(args.join(' ')).toContain(audioPath(VID));
    expect(args).toContain(URL);
  });

  it('should resolve without throwing when runner exits 0 and audio.mp3 is produced', async () => {
    await expect(
      downloadAudio(VID, URL, successRunner()),
    ).resolves.toBeUndefined();
    expect(await fileExists(audioPath(VID))).toBe(true);
  });

  it('should pass --audio-quality 0 flag to runner', async () => {
    const runner = successRunner();
    await downloadAudio(VID, URL, runner);
    const [, args] = callArgs(runner);
    const qIdx = args.indexOf('--audio-quality');
    expect(qIdx).toBeGreaterThanOrEqual(0);
    expect(args[qIdx + 1]).toBe('0');
  });

  // [경계]
  it('should re-run and overwrite (no skip) when audio.mp3 already exists', async () => {
    await fs.mkdir(path.join(BASE, VID), { recursive: true });
    await fs.writeFile(audioPath(VID), 'OLD');
    const runner = successRunner();
    await downloadAudio(VID, URL, runner);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(await fs.readFile(audioPath(VID), 'utf-8')).toBe('FAKE_MP3');
  });

  it('should use YT_DLP_PATH binary as command when YT_DLP_PATH env is set', async () => {
    process.env.YT_DLP_PATH = '/custom/bin/yt-dlp';
    const runner = successRunner();
    await downloadAudio(VID, URL, runner);
    const [cmd] = callArgs(runner);
    expect(cmd).toBe('/custom/bin/yt-dlp');
  });

  it("should default command to 'yt-dlp' when YT_DLP_PATH is unset", async () => {
    delete process.env.YT_DLP_PATH;
    const runner = successRunner();
    await downloadAudio(VID, URL, runner);
    const [cmd] = callArgs(runner);
    expect(cmd).toBe('yt-dlp');
  });

  // [예외]
  it('should throw Error including stderr tail when runner exits with non-zero code', async () => {
    const runner: Runner = vi.fn(async () => ({
      code: 1,
      stderr: 'ERROR: yt-dlp boom-tail-xyz',
    }));
    await expect(downloadAudio(VID, URL, runner)).rejects.toThrow(
      /boom-tail-xyz/,
    );
  });

  it('should include only the stderr tail (drop the head) when stderr exceeds 500 chars', async () => {
    const head = 'HEAD'.repeat(50); // 200자 — 잘려나가야 함
    const tail = 'TAILMARK'.repeat(70); // 560자(>500) — 말미, 포함되어야 함
    const runner: Runner = vi.fn(async () => ({
      code: 1,
      stderr: head + tail,
    }));
    let message = '';
    try {
      await downloadAudio(VID, URL, runner);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('TAILMARK');
    expect(message).not.toContain('HEAD');
  });

  it('should throw Error when runner exits 0 but audio.mp3 was not produced', async () => {
    const runner: Runner = vi.fn(async () => ({ code: 0, stderr: '' }));
    await expect(downloadAudio(VID, URL, runner)).rejects.toThrow();
    expect(runner).toHaveBeenCalledTimes(1);
  });
});

// 수동 자막만 존재: --write-subs(자동 아님) 단계에서 subtitle.en.vtt 생성.
function manualOnlyRunner(content = 'MANUAL_VTT'): Runner {
  return vi.fn(async (_cmd: string, args: string[]): Promise<RunnerResult> => {
    if (args.includes('--write-subs') && !args.includes('--write-auto-subs')) {
      await fs.mkdir(path.join(BASE, VID), { recursive: true });
      await fs.writeFile(subPath(VID), content);
      return { code: 0, stderr: '' };
    }
    return { code: 1, stderr: 'no subtitles produced' };
  });
}

// 자동 자막만 존재: --write-auto-subs 단계에서만 생성, 수동 단계는 빈 결과.
function autoOnlyRunner(content = 'AUTO_VTT'): Runner {
  return vi.fn(async (_cmd: string, args: string[]): Promise<RunnerResult> => {
    if (args.includes('--write-auto-subs')) {
      await fs.mkdir(path.join(BASE, VID), { recursive: true });
      await fs.writeFile(subPath(VID), content);
      return { code: 0, stderr: '' };
    }
    return { code: 1, stderr: 'no manual subtitles' };
  });
}

// 수동·자동 모두 없음: 항상 비-0, 파일 미생성.
function noSubsRunner(stderr = 'ERROR: no subtitles available'): Runner {
  return vi.fn(async () => ({ code: 1, stderr }));
}

describe('fetchSubtitle', () => {
  // [정상]
  it('should produce subtitle.en.vtt from manual step and not call auto fallback when manual subs exist', async () => {
    const runner = manualOnlyRunner();
    await fetchSubtitle(VID, URL, runner);
    expect(await fileExists(subPath(VID))).toBe(true);
    expect(runner).toHaveBeenCalledTimes(1);
    const calls = (
      runner as unknown as { mock: { calls: [string, string[]][] } }
    ).mock.calls;
    expect(calls.every(([, args]) => !args.includes('--write-auto-subs'))).toBe(
      true,
    );
  });

  it('should pass --write-subs and --sub-langs en/--sub-format vtt on the manual step', async () => {
    const runner = manualOnlyRunner();
    await fetchSubtitle(VID, URL, runner);
    const [, args] = callArgs(runner);
    expect(args).toContain('--write-subs');
    expect(args).not.toContain('--write-auto-subs');
    const langIdx = args.indexOf('--sub-langs');
    expect(langIdx).toBeGreaterThanOrEqual(0);
    expect(args[langIdx + 1]).toBe('en');
    const fmtIdx = args.indexOf('--sub-format');
    expect(fmtIdx).toBeGreaterThanOrEqual(0);
    expect(args[fmtIdx + 1]).toBe('vtt');
    const convIdx = args.indexOf('--convert-subs');
    expect(convIdx).toBeGreaterThanOrEqual(0);
    expect(args[convIdx + 1]).toBe('vtt');
  });

  // [경계]
  it('should run auto fallback (--write-auto-subs) and produce subtitle.en.vtt when manual subs are absent', async () => {
    const runner = autoOnlyRunner();
    await fetchSubtitle(VID, URL, runner);
    expect(await fileExists(subPath(VID))).toBe(true);
    expect(runner).toHaveBeenCalledTimes(2);
    const secondArgs = (
      runner as unknown as { mock: { calls: [string, string[]][] } }
    ).mock.calls[1][1];
    expect(secondArgs).toContain('--write-auto-subs');
    // 폴백 단계도 동일한 공통 인자(en/vtt)를 전달해야 한다.
    const langIdx = secondArgs.indexOf('--sub-langs');
    expect(secondArgs[langIdx + 1]).toBe('en');
    const fmtIdx = secondArgs.indexOf('--sub-format');
    expect(secondArgs[fmtIdx + 1]).toBe('vtt');
  });

  it('should re-fetch and overwrite (no skip) when subtitle.en.vtt already exists', async () => {
    await fs.mkdir(path.join(BASE, VID), { recursive: true });
    await fs.writeFile(subPath(VID), 'OLD_VTT');
    const runner = manualOnlyRunner('NEW_VTT');
    await fetchSubtitle(VID, URL, runner);
    expect(await fs.readFile(subPath(VID), 'utf-8')).toBe('NEW_VTT');
    // 스킵 없이 새로 fetch했음을 보장(runner 실제 호출).
    expect(runner).toHaveBeenCalledTimes(1);
  });

  // [예외]
  it('should throw Error and leave no subtitle.en.vtt when neither manual nor auto subs exist', async () => {
    const runner = noSubsRunner();
    await expect(fetchSubtitle(VID, URL, runner)).rejects.toThrow();
    expect(await fileExists(subPath(VID))).toBe(false);
    // 수동·자동 두 단계 모두 시도했음을 보장(폴백까지 호출).
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('should include stderr tail in the error when both steps fail', async () => {
    const runner = noSubsRunner('ERROR: distinctive-sub-fail-zzz');
    await expect(fetchSubtitle(VID, URL, runner)).rejects.toThrow(
      /distinctive-sub-fail-zzz/,
    );
  });
});
