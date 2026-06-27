/**
 * 임포트 파이프라인의 YouTube(yt-dlp) 단계 모듈.
 * download → audio.mp3, subtitle → subtitle.en.vtt 산출.
 *
 * downloadAudio: 구현 완료(주입형 runner). fetchSubtitle: 계약 스텁(별도 태스크).
 */
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/** 외부 프로세스(yt-dlp) 실행 결과. */
export interface RunnerResult {
  /** 프로세스 종료 코드 (0 = 정상). */
  code: number;
  /** 캡처된 표준 에러 (실패 진단용). */
  stderr: string;
}

/** 외부 프로세스 실행 추상. 기본 child_process.spawn 래퍼, 테스트는 fake 주입. */
export type Runner = (command: string, args: string[]) => Promise<RunnerResult>;

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');
const DEFAULT_YT_DLP = 'yt-dlp';
const DEFAULT_TIMEOUT_MS = 300_000;

// stderr 말미를 에러 메시지에 포함할 때 사용하는 최대 길이.
const STDERR_TAIL_LEN = 500;

// 기본 runner: child_process.spawn 래퍼. YT_DLP_TIMEOUT_MS 초과 시 프로세스 종료 후 throw.
const defaultRunner: Runner = (command, args) => {
  const timeoutMs = Number(process.env.YT_DLP_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  return new Promise<RunnerResult>((resolve, reject) => {
    const child = spawn(command, args);
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`yt-dlp timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
};

export async function downloadAudio(
  videoId: string,
  youtubeUrl: string,
  runner: Runner = defaultRunner,
): Promise<void> {
  const outDir = path.join(EPISODES_DIR, videoId);
  const outputPath = path.join(outDir, 'audio.mp3');
  await fs.mkdir(outDir, { recursive: true });

  const command = process.env.YT_DLP_PATH || DEFAULT_YT_DLP;
  const args = [
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--force-overwrites',
    '-o',
    outputPath,
    youtubeUrl,
  ];

  const { code, stderr } = await runner(command, args);
  if (code !== 0) {
    throw new Error(
      `yt-dlp failed (exit ${code}): ${stderr.slice(-STDERR_TAIL_LEN)}`,
    );
  }

  try {
    await fs.access(outputPath);
  } catch {
    throw new Error(
      `yt-dlp exited 0 but expected artifact not found: ${outputPath}`,
    );
  }
}

export async function fetchSubtitle(
  videoId: string,
  youtubeUrl: string,
): Promise<void> {
  throw new Error('Not implemented');
}
