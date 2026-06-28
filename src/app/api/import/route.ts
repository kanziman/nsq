import { extractVideoId } from '@/lib/utils/youtube';
import { getImportState, saveImportState } from '@/lib/services/episodes';
import { runImportPipeline } from '@/lib/services/import-pipeline';
import type { ImportState, RetryStep } from '@/lib/types';

// 진행중으로 간주되어 중복 접수를 차단하는 상태들
const IN_PROGRESS: ImportState['status'][] = [
  'downloading',
  'processing_subtitles',
  'processing_transcript',
  'aligning',
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
  // 1. JSON 바디 파싱 → 실패 시 400
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  try {
    const { youtubeUrl, transcriptUrl, retryStep } = (body ?? {}) as {
      youtubeUrl?: unknown;
      transcriptUrl?: unknown;
      retryStep?: RetryStep;
    };

    // 2. youtubeUrl·transcriptUrl 타입/빈값 검증 → 실패 시 400
    if (!isNonEmptyString(youtubeUrl)) {
      return jsonError('youtubeUrl is required', 400);
    }
    if (!isNonEmptyString(transcriptUrl)) {
      return jsonError('transcriptUrl is required', 400);
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
      updatedAt: new Date().toISOString(),
    };
    await saveImportState(videoId, state);

    // 6. 파이프라인을 await 없이 호출 (fire-and-forget)
    void runImportPipeline(videoId, {
      youtubeUrl,
      transcriptUrl,
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
