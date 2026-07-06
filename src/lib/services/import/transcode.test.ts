import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  detectMp3Mode,
  needsTranscode,
  transcodeToCbrInPlace,
} from './transcode';

const tmpDirs: string[] = [];
async function mkTmp(): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'transcode-'));
  tmpDirs.push(d);
  return d;
}
afterEach(async () => {
  for (const d of tmpDirs.splice(0)) {
    await fs.rm(d, { recursive: true, force: true });
  }
});

// mp3 첫 프레임 태그를 흉내낸 헤더 버퍼(앞쪽 패딩 + 태그).
function head(tag: 'Xing' | 'Info' | 'none'): Buffer {
  const buf = Buffer.alloc(64, 0);
  if (tag !== 'none') buf.write(tag, 36, 'latin1');
  return buf;
}

describe('detectMp3Mode', () => {
  it('[정상] should detect Xing (VBR)', () => {
    expect(detectMp3Mode(head('Xing'))).toBe('Xing');
  });
  it('[정상] should detect Info (CBR)', () => {
    expect(detectMp3Mode(head('Info'))).toBe('Info');
  });
  it('[경계] should return unknown when no tag present', () => {
    expect(detectMp3Mode(head('none'))).toBe('unknown');
  });
});

describe('needsTranscode', () => {
  it('[정상] should be true for a VBR (Xing) file', async () => {
    const d = await mkTmp();
    const f = path.join(d, 'a.mp3');
    await fs.writeFile(f, head('Xing'));
    expect(await needsTranscode(f)).toBe(true);
  });
  it('[경계] should be false for a CBR (Info) file', async () => {
    const d = await mkTmp();
    const f = path.join(d, 'a.mp3');
    await fs.writeFile(f, head('Info'));
    expect(await needsTranscode(f)).toBe(false);
  });
});

describe('transcodeToCbrInPlace', () => {
  it('[정상] should run ffmpeg with strict CBR args and replace the file (AC1)', async () => {
    const d = await mkTmp();
    const f = path.join(d, 'audio.mp3');
    await fs.writeFile(f, head('Xing'));
    const runner = vi.fn(async (_cmd: string, args: string[]) => {
      // ffmpeg 성공을 흉내: 마지막 인자(임시 출력)를 생성.
      await fs.writeFile(args[args.length - 1], 'CBR');
      return { code: 0, stderr: '' };
    });
    await transcodeToCbrInPlace(f, runner);
    const args = runner.mock.calls[0][1];
    expect(args).toEqual(
      expect.arrayContaining([
        '-b:a',
        '192k',
        '-minrate',
        '192k',
        '-maxrate',
        '192k',
      ]),
    );
    expect(await fs.readFile(f, 'utf-8')).toBe('CBR'); // 제자리 교체됨
  });

  it('[경계] should skip when the file is already CBR (Info) (AC2)', async () => {
    const d = await mkTmp();
    const f = path.join(d, 'audio.mp3');
    await fs.writeFile(f, head('Info'));
    const runner = vi.fn(async () => ({ code: 0, stderr: '' }));
    await transcodeToCbrInPlace(f, runner);
    expect(runner).not.toHaveBeenCalled();
  });

  it('[예외] should throw and clean up the temp file when ffmpeg fails (AC3)', async () => {
    const d = await mkTmp();
    const f = path.join(d, 'audio.mp3');
    await fs.writeFile(f, head('Xing'));
    const runner = vi.fn(async (_cmd: string, args: string[]) => {
      await fs.writeFile(args[args.length - 1], 'PARTIAL');
      return { code: 1, stderr: 'boom' };
    });
    await expect(transcodeToCbrInPlace(f, runner)).rejects.toThrow();
    // 원본 보존 + 임시 파일 정리
    expect(await fs.readFile(f, 'latin1')).toContain('Xing');
    const leftovers = (await fs.readdir(d)).filter((n) => n !== 'audio.mp3');
    expect(leftovers).toEqual([]);
  });
});
