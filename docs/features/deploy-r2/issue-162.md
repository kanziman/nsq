# Issue #162: [deploy S3] Production 임포트 가드 및 로컬/배포 조회 이중성 정리

부모: #157 (배포 전략 전환 — R2 하이브리드)의 수직 슬라이스 S3.

배포본(Vercel)에서는 조회/학습만 제공하고 임포트 진입점을 차단한다. S2에서 조회를
`public/episodes`로 옮기며 생긴 로컬 임포트(`.shadowing`) 관련 회귀를 정리한다.

## 1. 구현 대상 (시그니처 및 변경)

### `src/lib/utils/env.ts` (신규)

```ts
/**
 * Vercel(배포) 런타임 여부. 임포트/삭제/폴링 등 로컬 전용 동작 차단에 사용.
 * Vercel은 배포 런타임에 환경변수 VERCEL=1을 주입한다.
 * 서버 컴포넌트·API 라우트에서만 호출한다(클라이언트에는 boolean prop으로 주입).
 */
export function isProductionDeploy(): boolean; // return process.env.VERCEL === '1'
```

### `src/lib/services/episodes.ts`

```ts
export const WRITE_BASE = path.join(process.cwd(), '.shadowing', 'episodes');
// 기존 module-private const → export. DELETE 라우트가 로컬 작업본 존재확인에 사용.
```

- 시그니처 변경 없음. `WRITE_BASE`만 export로 승격.

### `src/app/page.tsx` (서버 컴포넌트)

```ts
export default function HomePage(): React.ReactElement;
// const isLocal = !isProductionDeploy();
// - isLocal일 때만 '임포트하기' <Link> 렌더
// - <EpisodeDashboard isLocal={isLocal} />
```

### `src/components/episode/EpisodeDashboard.tsx`

```ts
export default function EpisodeDashboard(
  props: { isLocal?: boolean }, // 기본 false(배포 안전측)
): React.ReactElement;
```

- `!isLocal`(배포): 3초 진행률 폴링 effect를 건너뛰고, 삭제 핸들러를 카드에 넘기지 않는다.
- `isLocal`(로컬): 기존 폴링·삭제 동작 유지.
- `EpisodeCard`에 `onDelete={isLocal ? handleCardDelete : undefined}`.

### `src/components/episode/EpisodeCard.tsx`

```ts
export default function EpisodeCard(props: {
  episode: Episode;
  onDelete?: (_id: string) => Promise<void>; // 필수 → 선택
}): React.ReactElement;
```

- `onDelete` 부재 시 삭제 버튼(및 확인 모달)을 렌더하지 않는다.

### `src/app/import/page.tsx` (서버 가드 + 클라이언트 분리)

```ts
export default function ImportPage(): React.ReactElement;
// isProductionDeploy() → "임포트는 로컬 개발 환경에서만 동작합니다" 안내 화면
// else → <ImportClient /> (기존 폼/모니터 UI)
```

- 기존 `'use client'` 로직은 `src/components/import/ImportClient.tsx`(신규, client)로 이동.

### `src/app/api/import/route.ts`

```ts
export async function POST(request: Request): Promise<Response>;
// 맨 앞: isProductionDeploy() → 403 { error: '임포트는 로컬 개발 환경에서만 동작합니다.' }
```

- GET(모니터 폴링)은 배포에서 도달 경로 없음(페이지 가드) → 변경 없음.

### `src/app/api/episodes/[id]/route.ts` (DELETE 회귀 수정)

```ts
export async function DELETE(request, context): Promise<Response>;
// 존재확인 소스를 로컬 작업본으로 명시:
//   const episode = await getEpisodeById(id, WRITE_BASE);
```

- publish 전 `.shadowing` 전용 에피소드 삭제 시 404 방지(AC3).

### `src/app/episodes/[id]/page.tsx` (AC4 — import-state 의존 해소)

```ts
// 정책 (b): public에 import-state 부재 = '완료'로 간주.
if (
  !episode ||
  segments.length === 0 ||
  (episode.importState && episode.importState.status !== 'completed')
) {
  redirect('/');
}
```

- importState 부재 → redirect 하지 않음(기존 `[경계]` 테스트 반전).
- importState 존재 & 미완료(로컬 진행중) → 기존대로 redirect.

## 2. 테스트 시나리오 (전 항목 Green — 68/68 통과)

### `isProductionDeploy` (env.ts)

- [정상] isProductionDeploy — should return true when process.env.VERCEL === '1'
- [정상] isProductionDeploy — should return false when process.env.VERCEL is undefined
- [경계] isProductionDeploy — should return false when process.env.VERCEL === '0'

### `EpisodeDashboard` (isLocal prop)

- [정상] EpisodeDashboard — should render '임포트하기'/delete affordance and poll when isLocal is true
- [정상] EpisodeDashboard — should NOT set up 3s polling interval when isLocal is false and an episode is in progress
- [정상] EpisodeDashboard — should pass onDelete to EpisodeCard when isLocal is true
- [예외] EpisodeDashboard — should not pass onDelete (no delete button) when isLocal is false

### `EpisodeCard` (optional onDelete)

- [정상] EpisodeCard — should render delete button when onDelete is provided
- [예외] EpisodeCard — should not render delete button when onDelete is undefined

### `HomePage` (page.tsx)

- [정상] HomePage — should render '임포트하기' link when not production deploy
- [예외] HomePage — should not render '임포트하기' link when production deploy

### `ImportPage` (import guard)

- [정상] ImportPage — should render import client UI when not production deploy
- [예외] ImportPage — should render local-only notice when production deploy

### `POST /api/import` (route guard)

- [정상] POST /api/import — should accept import (202) when not production deploy
- [예외] POST /api/import — should return 403 with notice when production deploy

### `DELETE /api/episodes/[id]` (WRITE_BASE 존재확인)

- [정상] DELETE — should look up episode via WRITE_BASE and delete (200) for .shadowing-only episode
- [예외] DELETE — should return 404 when episode absent in WRITE_BASE
- [예외] DELETE — should return 409 when import in progress (regression guard)

### `EpisodePlayerPage` (AC4)

- [정상] EpisodePlayerPage — should render player when importState is undefined but segments exist (반전)
- [정상] EpisodePlayerPage — should render player when status completed and segments exist
- [예외] EpisodePlayerPage — should redirect when importState exists and status !== completed
- [경계] EpisodePlayerPage — should redirect when segments.length === 0
- [예외] EpisodePlayerPage — should redirect when episode is null

## 3. AC 교차 대조

- **AC1** (임포트 버튼 배포 숨김/로컬 노출) → HomePage 시나리오 2건
- **AC2** (/import·/api/import 배포 차단, 로컬 정상) → ImportPage 2건 + POST /api/import 2건
- **AC3** (임포트 직후 .shadowing 삭제 404 없음) → DELETE 시나리오 3건
- **AC4** (import-state 부재 상세 정상 렌더) → EpisodePlayerPage 반전 시나리오
- **AC5** (process.env 판정 + 로컬/배포 단위 테스트) → isProductionDeploy 3건 + 위 각 로컬/배포 분기 테스트
