# Issue 32 — 에피소드 삭제 API (DELETE /api/episodes/[id])

## 1. 확정된 시그니처 (Signatures)

### 📂 파일 경로: `src/app/api/episodes/[id]/route.ts`

```typescript
import { getEpisodeById, deleteEpisode } from '@/lib/services/episodes';

/**
 * DELETE /api/episodes/[id]
 * 특정 에피소드를 조회하여 진행 상태에 따라 삭제를 반려하거나 로컬 디렉토리를 제거합니다.
 *
 * @param request Web Standard Request
 * @param context Next.js 라우트 컨텍스트 (비동기 params 포함)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response>;
```

---

## 2. 테스트 시나리오 (Test Scenarios)

### 정상 (Normal)

- **`[정상] DELETE — should return 200 OK and call deleteEpisode when episode status is completed`**
  - _조건:_ 에피소드가 존재하고 `importState.status === 'completed'`.
  - _결과:_ `deleteEpisode(id)`를 호출하고 HTTP 200 응답 반환.
- **`[정상] DELETE — should return 200 OK and call deleteEpisode when episode status is failed`**
  - _조건:_ 에피소드가 존재하고 `importState.status === 'failed'`.
  - _결과:_ `deleteEpisode(id)`를 호출하고 HTTP 200 응답 반환.

### 예외 (Exception)

- **`[예외] DELETE — should return 409 Conflict and NOT call deleteEpisode when episode is in progress (downloading)`**
  - _조건:_ 에피소드가 존재하고 `importState.status === 'downloading'`.
  - _결과:_ `deleteEpisode`를 호출하지 않고 HTTP 409 응답 반환.
- **`[예외] DELETE — should return 404 Not Found when episode does not exist`**
  - _조건:_ 에피소드 디렉토리가 로컬에 존재하지 않아 `getEpisodeById`가 `null`을 반환할 때.
  - _결과:_ HTTP 404 응답 반환.
- **`[예외] DELETE — should return 500 Internal Server Error when getEpisodeById throws exception`**
  - _조건:_ 삭제 판단을 위한 상태 조회 시 디스크 장애 등으로 예외가 던져진 경우.
  - _결과:_ `{ error: message }` 형태의 에러 정보와 HTTP 500 응답 반환.
