# Issue 40 — AlertDialog 경고 모달 통합 및 개별 에피소드 삭제 연동

## 1. 확정된 시그니처 (Signatures)

### 📂 파일 경로: `src/components/episode/EpisodeCard.tsx`

```tsx
import type { Episode } from '@/lib/types';

/**
 * EpisodeCard
 * onDelete 콜백 프롭이 추가되어 삭제 버튼 클릭 시 AlertDialog를 거쳐 API 호출을 위임합니다.
 */
export default function EpisodeCard({
  episode,
  onDelete,
}: {
  episode: Episode;
  onDelete: (id: string) => Promise<void>;
}): React.ReactNode;
```

### 📂 파일 경로: `src/components/episode/EpisodeDashboard.tsx`

```tsx
// onDelete 삭제 처리기 추가
// const handleDelete = async (id: string) => { ... }
```

---

## 2. 테스트 시나리오 (Test Scenarios)

### 정상 (Normal)

- **`[정상] EpisodeCard (Delete) — should show AlertDialog modal when delete button is clicked`**
  - _조건:_ 완료 또는 실패 상태인 에피소드 카드에서 "삭제(쓰레기통)" 버튼을 클릭했을 때.
  - _결과:_ 삭제 재확인을 요구하는 모달 오버레이(AlertDialog)가 화면에 렌더링된다.
- **`[정상] EpisodeCard (Delete) — should call onDelete prop and close modal when confirm delete is clicked`**
  - _조건:_ 삭제 다이얼로그 모달 노출 상태에서 "삭제" 승인 버튼을 클릭했을 때.
  - _결과:_ 주입된 `onDelete(id)` 콜백이 호출되고 다이얼로그가 닫힌다.
- **`[정상] EpisodeCard (Delete) — should close modal without calling onDelete when cancel is clicked`**
  - _조건:_ 삭제 다이얼로그 모달 노출 상태에서 "취소" 버튼을 클릭했을 때.
  - _결과:_ `onDelete(id)`가 전혀 호출되지 않고 다이얼로그 모달만 닫힌다.
- **`[정상] EpisodeCard (Delete) — should disable delete button when episode status is downloading`**
  - _조건:_ 에피소드가 진행 중(`downloading`) 상태일 때.
  - _결과:_ 카드 내의 삭제 버튼이 `disabled` 속성을 갖거나 렌더링되지 않는다.

### 예외 (Exception)

- **`[예외] EpisodeDashboard (Delete) — should render error message or toast alert when onDelete API call fails`**
  - _조건:_ 다이얼로그 승인으로 `DELETE /api/episodes/[id]` API 요청을 날렸으나, 409 Conflict 또는 500 에러를 응답받았을 때.
  - _결과:_ 삭제 실패에 관한 경고창(Alert/Toast 등)이 유저에게 안내되며 리스트 상태는 복구된다.
