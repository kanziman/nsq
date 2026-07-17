import { extractVideoId } from '@/lib/utils/youtube';
import { getImportState, saveImportState } from '@/lib/services/episodes';
import { runImportPipeline } from '@/lib/services/import-pipeline';
import { isProductionDeploy } from '@/lib/utils/env';
import type { ImportState, LanguageCode, RetryStep } from '@/lib/types';

// 진행중으로 간주되어 중복 접수를 차단하는 상태들
const IN_PROGRESS: ImportState['status'][] = [
  'downloading',
  'processing_subtitles',
  'processing_transcript',
  'aligning',
  'building_sentences',
];

// retryStep 없이 들어온 신규 임포트를 409로 막아야 하는 상태들 (진행중 + 완료)
const BLOCKING_STATUSES = new Set<ImportState['status']>([
  ...IN_PROGRESS,
  'completed',
]);

// 에러 응답 표준 형태 헬퍼 (`{ error }` + 상태코드)
function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// 공백을 제외하고 실제 내용이 있는 문자열인지 검증 (필수 URL 필드 검증용)
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

// 지원 언어 (#124). 부재 시 'en'.
const SUPPORTED_LANGUAGES: readonly LanguageCode[] = ['en', 'ja'];

function isSupportedLanguage(value: unknown): value is LanguageCode {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

/**
 * GET /api/import?videoId= — import-state 조회 (모니터 폴링 소스).
 */
export async function GET(request: Request): Promise<Response> {
  const videoId = new URL(request.url).searchParams.get('videoId');
  if (!isNonEmptyString(videoId)) {
    return jsonError('videoId is required', 400);
  }
  const state = await getImportState(videoId);
  if (!state) {
    return jsonError(`No import state for ${videoId}`, 404);
  }
  return Response.json(state, { status: 200 });
}

/**
 * POST /api/import — 임포트 접수·검증·초기 상태 생성 라우트.
 */
export async function POST(request: Request): Promise<Response> {
  // 0. 임포트는 로컬 개발 환경 전용 — 배포(Vercel)에서는 차단한다(#162).
  if (isProductionDeploy()) {
    return jsonError('임포트는 로컬 개발 환경에서만 동작합니다.', 403);
  }

  // 1. JSON 바디 파싱 → 실패 시 400
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  try {
    const { youtubeUrl, transcriptUrl, language, retryStep } = (body ?? {}) as {
      youtubeUrl?: unknown;
      transcriptUrl?: unknown;
      language?: unknown;
      retryStep?: RetryStep;
    };

    // 2. youtubeUrl·language·transcriptUrl 검증 → 실패 시 400
    if (!isNonEmptyString(youtubeUrl)) {
      return jsonError('youtubeUrl is required', 400);
    }
    if (language !== undefined && !isSupportedLanguage(language)) {
      return jsonError(`Unsupported language: ${String(language)}`, 400);
    }
    const lang: LanguageCode = isSupportedLanguage(language) ? language : 'en';
    // transcriptUrl은 선택(#124): 문자열이 아니면 400, 공백이면 부재(자막 전용 모드) 취급.
    if (transcriptUrl !== undefined && typeof transcriptUrl !== 'string') {
      return jsonError('transcriptUrl must be a string', 400);
    }
    const transcript = isNonEmptyString(transcriptUrl)
      ? transcriptUrl
      : undefined;
    // ja는 대본 정합 미지원 — 자막 전용 모드만 허용.
    if (lang === 'ja' && transcript) {
      return jsonError(
        "language 'ja' does not support transcript alignment; omit transcriptUrl",
        400,
      );
    }
    // sentences 재시도는 자막 전용 임포트 전용 — transcriptUrl과 함께 오면
    // 파이프라인이 아무 것도 재구성하지 않고 completed로 끝나므로 접수 자체를 차단(#125).
    if (retryStep === 'sentences' && transcript) {
      return jsonError(
        "retryStep 'sentences' applies to subtitle-only imports; omit transcriptUrl",
        400,
      );
    }

    // 3. videoId 추출 → null이면 400 (상태 파일 생성 안 함)
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return jsonError('Could not extract a videoId from youtubeUrl', 400);
    }

    // 4. 중복 검사 (retryStep 없을 때만)
    if (!retryStep) {
      const existing = await getImportState(videoId);
      if (existing && BLOCKING_STATUSES.has(existing.status)) {
        return Response.json(
          {
            error: `Import for ${videoId} is already ${existing.status}`,
            videoId,
            status: existing.status,
          },
          { status: 409 },
        );
      }
    }

    // 5. 초기 import-state.json 기록
    const state: ImportState = {
      videoId,
      status: 'downloading',
      progress: 0,
      currentStep: 'download',
      youtubeUrl,
      language: lang,
      updatedAt: new Date().toISOString(),
    };
    if (transcript) state.transcriptUrl = transcript;
    await saveImportState(videoId, state);

    // 6. 파이프라인을 await 없이 호출 (fire-and-forget)
    void runImportPipeline(videoId, {
      youtubeUrl,
      transcriptUrl: transcript,
      language: lang,
      retryStep,
    }).catch(() => {
      /* 백그라운드 실패는 import-state.json에 기록되므로 여기서는 무시 */
    });

    // 7. 202 반환
    return Response.json({ videoId, status: 'downloading' }, { status: 202 });
  } catch (err) {
    // 8. 예기치 못한 예외 → 500
    const message =
      err instanceof Error ? err.message : 'Internal Server Error';
    return jsonError(message, 500);
  }
}
