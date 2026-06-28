# import-ui — 이슈 분해 (수직 슬라이싱)

> PRD(시나리오 A) 기반. 각 이슈는 독립적으로 사용자 검증 가능한 수직 슬라이스. Red-Green-Refactor ≤1일.
> [GATE 4] 승인 후 GitHub Issues 등록.

## 발견된 데이터 제약 (설계 반영)

- `ImportState`에 matchRate 필드가 없었음 → **Issue 2에 흡수**(수직 슬라이스 유지): 엔진 오케스트레이터가 `completed`/`failed` 시 matchRate를 `ImportState`에 기록하고, GET이 반환하며, completed 화면이 수치를 표시한다. (순수 백엔드만 바꾸는 horizontal 이슈를 피함.)

## 의존성 순서

```
Issue 1 (폼 제출·접수 + 진입)
   └─▶ Issue 2 (폴링·4단계 타임라인 + 새로고침 복원)
          └─▶ Issue 3 (실패 단계 컨텍스트 재시도)
                 └─▶ Issue 4 (완료 흐름 마감 + 전체 E2E)
```

---

## Issue 1 — 임포트 폼 제출·접수 + /import 진입

**목적**: `/import`에서 두 URL을 입력·검증·제출해 임포트를 접수하고, 홈에서 진입한다.

**범위**

- `app/import/page.tsx`(client) — 폼 영역 조립
- `components/import/ImportForm.tsx` — 입력·클라 검증·제출
- `app/page.tsx` — '임포트하기' 진입 버튼
- 동작: 클라 검증(빈값·http(s)) → `POST /api/import` → 202 시 `router.replace('/import?videoId=X')` + 접수 확인 → 400/409/500 인라인 에러

**Acceptance Criteria**

- **Given** 두 URL 중 빈값이거나 http(s) 형태가 아님, **When** 입력 상태, **Then** 제출 버튼 비활성.
- **Given** 유효한 두 URL, **When** 제출, **Then** `POST /api/import` 호출되고 202 응답 시 URL이 `/import?videoId=X`로 갱신되며 접수 확인이 표시된다.
- **Given** 서버가 400(검증)·409(중복)·500(예외) 반환, **When** 제출, **Then** 폼 하단에 해당 인라인 에러가 표시된다(409는 "이미 {status}" 안내).
- **Given** 홈 화면, **When** '임포트하기' 클릭, **Then** `/import`로 이동한다.

**의존성**: 없음 (`POST /api/import` 구현 완료).

---

## Issue 2 — 상태 폴링 + 4단계 타임라인 모니터 (+ 새로고침 복원)

**목적**: 접수된 videoId 상태를 폴링해 4단계 타임라인+게이지로 표시하고, URL의 videoId로 새로고침/딥링크 복원한다.

**범위**

- `lib/types.ts` — `ImportState`에 `matchRate?: number` 추가
- `lib/services/import-pipeline.ts` — 오케스트레이터가 `completed`/`failed`(저 matchRate) 시 `matchRate`를 상태에 기록 (+ `import-pipeline.test.ts` 갱신)
- `app/api/import/route.ts` — **`GET(?videoId=)` 핸들러 추가** → `getImportState(videoId)`(없으면 404)
- `hooks/use-import-status.ts` — `useImportStatus(videoId)`: 2~3초 폴링, 터미널(`completed`/`failed`) 중단
- `components/import/ImportMonitor.tsx` + `components/import/StepTimeline.tsx` — status→step 매핑, 4단계 + 게이지, completed 시 matchRate 표시
- `app/import/page.tsx` — `useSearchParams`(Suspense)로 videoId 읽어 모니터 렌더(없으면 폼)

**Acceptance Criteria**

- **Given** videoId의 import-state 존재, **When** `GET /api/import?videoId=X`, **Then** 200으로 `ImportState`를 반환한다(상태 없으면 404).
- **Given** 진행 중 상태(downloading/…/aligning), **When** 모니터가 폴링, **Then** 현재 단계 강조·이전 단계 완료·이후 단계 대기로 표시되고 progress 게이지가 갱신된다.
- **Given** `status=completed`, **When** 폴링, **Then** 폴링이 중단되고 성공 상태가 표시된다(progress 100, matchRate 수치 포함).
- **Given** `status=failed`, **When** 폴링, **Then** 폴링이 중단되고 실패 단계와 `error` 메시지가 표시된다.
- **Given** `/import?videoId=X`로 직접 진입(새로고침), **When** 마운트, **Then** 폼을 거치지 않고 모니터가 해당 상태로 복원된다.

**의존성**: Issue 1 (videoId URL 동기화).

---

## Issue 3 — 실패 단계 컨텍스트 재시도

**목적**: `failed` 상태에서 실패 `currentStep`에 맞는 재시도 버튼으로 안전하게 재접수한다.

**범위**

- `components/import/ImportMonitor.tsx` — 재시도 버튼 + `currentStep`→`retryStep` 매핑
- 동작: `POST /api/import {youtubeUrl, transcriptUrl, retryStep}` → 모니터 재폴링

**Acceptance Criteria**

- **Given** `failed`이고 `currentStep`∈{download, subtitle}, **When** 모니터 표시, **Then** **[전체 재시도]** 버튼만 노출된다(retryStep=`all`).
- **Given** `failed`이고 `currentStep`∈{transcript, alignment}, **When** 모니터 표시, **Then** **[대본·정합 재시도]** 버튼이 노출된다(retryStep=`transcript`).
- **Given** 재시도 버튼, **When** 클릭, **Then** 매핑된 `retryStep`으로 `POST /api/import`가 호출되고 모니터 폴링이 다시 시작된다.

**의존성**: Issue 2.

---

## Issue 4 — 완료 흐름 마감 + 전체 E2E

**목적**: 완료 후 액션(새 임포트·에피소드 placeholder)을 제공하고, 전체 흐름을 Playwright E2E로 검증한다.

**범위**

- `components/import/ImportMonitor.tsx` — `completed` 시 '새 임포트'(폼 초기화·URL videoId 제거) + '에피소드 보기' placeholder(비활성)
- `e2e/import.spec.ts`(Playwright) — 해피패스(제출→폴링→completed) + 재시도 경로. GET/POST는 라우트 모킹 또는 상태 fixture로 결정적 제어

**Acceptance Criteria**

- **Given** `completed` 화면, **When** '새 임포트' 클릭, **Then** 폼이 초기화되고 URL의 videoId 쿼리가 제거된다.
- **Given** `completed` 화면, **When** 렌더, **Then** '에피소드 보기'는 비활성/placeholder로 클릭 불가다(에피소드 화면은 범위 밖).
- **Given** Playwright E2E, **When** 폼 제출 → 단계별 상태 폴링 → completed, **Then** 4단계 타임라인이 순차 완료되고 성공 상태가 표시된다(결정적 모킹).
- **Given** Playwright E2E, **When** failed 상태에서 컨텍스트 재시도, **Then** 매핑된 retryStep으로 재접수되고 모니터가 재시작된다.

**의존성**: Issue 1, 2, 3.
