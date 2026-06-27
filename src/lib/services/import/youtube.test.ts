import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { downloadAudio, type Runner, type RunnerResult } from './youtube';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-issue9-vid';
const URL = 'https://www.youtube.com/watch?v=test9';

function audioPath(id: string): string {
  return path.join(BASE, id, 'audio.mp3');
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
