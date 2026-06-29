# Issue #24 — [import-ui] Issue 3 — 실패 단계 컨텍스트 재시도

> 아키텍처: 시나리오 A(클라 페이지 + 커스텀 훅 폴링). 선행: #23(폴링 모니터·matchRate·새로고침 복원).

## 1. 시그니처 (확정)

### 1-1. `lib/types.ts` — `ImportState` 확장 (재시도 컨텍스트 영속)

새로고침 복원(시나리오 A) 시 모니터는 URL의 `videoId`와 폴링한 `ImportState`만 갖는다.
재시도 POST는 `youtubeUrl`/`transcriptUrl`이 필수이므로, 접수 시점에 두 URL을 상태에 실어
GET→모니터까지 관통시킨다(#23의 `matchRate` 영속과 동일한 수직 슬라이스).

```ts
export interface ImportState {
  // ...기존 필드...
  youtubeUrl?: string; // 재시도 재접수용. POST 접수 시 기록, 모든 상태 쓰기에서 보존.
  transcriptUrl?: string; // 재시도 재접수용.
}
```

### 1-2. `app/api/import/route.ts` — POST 초기 상태에 URL 기록

```ts
const state: ImportState = {
  videoId,
  status: 'downloading',
  progress: 0,
  currentStep: 'download',
  youtubeUrl, // 추가
  transcriptUrl, // 추가
  updatedAt: new Date().toISOString(),
};
```

### 1-3. `lib/services/import-pipeline.ts` — 전 상태 쓰기에서 URL 보존

`writeState`는 매 호출마다 상태 객체를 새로 만들므로, 보존하지 않으면 `failed` 기록 시 URL이 유실되어
재시도가 불가능해진다(재시도는 `failed`에서 출발). 모든 `writeState`가 `youtubeUrl`/`transcriptUrl`을
포함하도록 한다(파이프라인이 이미 `urls`를 보유).

### 1-4. `hooks/use-import-status.ts` — 폴링 재시작 수단 추가

폴링은 터미널(`completed`/`failed`)에서 멈추므로, 재시도 후 재폴링을 재개할 `restart()`를 노출한다.

```ts
export interface ImportStatusResult {
  state: ImportState | null;
  error: string | null;
  loading: boolean;
  restart: () => void; // 호출 시 폴링 effect를 재실행(터미널 이후에도 재개)
}
```

### 1-5. `components/import/ImportMonitor.tsx` — 컨텍스트 재시도

```ts
// currentStep → 재시도 계획 매핑 (순수 함수, export)
export function retryPlanFor(
  currentStep: string,
): { retryStep: RetryStep; label: string } | null;
//   download | subtitle  → { retryStep: 'all',        label: '전체 재시도' }
//   transcript | alignment → { retryStep: 'transcript', label: '대본·정합 재시도' }
//   그 외                  → null (재시도 버튼 미노출)
```

- `status === 'failed'`이고 `retryPlanFor(currentStep)`이 non-null이면 해당 라벨의 버튼을 노출한다.
- 클릭 시 `POST /api/import { youtubeUrl: state.youtubeUrl, transcriptUrl: state.transcriptUrl, retryStep }`를
  호출하고, 202면 `restart()`로 폴링을 재개한다.
- `subtitles` retryStep 경로는 PRD §5 Out of Scope.

---

## 2. 테스트 시나리오

### `retryPlanFor` (순수 매핑)

- [x] [정상] retryPlanFor — should return retryStep 'all' / '전체 재시도' when currentStep is 'download'
- [x] [정상] retryPlanFor — should return retryStep 'all' / '전체 재시도' when currentStep is 'subtitle'
- [x] [정상] retryPlanFor — should return retryStep 'transcript' / '대본·정합 재시도' when currentStep is 'transcript'
- [x] [정상] retryPlanFor — should return retryStep 'transcript' / '대본·정합 재시도' when currentStep is 'alignment'
- [x] [경계] retryPlanFor — should return null when currentStep is unmapped (e.g. 'completed', 'translating')

### `ImportMonitor` 재시도 렌더·동작

- [x] [정상] ImportMonitor — should render only [전체 재시도] button when failed and currentStep is 'download'
- [x] [정상] ImportMonitor — should render [대본·정합 재시도] button when failed and currentStep is 'alignment'
- [x] [정상] ImportMonitor — should POST /api/import with retryStep 'all' and state URLs when [전체 재시도] clicked
- [x] [정상] ImportMonitor — should POST /api/import with retryStep 'transcript' when [대본·정합 재시도] clicked
- [x] [정상] ImportMonitor — should call restart() to resume polling after a 202 retry response
- [x] [경계] ImportMonitor — should not render any retry button when status is 'completed'
- [x] [경계] ImportMonitor — should not render retry button when failed but currentStep is unmapped
- [x] [예외] ImportMonitor — should not call restart() when retry POST does not return 202

### `import-pipeline` URL 영속 (회귀 잠금)

- [x] [정상] runImportPipeline — should persist youtubeUrl/transcriptUrl in the failed state so retry has context

### `route` POST URL 영속

- [x] [정상] POST /api/import — should persist youtubeUrl/transcriptUrl into the initial import-state

---

## 3. AC 교차 대조

| AC                                                                        | 커버 시나리오                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| failed·{download,subtitle} → [전체 재시도]만 (retryStep=all)              | retryPlanFor download/subtitle, ImportMonitor render 전체 재시도         |
| failed·{transcript,alignment} → [대본·정합 재시도] (retryStep=transcript) | retryPlanFor transcript/alignment, ImportMonitor render 대본·정합 재시도 |
| 클릭 → 매핑 retryStep으로 POST + 폴링 재개                                | POST retryStep all/transcript + restart() 호출                           |

> 재시도 POST의 URL 가용성(새로고침 복원 포함)은 ImportState URL 영속(파이프라인·route 시나리오)으로 뒷받침.
