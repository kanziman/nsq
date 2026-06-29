# Issue #25 — [import-ui] Issue 4 — 완료 흐름 마감 + 전체 E2E

> 아키텍처: 시나리오 A. 선행: #22·#23·#24. import-ui 마지막 이슈.

## 1. 시그니처 (확정)

### 1-1. `components/import/ImportMonitor.tsx` — 완료 후 액션

```ts
export interface ImportMonitorProps {
  videoId: string;
  onNewImport?: () => void; // '새 임포트' 클릭 시 호출(페이지가 URL videoId 제거)
}
```

- `status === 'completed'` 블록에 두 액션을 추가한다:
  - **'새 임포트'** 버튼 → `onClick={onNewImport}`. 페이지가 `router.replace('/import')`로
    URL의 `videoId` 쿼리를 제거 → `useSearchParams` videoId=null → 폼이 새로 마운트(초기화)된다.
  - **'에피소드 보기'** 버튼 → `disabled` placeholder(에피소드 화면은 범위 밖). 클릭 불가.

### 1-2. `app/import/page.tsx` — onNewImport 배선

```tsx
<ImportMonitor
  videoId={videoId}
  onNewImport={() => router.replace('/import')}
/>
```

### 1-3. `e2e/import.spec.ts` (Playwright) — 전체 흐름 결정적 검증

`page.route('**/api/import**', ...)`로 GET/POST를 결정적으로 모킹한다.

- **해피패스**: `/import` 진입 → 두 URL 입력 → 제출(POST 202) → GET 폴링이
  `downloading`→…→`completed`(matchRate) 순차 반환 → 4단계 타임라인 완료 + matchRate 표시.
- **재시도 경로**: GET이 `failed`(currentStep=alignment) 반환 → [대본·정합 재시도] 클릭 →
  POST(retryStep=transcript) 재접수 → GET이 `completed` 반환 → 모니터 재시작·완료.

---

## 2. 테스트 시나리오

### `ImportMonitor` 완료 액션 (Vitest 유닛)

- [x] [정상] ImportMonitor — should render '새 임포트' and '에피소드 보기' buttons when status is 'completed'
- [x] [정상] ImportMonitor — should call onNewImport when '새 임포트' is clicked
- [x] [경계] ImportMonitor — should render '에피소드 보기' as a disabled placeholder (not clickable)
- [x] [경계] ImportMonitor — should not render '새 임포트'/'에피소드 보기' when status is not 'completed'

### `ImportPage` 배선 (Vitest 유닛)

- [x] [정상] ImportPage — should router.replace('/import') (drop videoId query) when monitor's onNewImport fires

### `e2e/import.spec.ts` (Playwright)

- [x] [정상] import happy path — should complete the 4-step timeline and show matchRate when polling reaches completed
- [x] [정상] import retry path — should re-accept with mapped retryStep and restart the monitor from a failed state

---

## 3. AC 교차 대조

| AC                                                         | 커버 시나리오                                           |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| completed·'새 임포트' 클릭 → 폼 초기화 + videoId 쿼리 제거 | onNewImport 호출 + ImportPage router.replace('/import') |
| completed·'에피소드 보기' 비활성 placeholder               | disabled placeholder 시나리오                           |
| E2E 제출→폴링→completed: 타임라인 완료 + matchRate         | e2e happy path                                          |
| E2E failed→재시도: retryStep 재접수 + 재시작               | e2e retry path                                          |
