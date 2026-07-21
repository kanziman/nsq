import { test, expect } from '@playwright/test';
import type { Episode } from '../src/lib/types';

const MOCK_EPISODE: Episode = {
  id: 'vid123',
  title: 'E2E Shadowing Guide Podcast',
  duration: 320, // 5분 20초
  youtubeUrl: 'https://youtube.com/watch?v=vid123',
  addedAt: new Date().toISOString(),
  importState: {
    videoId: 'vid123',
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    updatedAt: new Date().toISOString(),
  },
};

test.describe('에피소드 목록 대시보드 UI E2E', () => {
  test('Empty State: 에피소드가 없을 때 안내 노출 및 임포트 이동', async ({
    page,
  }) => {
    // 목록 소스 Mock: 정적 매니페스트 /episodes/index.json (S2 #160) — 0개 반환
    await page.route('**/episodes/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // 대시보드 타이틀 확인 (DOM 부착 여부로 검증)
    await expect(
      page.getByRole('heading', { name: '내 에피소드 보드' }),
    ).toBeAttached({ timeout: 15000 });

    // Empty state 텍스트 확인
    await expect(page.getByText('등록된 에피소드가 없습니다.')).toBeAttached({
      timeout: 15000,
    });

    // 임포트하기 버튼을 눌렀을 때 /import 페이지로 라우팅 검증
    const importLink = page.getByRole('link', {
      name: '첫 에피소드 임포트하기',
    });
    await expect(importLink).toBeAttached();
    await importLink.dispatchEvent('click');

    await expect(page).toHaveURL(/\/import/, { timeout: 10000 });
  });

  test('삭제 상호작용: 모달 확인 후 삭제 완료 시 카드 소멸', async ({
    page,
  }) => {
    let deleteCalled = false;

    // 목록 소스 Mock: 정적 매니페스트 /episodes/index.json (S2 #160)
    // 완료 에피소드는 폴링하지 않아 마운트 시 1회만 fetch → 초기 목록만 제공하면 된다.
    // 삭제는 클라이언트에서 카드가 제거되고 재fetch하지 않는다.
    await page.route('**/episodes/index.json', async (route) => {
      const list = deleteCalled ? [] : [MOCK_EPISODE];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(list),
      });
    });

    // DELETE /api/episodes/[id] API Mock
    await page.route('**/api/episodes/vid123', async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // mock 에피소드 카드 노출 확인
    await expect(page.getByText('E2E Shadowing Guide Podcast')).toBeAttached({
      timeout: 15000,
    });

    // 1. 취소 흐름 검증
    const deleteBtn = page.getByRole('button', { name: '에피소드 삭제' });
    await deleteBtn.dispatchEvent('click');

    // 경고 다이얼로그 모달 오픈 확인
    await expect(page.getByText('에피소드를 삭제하시겠습니까?')).toBeAttached();

    // 취소 클릭
    const cancelBtn = page.getByRole('button', { name: '취소' });
    await cancelBtn.dispatchEvent('click');

    // 모달이 닫히고 에피소드는 삭제되지 않고 유지됨을 확인 (DOM에서 사라지는지 검증)
    await expect(
      page.getByText('에피소드를 삭제하시겠습니까?'),
    ).not.toBeAttached();
    await expect(page.getByText('E2E Shadowing Guide Podcast')).toBeAttached();

    // 2. 승인/삭제 성공 흐름 검증
    await deleteBtn.dispatchEvent('click');
    const confirmBtn = page.getByRole('button', { name: '삭제', exact: true });
    await confirmBtn.dispatchEvent('click');

    // 모달 및 카드가 최종적으로 DOM에서 제거됨을 검증
    await expect(
      page.getByText('에피소드를 삭제하시겠습니까?'),
    ).not.toBeAttached();
    await expect(
      page.getByText('E2E Shadowing Guide Podcast'),
    ).not.toBeAttached({ timeout: 10000 });
    expect(deleteCalled).toBe(true);
  });
});
