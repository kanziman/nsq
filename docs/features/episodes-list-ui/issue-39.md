# Issue 39 — 에피소드 카드 컴포넌트 (src/components/episode/EpisodeCard.tsx) 구현

## 1. 확정된 시그니처 (Signatures)

### 📂 파일 경로: `src/components/episode/EpisodeCard.tsx`

```tsx
import type { Episode } from '@/lib/types';

/**
 * EpisodeCard
 * 개별 에피소드의 정보를 렌더링하고, 임포트 상태(진행 중, 완료, 실패)에 따른 상호작용 및 UI 분기를 지원합니다.
 *
 * @param props { episode: Episode }
 */
export default function EpisodeCard({
  episode,
}: {
  episode: Episode;
}): React.ReactNode;
```

---

## 2. 테스트 시나리오 (Test Scenarios)

### 정상 (Normal)

- **`[정상] EpisodeCard — should render title, thumbnail and duration when status is completed`**
  - _조건:_ 에피소드가 완료(`completed`) 상태인 경우.
  - _결과:_ 썸네일(YouTube thumbnail), 에피소드 제목, 재생 시간 및 추가일이 정상 표시된다.
- **`[정상] EpisodeCard — should render progress bar and step name when status is downloading`**
  - _조건:_ 에피소드가 임포트 진행 중(`downloading`) 상태인 경우.
  - _결과:_ 진행률 프로그레스 바와 현재 단계(예: "YouTube 다운로드 중 (40%)")가 노출된다.
- **`[정상] EpisodeCard — should render failed badge and error tooltip when status is failed`**
  - _조건:_ 에피소드가 임포트 실패(`failed`) 상태인 경우.
  - _결과:_ 빨간색 `Failed` 경고 배지가 표시되고 에러 상세 문구 툴팁이 렌더링된다.
- **`[정상] EpisodeCard — should navigate to player page on click when completed`**
  - _조건:_ 완료 상태인 에피소드 카드를 클릭했을 때.
  - _결과:_ `/episodes/[id]` 페이지로 이동을 시도한다 (Link href 검증).
- **`[정상] EpisodeCard — should NOT navigate on click when in progress`**
  - _조건:_ 진행 중 상태인 에피소드 카드를 클릭했을 때.
  - _결과:_ Link 태그 앵커로 작동하지 않아 상세 화면 라우팅이 차단된다.
- **`[정상] EpisodeCard — should navigate to retry import page on click retry button when failed`**
  - _조건:_ 실패 상태인 카드의 "재시도" 버튼을 눌렀을 때.
  - _결과:_ `/import?videoId=[id]` 경로로 리다이렉트된다 (Link href 검증).
