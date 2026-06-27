/**
 * 임포트 파이프라인의 YouTube(yt-dlp) 단계 모듈.
 * download → audio.mp3, subtitle → subtitle.en.vtt 산출.
 *
 * downloadAudio·fetchSubtitle 모두 주입형 runner(#9 확립)로 yt-dlp 실행.
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

// 파일 존재 여부 확인 헬퍼.
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 실행할 yt-dlp 바이너리 경로 해석. YT_DLP_PATH 우선, 미설정 시 기본 'yt-dlp'.
function resolveYtDlpCommand(): string {
  return process.env.YT_DLP_PATH || DEFAULT_YT_DLP;
}

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

  const command = resolveYtDlpCommand();
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

  if (!(await fileExists(outputPath))) {
    throw new Error(
      `yt-dlp exited 0 but expected artifact not found: ${outputPath}`,
    );
  }
}

export async function fetchSubtitle(
  videoId: string,
  youtubeUrl: string,
  runner: Runner = defaultRunner,
): Promise<void> {
  const outDir = path.join(EPISODES_DIR, videoId);
  const outputPath = path.join(outDir, 'subtitle.en.vtt');
  const outputTemplate = path.join(outDir, 'subtitle.%(ext)s');
  await fs.mkdir(outDir, { recursive: true });
  // 멱등 재생성 + 수동/자동 산출 판별 정확성을 위해 기존 파일 제거.
  await fs.rm(outputPath, { force: true });

  const command = resolveYtDlpCommand();
  const commonArgs = [
    '--sub-langs',
    'en',
    '--sub-format',
    'vtt',
    '--convert-subs',
    'vtt',
    '--skip-download',
    '--force-overwrites',
    '-o',
    outputTemplate,
    youtubeUrl,
  ];

  // 수동 자막 우선 → 산출 없으면 자동생성 폴백. 판단은 파일 존재 여부로 한다.
  const manual = await runner(command, ['--write-subs', ...commonArgs]);
  if (await fileExists(outputPath)) return;

  const auto = await runner(command, ['--write-auto-subs', ...commonArgs]);
  if (await fileExists(outputPath)) return;

  const stderr = auto.stderr || manual.stderr;
  throw new Error(
    `yt-dlp produced no subtitle (manual+auto): ${stderr.slice(-STDERR_TAIL_LEN)}`,
  );
}
