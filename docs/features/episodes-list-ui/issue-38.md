# Issue 38 — 에피소드 대시보드 및 리스트 페이지 구조화 (src/app/page.tsx)

## 1. 확정된 시그니처 (Signatures)

### 📂 파일 경로: `src/app/page.tsx` (Server Page Entry)

```tsx
import EpisodeDashboard from '@/components/episode/EpisodeDashboard';

export default function Page(): JSX.Element;
```

### 📂 파일 경로: `src/components/episode/EpisodeDashboard.tsx` (Client Component)

```tsx
'use client';

/**
 * EpisodeDashboard
 * 에피소드 목록 대시보드 메인 클라이언트 컴포넌트.
 * 로딩(스켈레톤), 에러 처리, Empty State 및 조건부 폴링 라이프사이클을 가집니다.
 */
export default function EpisodeDashboard(): JSX.Element;
```

---

## 2. 테스트 시나리오 (Test Scenarios)

### 정상 (Normal)

- **`[정상] EpisodeDashboard — should render skeleton while fetching episodes initially`**
  - _조건:_ 컴포넌트가 처음 마운트되어 API 요청이 완료되기 전.
  - _결과:_ 대시보드 레이아웃과 함께 스켈레톤(Skeleton) 카드들이 렌더링된다.
- **`[정상] EpisodeDashboard — should render empty state with link to /import when no episodes exist`**
  - _조건:_ API 조회 결과가 빈 배열 `[]`인 경우.
  - _결과:_ "등록된 에피소드가 없습니다" 안내와 임포트 페이지(`/import`) 이동 버튼이 중앙에 렌더링된다.
- **`[정상] EpisodeDashboard — should render episode cards when episodes exist`**
  - _조건:_ API 조회 결과 완료 또는 진행 중인 에피소드 목록이 반환된 경우.
  - _결과:_ 조회된 에피소드 카드(EpisodeCard)들이 그리드 형태로 렌더링된다.
- **`[정상] EpisodeDashboard — should start polling interval when at least one episode is in progress`**
  - _조건:_ 에피소드 목록 중 `importState.status === 'downloading'` 등 진행 중 상태인 항목이 존재할 때.
  - _결과:_ 3초마다 `/api/episodes` API를 호출하는 `setInterval` 타이머가 기동된다.
- **`[정상] EpisodeDashboard — should stop polling interval when all episodes transition to completed/failed`**
  - _조건:_ 폴링 중 모든 에피소드의 `status`가 완료(`completed`) 또는 실패(`failed`) 상태로 변환되었을 때.
  - _결과:_ 실행 중이던 폴링 타이머가 클리어(`clearInterval`)된다.

### 예외 (Exception)

- **`[예외] EpisodeDashboard — should render error state with retry button when API request fails`**
  - _조건:_ `/api/episodes` API 요청이 500 에러 등으로 실패하거나 네트워크 단절 시.
  - _결과:_ 에러 정보 카드와 함께 다시 시도할 수 있는 "다시 시도" 버튼이 화면에 제공된다.
