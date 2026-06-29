# Issue 31 — 에피소드 목록 조회 API (GET /api/episodes)

## 1. 확정된 시그니처 (Signatures)

### 📂 파일 경로: `src/app/api/episodes/route.ts`

```typescript
import { getEpisodes } from '@/lib/services/episodes';

/**
 * GET /api/episodes
 * 로컬 저장소에 보존된 모든 에피소드 목록을 반환
 */
export async function GET(request: Request): Promise<Response>;
```

---

## 2. 테스트 시나리오 (Test Scenarios)

### 정상 (Normal)

- **`[정상] GET — should return 200 OK with empty array when no episodes exist in local storage`**
  - _조건:_ 로컬 에피소드 저장 디렉토리가 비어있거나 생성되지 않은 상태.
  - _결과:_ 빈 배열 `[]`과 HTTP 200 응답 반환.
- **`[정상] GET — should return 200 OK with episodes containing import state when episodes exist`**
  - _조건:_ 로컬 저장소에 정상 완료된 에피소드와 임포트 진행 중인 에피소드 구조가 혼합 존재할 때.
  - _결과:_ 각 에피소드 정보에 `importState` 프로퍼티가 정상적으로 바인딩된 JSON 배열과 HTTP 200 응답 반환.

### 예외 (Exception)

- **`[예외] GET — should return 500 Internal Server Error when getEpisodes throws an exception`**
  - _조건:_ 파일 시스템 오류 등 내부 `getEpisodes` 호출 과정에서 임의의 에러가 던져진 경우.
  - _결과:_ `{ error: message }` 형태의 에러 정보와 HTTP 500 응답 반환.
