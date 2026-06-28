import { test, expect, type Route } from '@playwright/test';
import type { ImportState } from '../src/lib/types';

/**
 * import-ui 전체 흐름 E2E (#25).
 * GET/POST /api/import을 page.route로 결정적으로 모킹해 폴링·재시도 흐름을 검증한다.
 */

const YT = 'https://www.youtube.com/watch?v=e2evid';
const TR = 'https://freakonomics.com/podcast/e2e';

function state(partial: Partial<ImportState>): ImportState {
  return {
    videoId: 'e2evid',
    status: 'downloading',
    progress: 0,
    currentStep: 'download',
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test.describe('import-ui 전체 흐름', () => {
  test('해피패스: 제출 → 폴링 → completed 타임라인 완료 + matchRate', async ({
    page,
  }) => {
    // GET 폴링이 4단계를 순차로 거쳐 completed에 도달하도록 시퀀스를 반환.
    const sequence: ImportState[] = [
      state({ status: 'downloading', currentStep: 'download', progress: 10 }),
      state({
        status: 'processing_subtitles',
        currentStep: 'subtitle',
        progress: 40,
      }),
      state({
        status: 'processing_transcript',
        currentStep: 'transcript',
        progress: 70,
      }),
      state({
        status: 'completed',
        currentStep: 'completed',
        progress: 100,
        matchRate: 0.9,
      }),
    ];
    let getCalls = 0;

    await page.route('**/api/import**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        return fulfillJson(
          route,
          { videoId: 'e2evid', status: 'downloading' },
          202,
        );
      }
      // GET: 마지막 항목(completed)에서 고정
      const idx = Math.min(getCalls, sequence.length - 1);
      getCalls += 1;
      return fulfillJson(route, sequence[idx]);
    });

    await page.goto('/import');
    await page.getByLabel(/youtube/i).fill(YT);
    await page.getByLabel(/대본|transcript/i).fill(TR);
    await page.getByRole('button', { name: /임포트 시작/ }).click();

    // 4단계 타임라인이 순차로 완료된다. data-state='done'은 단조(sticky)이므로
    // 진행 순서대로 각 단계가 done에 도달하는지를 race 없이 검증한다.
    // exact:true로 타임라인 라벨(<li>)만 매칭(상태 라벨 '자막 처리 중' 등 제외).
    await expect(page.getByText('다운로드', { exact: true })).toHaveAttribute(
      'data-state',
      'done',
      { timeout: 10000 },
    );
    await expect(page.getByText('자막', { exact: true })).toHaveAttribute(
      'data-state',
      'done',
      { timeout: 10000 },
    );
    await expect(page.getByText('대본', { exact: true })).toHaveAttribute(
      'data-state',
      'done',
      { timeout: 10000 },
    );
    await expect(page.getByText('정합', { exact: true })).toHaveAttribute(
      'data-state',
      'done',
      { timeout: 15000 },
    );
    await expect(page.getByText(/정합 품질/)).toContainText('90%');
    await expect(page.getByRole('button', { name: '새 임포트' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: '에피소드 보기' }),
    ).toBeDisabled();
  });

  test('재시도: failed → 컨텍스트 재시도 → retryStep 재접수 → 모니터 재시작', async ({
    page,
  }) => {
    let retried = false;
    let postBody: Record<string, unknown> | null = null;

    await page.route('**/api/import**', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        postBody = req.postDataJSON();
        retried = true;
        return fulfillJson(
          route,
          { videoId: 'e2evid', status: 'downloading' },
          202,
        );
      }
      // 재시도 전: failed(정합 실패) / 재시도 후: completed
      if (!retried) {
        return fulfillJson(
          route,
          state({
            status: 'failed',
            currentStep: 'alignment',
            progress: 90,
            error: 'matchRate 0.5 < 0.85',
            matchRate: 0.5,
            youtubeUrl: YT,
            transcriptUrl: TR,
          }),
        );
      }
      return fulfillJson(
        route,
        state({
          status: 'completed',
          currentStep: 'completed',
          progress: 100,
          matchRate: 0.92,
        }),
      );
    });

    // 새로고침 복원 경로로 직접 진입(failed 상태 모니터)
    await page.goto('/import?videoId=e2evid');

    const retryButton = page.getByRole('button', { name: '대본·정합 재시도' });
    await expect(retryButton).toBeVisible({ timeout: 15000 });
    await retryButton.click();

    // 재접수: retryStep=transcript 로 POST
    await expect
      .poll(() => postBody?.retryStep, { timeout: 15000 })
      .toBe('transcript');

    // 모니터 재시작 후 completed 도달
    await expect(page.getByText(/정합 품질/)).toContainText('92%', {
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: '새 임포트' })).toBeVisible();
  });
});
