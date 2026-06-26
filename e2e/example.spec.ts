import { test, expect } from '@playwright/test';

test('has title or heading', async ({ page }) => {
  await page.goto('/');

  // 이 프로젝트에 적절하게 타이틀이나 헤더가 렌더링되는지 확인합니다.
  const heading = page.locator('h1');
  if ((await heading.count()) > 0) {
    await expect(heading.first()).toBeVisible();
  } else {
    // <h1> 태그가 아직 홈 화면에 없으면 title을 확인합니다.
    await expect(page).toHaveTitle(/.+/);
  }
});
