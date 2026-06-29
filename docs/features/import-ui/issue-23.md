# Issue #23 — 상태 폴링·4단계 타임라인 모니터 (+matchRate·새로고침 복원)

> 근거: docs/features/import-ui/issues.md (Issue 2). 아키텍처 A. 선행 #22.

## 1. 시그니처 (확정)

### 엔진 (matchRate 영속)

```ts
// lib/types.ts — ImportState에 추가
matchRate?: number;
// lib/services/import-pipeline.ts — completed·저matchRate failed 시 matchRate 기록
// writeState(videoId, status, currentStep, progress, error?, matchRate?)
```

### API (GET 신설)

```ts
// app/api/import/route.ts
export async function GET(request: Request): Promise<Response>;
// ?videoId= 없으면 400, getImportState(videoId) 없으면 404, 있으면 200 + ImportState
```

### 폴링 훅

```ts
// src/hooks/use-import-status.ts
export interface ImportStatusResult {
  state: ImportState | null;
  error: string | null;
  loading: boolean;
}
// videoId null이면 비활성. 즉시 1회 + intervalMs(기본 2500)마다 GET 폴링.
// status ∈ {completed, failed} 이면 폴링 중단. 404면 error 설정.
export function useImportStatus(
  videoId: string | null,
  intervalMs?: number,
): ImportStatusResult;
```

### 컴포넌트

```tsx
// src/components/import/StepTimeline.tsx — 4단계 + 게이지 (프레젠테이션)
export interface StepTimelineProps {
  status: ImportState['status'];
  currentStep: string;
  progress: number;
}
export function StepTimeline(props: StepTimelineProps): React.JSX.Element;

// src/components/import/ImportMonitor.tsx — 폴링 소비 + 상태 표시
export interface ImportMonitorProps {
  videoId: string;
}
export function ImportMonitor(props: ImportMonitorProps): React.JSX.Element;

// app/import/page.tsx — useSearchParams(Suspense): videoId 있으면 ImportMonitor, 없으면 ImportForm
```

## 2. 핵심 결정

- **status→step 매핑**: download=0/subtitle=1/transcript=2/alignment=3. 진행 status는 currentStep으로 활성 단계 결정.
- **단계 상태**: 활성 이전=완료, 활성=진행, 이후=대기. `completed`=전부 완료. `failed`=currentStep 단계=실패, 이전=완료.
- **matchRate**: alignment 실행 후에만 존재 → completed·저matchRate failed에만 기록. 단계 throw failed엔 없음.
- **completed 화면**: 성공 + `state.matchRate` 표시. **failed 화면**: 실패 단계 + `error`. (재시도 버튼은 #24)
- **폴링 중단**: 터미널 상태에서 interval clear. videoId 변경/언마운트 시 정리.

## 3. 테스트 시나리오 (15/15 통과)

### [정상]

- [x] `[정상] runImportPipeline — should persist matchRate in state on completed`
- [x] `[정상] runImportPipeline — should persist matchRate in state on low-matchRate failed`
- [x] `[정상] GET /api/import — should return 200 with ImportState when state exists`
- [x] `[정상] useImportStatus — should poll and expose state, stopping on completed`
- [x] `[정상] StepTimeline — should mark prior steps done, current active, later pending`
- [x] `[정상] ImportMonitor — should render timeline and matchRate on completed`
- [x] `[정상] ImportPage — should render the monitor when ?videoId present`

### [경계]

- [x] `[경계] GET /api/import — should return 400 when videoId is missing`
- [x] `[경계] useImportStatus — should not poll when videoId is null`
- [x] `[경계] StepTimeline — should mark all steps done on completed`
- [x] `[경계] ImportPage — should render the form when no videoId`

### [예외]

- [x] `[예외] GET /api/import — should return 404 when state not found`
- [x] `[예외] useImportStatus — should expose error on 404`
- [x] `[예외] StepTimeline — should mark current step failed on failed status`
- [x] `[예외] ImportMonitor — should show the error message on failed`

## 4. AC ↔ 시나리오 교차 대조

| AC                                         | 커버                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| GET videoId → 200 ImportState (없으면 404) | GET 200 + 404 + 400                                            |
| 진행 중 → 현재 단계 강조·게이지 갱신       | StepTimeline 정상 + ImportMonitor                              |
| completed → 폴링 중단·성공(matchRate)      | useImportStatus stop + ImportMonitor matchRate + pipeline 영속 |
| failed → 폴링 중단·실패 단계·error         | StepTimeline failed + ImportMonitor error                      |
| /import?videoId=X 직접 진입 복원           | ImportPage monitor when videoId                                |
