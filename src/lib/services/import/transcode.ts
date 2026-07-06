/**
 * VBR mp3 → CBR 재인코딩(오디오 seek 정확도 보장).
 *
 * HTML5 Audio의 currentTime seek은 시간→바이트 변환에 Xing TOC(100엔트리)를 쓴다.
 * VBR mp3는 버킷 내부가 비선형이라 랜덤 seek(개별 클릭)이 수 초 어긋난다(연속 재생은 정확).
 * CBR은 byte = time × bitrate/8 이 선형이라 프레임 정확 seek이 된다.
 * 참고: docs/solutions/architecture/vbr-mp3-seek-drift.md (기존 해결 사례)
 */
import { spawn } from 'child_process';
import fs from 'fs/promises';
import { Runner } from './youtube';

const DEFAULT_FFMPEG = 'ffmpeg';
// CBR 목표 비트레이트. -minrate/-maxrate를 동일 고정해야 진짜 CBR이 강제된다.
const CBR_BITRATE = '192k';
const STDERR_TAIL_LEN = 500;
// mp3 첫 프레임 태그 판별을 위해 읽는 헤더 크기.
const HEAD_BYTES = 4096;

function resolveFfmpeg(): string {
  return process.env.FFMPEG_PATH || DEFAULT_FFMPEG;
}

// 기본 runner: child_process.spawn 래퍼(테스트는 fake 주입).
const defaultRunner: Runner = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });

export type Mp3Mode = 'Xing' | 'Info' | 'unknown';

/** mp3 첫 프레임의 VBR(Xing)/CBR(Info) 태그를 판별한다. */
export function detectMp3Mode(headBytes: Buffer): Mp3Mode {
  const s = headBytes.toString('latin1');
  const xing = s.indexOf('Xing');
  const info = s.indexOf('Info');
  if (xing >= 0 && (info < 0 || xing < info)) return 'Xing';
  if (info >= 0) return 'Info';
  return 'unknown';
}

/** 재인코딩이 필요한지(= 확정 VBR인지) 판별. */
export async function needsTranscode(filePath: string): Promise<boolean> {
  const fh = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    await fh.read(buf, 0, HEAD_BYTES, 0);
    return detectMp3Mode(buf) === 'Xing';
  } finally {
    await fh.close();
  }
}

/**
 * VBR mp3를 CBR 192k로 제자리 재인코딩한다. 이미 CBR이면(또는 비대상) 건너뛴다(멱등).
 * 실패 시 임시 파일을 정리하고 throw하여 원본을 보존한다.
 */
export async function transcodeToCbrInPlace(
  filePath: string,
  runner: Runner = defaultRunner,
): Promise<void> {
  if (!(await needsTranscode(filePath))) return;

  const tmp = `${filePath}.cbr.tmp.mp3`;
  const args = [
    '-y',
    '-i',
    filePath,
    '-c:a',
    'libmp3lame',
    '-b:a',
    CBR_BITRATE,
    '-minrate',
    CBR_BITRATE,
    '-maxrate',
    CBR_BITRATE,
    '-bufsize',
    CBR_BITRATE,
    '-vn',
    tmp,
  ];

  const { code, stderr } = await runner(resolveFfmpeg(), args);
  if (code !== 0) {
    await fs.rm(tmp, { force: true });
    throw new Error(
      `ffmpeg CBR transcode failed (exit ${code}): ${stderr.slice(-STDERR_TAIL_LEN)}`,
    );
  }
  await fs.rename(tmp, filePath);
}
