# import-ui (프론트엔드 연동) — PRD

> 단일 진실 원천. spec-fixed.md 기반. [GATE 2] 아키텍처 선택 → ADR/Out of Scope 확정([GATE 3]) 후 완성.

## 1. 개요

엔진(#9~#14)이 산출하는 임포트 파이프라인 위에, 사용자가 **임포트를 개시(폼)**하고 **진행을 모니터링(타임라인+게이지)**하며 **실패 단계를 재시도**하는 `/import` 화면을 제공한다. 디자인 시스템(DESIGN.md) 준수, Playwright E2E와 함께 기획.

## 2. 사용자 스토리

- 사용자로서, YouTube URL + 대본 URL을 입력·제출하면 임포트가 접수되어 진행 상태를 볼 수 있다.
- 사용자로서, 다운로드·자막·대본·정합 4단계가 어디까지 진행됐는지 타임라인과 게이지로 확인한다.
- 사용자로서, 특정 단계에서 실패하면 그 단계에 맞는 재시도 버튼으로 다시 시도한다.
- 사용자로서, 잘못된 입력·중복 접수 시 폼에서 즉시 이유를 안내받는다.
- 사용자로서, 완료되면 성공 결과(matchRate)를 보고 새 임포트를 시작할 수 있다.

## 3. 기술 결정 — 3가지 아키텍처 시나리오 비교

> 7가지 고정 기준으로 비교. [GATE 2]에서 1개 선택.

### 시나리오 A — 클라이언트 페이지 + 커스텀 훅 폴링 (최소)

| 기준                 | 내용                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. 데이터 구조       | 컴포넌트 **로컬 state**(useState): 폼 입력/에러, videoId, `ImportState`. 글로벌 없음                           |
| 2. API 변경지점      | 기존 `app/api/import/route.ts`에 **GET 핸들러 추가**(`?videoId=`). 신규 파일 없음                              |
| 3. 상태관리 변경지점 | 로컬 useState + 커스텀 훅 `useImportStatus(videoId)`(폴링·터미널 중단). 스토어/Context 없음                    |
| 4. 핵심 동작         | 제출→POST→videoId 보관→훅이 GET 폴링→타임라인 렌더, 터미널서 중단                                              |
| 5. 컴포넌트 구조     | `app/import/page.tsx`(client) + `ImportForm` + `ImportMonitor`(+`StepTimeline`) + `hooks/use-import-status.ts` |
| 6. 기존 패턴 일관성  | 현 코드에 글로벌 스토어/Context **부재** → 로컬 state 관습과 일치. `ui/*` 재사용                               |
| 7. 테스트 용이성     | **최상**: 컴포넌트 RTL + 훅(타이머 모킹) + GET 라우트 단위 + Playwright E2E. 경계 명확                         |

### 시나리오 B — ImportContext(전역) + API 클라이언트 서비스 레이어

| 기준                 | 내용                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1. 데이터 구조       | `ImportContext` value(상태기계: idle/submitting/polling/terminal) + `ImportState`. `lib/services/api/import.ts` fetch 래퍼 |
| 2. API 변경지점      | GET 핸들러 추가 + **클라 API 서비스 모듈 신규**                                                                            |
| 3. 상태관리 변경지점 | 신규 `ImportContext`/Provider가 submit·retry·poll 캡슐화. 페이지는 consumer                                                |
| 4. 핵심 동작         | Provider가 폴링·전이 관리, 컴포넌트는 dispatch/consume                                                                     |
| 5. 컴포넌트 구조     | `ImportProvider` + ImportForm + ImportMonitor. `context/` 신규 디렉토리                                                    |
| 6. 기존 패턴 일관성  | 현 코드에 Context 패턴 **없음** → 신규 도입. 페이지 스코프 1개엔 과함(오버킬)                                              |
| 7. 테스트 용이성     | Provider 단위 + 컴포넌트(모킹 context) + E2E. 배선·모킹 비용↑                                                              |

### 시나리오 C — REST 리소스 라우트 + 서버 컴포넌트 하이브리드

| 기준                 | 내용                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| 1. 데이터 구조       | 서버 컴포넌트 초기 fetch(`getImportState` 직접) + 클라 아일랜드 폴링 state. `ImportState` |
| 2. API 변경지점      | 신규 `app/api/import/[videoId]/route.ts`(GET, RESTful). POST 기존                         |
| 3. 상태관리 변경지점 | 서버 컴포넌트 + 클라 아일랜드 로컬 state(router.refresh 또는 폴링)                        |
| 4. 핵심 동작         | 초기 SSR 상태 + 클라가 이어서 폴링(핸드오프)                                              |
| 5. 컴포넌트 구조     | server `page.tsx` + client `ImportMonitorIsland` + `ImportForm`(client)                   |
| 6. 기존 패턴 일관성  | App Router RSC 정석이나 server/client 경계·초기데이터 핸드오프 복잡                       |
| 7. 테스트 용이성     | 라우트 단위는 쉬우나 RSC+island **E2E 타이밍·초기상태 제어 까다로움**                     |

### 추천

**시나리오 A**. 이유: ① import은 단일 페이지 스코프라 전역 Context(B)·RSC 하이브리드(C)는 과한 구조, ② 현 코드베이스에 글로벌 스토어/Context가 없어 로컬 state + 커스텀 훅이 관습과 일치, ③ 폴링·타이머·터미널 중단을 훅 단위로 결정적 테스트 + Playwright E2E가 가장 깔끔, ④ 신규 API는 기존 route.ts에 GET만 추가해 변경 표면 최소.

---

## 4. 기술 결정 — ADR (시나리오 A 채택)

### Context

`import-ui`는 `/import` **단일 페이지 스코프** 기능으로, 접수(POST)·폴링 기반 상태 모니터링·단계별 재시도가 핵심이다. 현 코드베이스에는 전역 스토어/Context 패턴이 **없고**, 상태를 읽는 GET 엔드포인트도 **없다**. Playwright E2E와 함께 기획하므로 결정적 검증 용이성이 중요하다.

### Decision

**시나리오 A — 클라이언트 페이지 + 커스텀 훅 폴링.**

- **API**: 기존 `app/api/import/route.ts`에 `GET(?videoId=)` 핸들러 추가 → `getImportState(videoId)` 반환(없으면 404). POST는 그대로.
- **페이지**: `app/import/page.tsx`(client component) — 폼+모니터 조립.
- **컴포넌트**: `ImportForm`(입력·클라 검증·제출/재시도), `ImportMonitor`(폴링 소비·상태 표시), `StepTimeline`(4단계 + 게이지). 모두 `components/import/` 하위, `ui/*` 재사용.
- **상태/폴링**: 로컬 `useState`(폼·에러) + 커스텀 훅 `hooks/use-import-status.ts`(`useImportStatus(videoId)` — setInterval 폴링, `completed`/`failed`에서 중단).
- **videoId URL 동기화(새로고침 복원)**: 제출 성공(202) 시 `router.replace('/import?videoId=X')`. 페이지 마운트 시 `useSearchParams`로 videoId 읽어 있으면 즉시 모니터 폴링(폼 거치지 않음), 상태 404면 폼으로 폴백. `useSearchParams`는 Suspense 경계로 감싼다.
- **재시도**: 실패 `currentStep` → 컨텍스트 매핑(`download`/`subtitle`→`all`, `transcript`/`alignment`→`transcript`)으로 POST 재접수.
- **진입**: 홈에 `/import` 진입 버튼.

### Alternatives (기각 사유)

- **B. 전역 ImportContext + 서비스 레이어** — 페이지 스코프 1개에 전역 상태기계는 **과한 추상화**, 현 코드에 Context 관습이 없어 신규 패턴 도입 비용·일관성 저하, Provider 모킹 배선으로 테스트 표면↑. 기각.
- **C. REST 리소스 라우트 + RSC 하이브리드** — 폴링은 본질적으로 클라이언트 동작이라 SSR 초기 fetch 이점이 작고, server/client 경계·초기데이터 핸드오프가 복잡하며 **RSC+island의 E2E 타이밍·초기상태 제어가 까다로움**. 라우트를 `[videoId]`로 분리하는 것도 GET 1개를 위해 과함. 기각.

### Consequences

- **장점**: 변경 표면 최소(GET 핸들러만 추가), 훅·컴포넌트 단위로 결정적 테스트 + Playwright E2E 깔끔, 현 코드 관습(로컬 state)과 일치, 구현 속도 빠름.
- **단점/한계**:
  - 폴링은 푸시 대비 **지연·주기적 요청** 발생(2~3초 간격, 터미널 중단으로 비용 제한).
  - **단일 videoId 모니터링만** 지원(동시 다중 임포트 대시보드 아님).
  - (해소됨) 새로고침/딥링크 → videoId URL 동기화로 모니터 복원. 부수 이득: Playwright가 `/import?videoId=X`로 모니터를 독립 검증 가능.

## 5. Out of Scope

본 피처(`import-form-ui` + `import-page`)에서 **구현하지 않는다**:

- 에피소드 상세/목록 화면, 플레이어 연결 (완료 시 '에피소드 보기'는 placeholder/비활성)
- 실시간 푸시(SSE/WebSocket) — 폴링으로 대체
- 썸네일·메타데이터 표시, `translating`(번역) 단계 UI
- 임포트 이력/큐 관리, 동시 다중 임포트 대시보드
- 인증·권한, 사용자별 임포트 분리
- `subtitles` retryStep 경로(자막 실패 시점엔 transcript 부재 → 미사용)

> 참고: videoId URL 동기화(새로고침 복원)는 **범위에 포함**(§4 Decision).

## 6. 용어 정의

spec-fixed.md §9 동기화 (임포트 폼·모니터·단계·폴링·컨텍스트 재시도·터미널 상태·진입 버튼).
