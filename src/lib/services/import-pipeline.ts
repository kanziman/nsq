import fs from 'fs/promises';
import path from 'path';
import { ImportState, RetryStep } from '../types';
import { saveImportState } from './episodes';
import { downloadAudio, fetchSubtitle } from './import/youtube';
import { fetchTranscript } from './import/transcript';
import { alignTranscript } from './import/alignment';

/**
 * 임포트 파이프라인의 단계(step) 모듈 계약.
 * 각 step의 산출 아티펙트는 .shadowing/episodes/{videoId}/ 하위에 기록된다.
 * 실제 구현(yt-dlp·스크래핑·정합)은 각각 별도 태스크.
 */
export interface PipelineSteps {
  /** download: youtubeUrl → audio.mp3 */
  downloadAudio(videoId: string, youtubeUrl: string): Promise<void>;
  /** subtitle: youtubeUrl → subtitle.en.vtt */
  fetchSubtitle(videoId: string, youtubeUrl: string): Promise<void>;
  /** transcript: transcriptUrl → transcript.txt */
  fetchTranscript(videoId: string, transcriptUrl: string): Promise<void>;
  /** alignment: subtitle.en.vtt + transcript.txt → segments.json, matchRate 반환 */
  alignTranscript(videoId: string): Promise<{ matchRate: number }>;
}

// matchRate가 이 값 이상이면 정합 성공 (spec-fixed §5 / CLAUDE.md 정책)
const MATCH_RATE_THRESHOLD = 0.85;

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

// retryStep별 재사용(사전 존재 필요) 아티펙트 — spec-fixed §3-3
const REQUIRED_REUSE: Record<string, string[]> = {
  all: [],
  transcript: ['audio.mp3', 'subtitle.en.vtt'],
  subtitles: ['audio.mp3', 'transcript.txt'],
};

// retryStep별 첫 실행 단계 (재사용 아티펙트 누락 시 currentStep)
const FIRST_STEP: Record<string, string> = {
  all: 'download',
  transcript: 'transcript',
  subtitles: 'subtitle',
};

async function artifactExists(videoId: string, name: string): Promise<boolean> {
  try {
    await fs.access(path.join(EPISODES_DIR, videoId, name));
    return true;
  } catch {
    return false;
  }
}

// retryStep(plan)이 재사용해야 하는 아티펙트 중 누락된 첫 파일명을 반환. 모두 있으면 null.
async function findMissingReusedArtifact(
  videoId: string,
  plan: string,
): Promise<string | null> {
  for (const artifact of REQUIRED_REUSE[plan]) {
    if (!(await artifactExists(videoId, artifact))) return artifact;
  }
  return null;
}

// steps 미주입 시 사용하는 실제 단계 모듈
const defaultSteps: PipelineSteps = {
  downloadAudio,
  fetchSubtitle,
  fetchTranscript,
  alignTranscript,
};

async function writeState(
  videoId: string,
  status: ImportState['status'],
  currentStep: string,
  progress: number,
  error?: string,
): Promise<void> {
  const state: ImportState = {
    videoId,
    status,
    progress,
    currentStep,
    updatedAt: new Date().toISOString(),
  };
  if (error !== undefined) state.error = error;
  await saveImportState(videoId, state);
}

/**
 * 임포트 파이프라인 오케스트레이터.
 * download → subtitle → transcript → alignment 순으로 진행하며 단계마다
 * import-state.json을 갱신한다. 단계 모듈은 테스트 더블 주입(DI) 가능.
 *
 * 실패(단계 throw 또는 matchRate < 0.85) 시 status: failed로 기록하고
 * 아티펙트는 유지한다(롤백 없음). fire-and-forget 호출 안전을 위해 재-throw하지 않는다.
 */
export async function runImportPipeline(
  videoId: string,
  urls: { youtubeUrl: string; transcriptUrl: string; retryStep?: RetryStep },
  steps: PipelineSteps = defaultSteps,
): Promise<void> {
  const { youtubeUrl, transcriptUrl, retryStep } = urls;
  const plan = retryStep ?? 'all';
  let currentStep = FIRST_STEP[plan];
  let progress = 0;

  try {
    // 재사용 아티펙트 사전 검증 (AC4): 누락 시 어떤 단계도 실행하지 않고 failed
    const missing = await findMissingReusedArtifact(videoId, plan);
    if (missing) {
      await writeState(
        videoId,
        'failed',
        currentStep,
        progress,
        `Cannot retry '${retryStep}': missing reused artifact '${missing}'`,
      );
      return;
    }

    // retryStep(plan)에 따라 실행할 단계 결정 (alignment는 항상 실행)
    const runDownload = plan === 'all';
    const runSubtitle = runDownload || plan === 'subtitles';
    const runTranscript = runDownload || plan === 'transcript';

    if (runDownload) {
      currentStep = 'download';
      progress = 10;
      await writeState(videoId, 'downloading', currentStep, progress);
      await steps.downloadAudio(videoId, youtubeUrl);
    }

    if (runSubtitle) {
      currentStep = 'subtitle';
      progress = 40;
      await writeState(videoId, 'processing_subtitles', currentStep, progress);
      await steps.fetchSubtitle(videoId, youtubeUrl);
    }

    if (runTranscript) {
      currentStep = 'transcript';
      progress = 70;
      await writeState(videoId, 'processing_transcript', currentStep, progress);
      await steps.fetchTranscript(videoId, transcriptUrl);
    }

    currentStep = 'alignment';
    progress = 90;
    await writeState(videoId, 'aligning', currentStep, progress);
    const { matchRate } = await steps.alignTranscript(videoId);

    if (matchRate < MATCH_RATE_THRESHOLD) {
      await writeState(
        videoId,
        'failed',
        currentStep,
        progress,
        `matchRate ${matchRate} < ${MATCH_RATE_THRESHOLD}`,
      );
      return;
    }

    await writeState(videoId, 'completed', 'completed', 100);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeState(videoId, 'failed', currentStep, progress, message);
  }
}
