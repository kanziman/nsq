import fs from 'fs/promises';
import path from 'path';
import { ImportState, LanguageCode, RetryStep } from '@/lib/types';
import { saveImportState } from './episodes';
import {
  downloadAudio,
  fetchSubtitle,
  writeEpisodeMeta,
} from './import/youtube';
import { fetchTranscript } from './import/transcript';
import { alignTranscript } from './import/alignment';
import { buildCueSegments } from './import/cue-segments';
import {
  buildSentences,
  createOpenRouterSentenceBuilder,
} from './import/sentence-builder';
import { translate, createOpenRouterTranslator } from './import/translation';

/**
 * 임포트 파이프라인의 단계(step) 모듈 계약.
 * 각 step의 산출 아티펙트는 .shadowing/episodes/{videoId}/ 하위에 기록된다.
 * 실제 구현(yt-dlp·스크래핑·정합)은 각각 별도 태스크.
 */
export interface PipelineSteps {
  /** download: youtubeUrl → audio.mp3 */
  downloadAudio(videoId: string, youtubeUrl: string): Promise<void>;
  /** subtitle: youtubeUrl → subtitle.{lang}.vtt */
  fetchSubtitle(
    videoId: string,
    youtubeUrl: string,
    lang: LanguageCode,
  ): Promise<void>;
  /** transcript: transcriptUrl → transcript.txt */
  fetchTranscript(videoId: string, transcriptUrl: string): Promise<void>;
  /** alignment: subtitle.en.vtt + transcript.txt → segments.json, matchRate 반환 */
  alignTranscript(videoId: string): Promise<{ matchRate: number }>;
  /** segments(자막 전용 모드): subtitle.{lang}.vtt → 큐 단위 segments.json */
  buildCueSegments?(videoId: string, lang: LanguageCode): Promise<void>;
  /** sentences(자막 전용 모드): 큐 segments.json → 문장 단위 재구성 (best-effort) */
  buildSentences?(videoId: string): Promise<void>;
  /** translation: segments.json의 text → 한국어 translation 주입 (best-effort, 언어 라우팅 #126) */
  translate?(videoId: string, language: LanguageCode): Promise<void>;
  /** meta: youtubeUrl → meta.json (best-effort, 실패해도 임포트 완료 유지) */
  fetchMeta?(
    videoId: string,
    youtubeUrl: string,
    language: LanguageCode,
  ): Promise<void>;
}

// matchRate가 이 값 이상이면 정합 성공 (spec-fixed §5 / CLAUDE.md 정책)
const MATCH_RATE_THRESHOLD = 0.85;

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

// retryStep별 재사용(사전 존재 필요) 아티펙트 — spec-fixed §3-3.
// sentences는 자막 파일명이 언어에 따라 달라 language 인자를 받는다(#125).
function requiredReuse(plan: string, language: LanguageCode): string[] {
  switch (plan) {
    case 'transcript':
      return ['audio.mp3', 'subtitle.en.vtt'];
    case 'subtitles':
      return ['audio.mp3', 'transcript.txt'];
    case 'sentences':
      return [`subtitle.${language}.vtt`];
    case 'translation':
      return ['segments.json'];
    default:
      return [];
  }
}

// retryStep별 첫 실행 단계 (재사용 아티펙트 누락 시 currentStep)
const FIRST_STEP: Record<string, string> = {
  all: 'download',
  transcript: 'transcript',
  subtitles: 'subtitle',
  sentences: 'segments',
  translation: 'translation',
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
  language: LanguageCode,
): Promise<string | null> {
  for (const artifact of requiredReuse(plan, language)) {
    if (!(await artifactExists(videoId, artifact))) return artifact;
  }
  return null;
}

// 기본 번역 스텝: 환경변수 기반 OpenRouter 번역기로 segments.json을 채운다.
// 키가 없으면 배치 호출이 throw되고 translate가 배치별로 흡수해 no-op이 된다(best-effort).
async function translateStep(
  videoId: string,
  language: LanguageCode,
): Promise<void> {
  const translator = createOpenRouterTranslator(
    { apiKey: process.env.OPENROUTER_API_KEY ?? '' },
    language,
  );
  await translate(videoId, { translator });
}

// 기본 문장 복원 스텝: 환경변수 기반 OpenRouter 빌더로 큐 세그먼트를 문장 단위로 재구성.
// 키가 없으면 배치 호출이 throw되고 buildSentences가 배치별로 흡수해 큐 폴백이 유지된다.
async function buildSentencesStep(videoId: string): Promise<void> {
  const builder = createOpenRouterSentenceBuilder({
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
  });
  await buildSentences(videoId, { builder });
}

// steps 미주입 시 사용하는 실제 단계 모듈
const defaultSteps: PipelineSteps = {
  downloadAudio,
  fetchSubtitle,
  fetchTranscript,
  alignTranscript,
  buildCueSegments,
  buildSentences: buildSentencesStep,
  translate: translateStep,
  fetchMeta: writeEpisodeMeta,
};

async function writeState(
  videoId: string,
  status: ImportState['status'],
  currentStep: string,
  progress: number,
  error?: string,
  matchRate?: number,
  urls?: {
    youtubeUrl: string;
    transcriptUrl?: string;
    language: LanguageCode;
  },
): Promise<void> {
  const state: ImportState = {
    videoId,
    status,
    progress,
    currentStep,
    updatedAt: new Date().toISOString(),
  };
  if (error !== undefined) state.error = error;
  if (matchRate !== undefined) state.matchRate = matchRate;
  // 재시도 컨텍스트(#24·#124): 모든 상태 쓰기에서 접수 URL·language를 보존해
  // failed에서도 재접수 가능.
  if (urls) {
    state.youtubeUrl = urls.youtubeUrl;
    if (urls.transcriptUrl !== undefined) {
      state.transcriptUrl = urls.transcriptUrl;
    }
    state.language = urls.language;
  }
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
  urls: {
    youtubeUrl: string;
    transcriptUrl?: string;
    language?: LanguageCode;
    retryStep?: RetryStep;
  },
  steps: PipelineSteps = defaultSteps,
): Promise<void> {
  const { youtubeUrl, retryStep } = urls;
  const language = urls.language ?? 'en';
  // 공백/빈 문자열 transcriptUrl은 부재로 취급 → 자막 전용(subtitle-only) 모드 (#124)
  const transcriptUrl = urls.transcriptUrl?.trim()
    ? urls.transcriptUrl
    : undefined;
  const subtitleOnly = transcriptUrl === undefined;
  const plan = retryStep ?? 'all';
  let currentStep = FIRST_STEP[plan];
  let progress = 0;

  // 모든 상태 쓰기에서 접수 URL·language를 보존하는 로컬 래퍼 (#24·#124)
  const write = (
    status: ImportState['status'],
    step: string,
    prog: number,
    error?: string,
    matchRate?: number,
  ): Promise<void> =>
    writeState(videoId, status, step, prog, error, matchRate, {
      youtubeUrl,
      transcriptUrl,
      language,
    });

  try {
    // 재사용 아티펙트 사전 검증 (AC4): 누락 시 어떤 단계도 실행하지 않고 failed
    const missing = await findMissingReusedArtifact(videoId, plan, language);
    if (missing) {
      await write(
        'failed',
        currentStep,
        progress,
        `Cannot retry '${retryStep}': missing reused artifact '${missing}'`,
      );
      return;
    }

    // retryStep(plan)에 따라 실행할 단계 결정.
    // translation 재시도는 정합 산출물(segments.json)을 재사용하므로 alignment까지 건너뛰고
    // 번역만 실행한다. 자막 전용 모드는 transcript·alignment 대신 큐 세그먼트를 생성한다(#124).
    const runDownload = plan === 'all';
    const runSubtitle = runDownload || plan === 'subtitles';
    const runTranscript =
      (runDownload || plan === 'transcript') && !subtitleOnly;
    const runAlignment =
      plan !== 'translation' && plan !== 'sentences' && !subtitleOnly;
    const runCueSegments = plan !== 'translation' && subtitleOnly;
    const runSentences = plan !== 'translation' && subtitleOnly;

    if (runDownload) {
      currentStep = 'download';
      progress = 10;
      await write('downloading', currentStep, progress);
      await steps.downloadAudio(videoId, youtubeUrl);
    }

    if (runSubtitle) {
      currentStep = 'subtitle';
      progress = 40;
      await write('processing_subtitles', currentStep, progress);
      await steps.fetchSubtitle(videoId, youtubeUrl, language);
    }

    if (runTranscript && transcriptUrl) {
      currentStep = 'transcript';
      progress = 70;
      await write('processing_transcript', currentStep, progress);
      await steps.fetchTranscript(videoId, transcriptUrl);
    }

    let matchRate: number | undefined;
    if (runAlignment) {
      currentStep = 'alignment';
      progress = 90;
      await write('aligning', currentStep, progress);
      const result = await steps.alignTranscript(videoId);
      matchRate = result.matchRate;

      if (matchRate < MATCH_RATE_THRESHOLD) {
        await write(
          'failed',
          currentStep,
          progress,
          `matchRate ${matchRate} < ${MATCH_RATE_THRESHOLD}`,
          matchRate,
        );
        return;
      }
    }

    // 자막 전용 모드: 큐 단위 세그먼트 생성(필수 단계 — 실패 시 failed).
    // 상태 슬롯은 'aligning'을 재사용한다(모드별 모니터 라벨 정비는 #125).
    if (runCueSegments) {
      currentStep = 'segments';
      progress = 90;
      await write('aligning', currentStep, progress);
      await steps.buildCueSegments?.(videoId, language);
    }

    // 문장 복원(LLM 병합·구두점)은 best-effort — 실패해도 큐 세그먼트 폴백으로 완주(#125).
    if (runSentences) {
      currentStep = 'sentences';
      progress = 92;
      await write('building_sentences', currentStep, progress);
      try {
        await steps.buildSentences?.(videoId);
      } catch (err) {
        // 폴백: 큐 세그먼트 그대로 재생·학습 가능. retryStep 'sentences'로 재실행 가능.
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`sentence-builder: step failed (${message}), kept cues`);
      }
    }

    // 번역(한국어 translation 주입)은 best-effort — 실패해도 임포트 완료를 막지 않는다.
    // segments.json을 입력으로 하며, translation 재시도 시엔 이 단계만 실행된다.
    currentStep = 'translation';
    progress = 95;
    await write('translating', currentStep, progress, undefined, matchRate);
    try {
      await steps.translate?.(videoId, language);
    } catch {
      // 폴백: 번역 없이도 재생·정합은 정상. 이후 retryStep 'translation'으로 보충 가능.
    }

    // 메타(제목·재생시간·썸네일)는 best-effort — 실패해도 임포트 완료를 막지 않는다 (#74 AC3).
    try {
      await steps.fetchMeta?.(videoId, youtubeUrl, language);
    } catch {
      // 폴백: meta.json 없이도 episodes.ts가 status 기반으로 안전 처리.
    }

    await write('completed', 'completed', 100, undefined, matchRate);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await write('failed', currentStep, progress, message);
  }
}
