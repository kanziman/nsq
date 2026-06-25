# 임포트 API 엔드포인트 (import-api) PRD

> 단일 기준 문서(Single Source of Truth). 이 피처에 관해 궁금하면 이 문서를 본다.
> 요구사항 근거: [spec-fixed.md](./spec-fixed.md)

---

## 1. 개요

YouTube URL + Freakonomics 대본 URL을 받아 **임포트 파이프라인**(`download → subtitle → transcript → alignment`)을 비동기로 구동하는 `POST /api/import` 엔드포인트.
파이프라인은 수 분이 소요될 수 있으므로 즉시 `202`로 수락하고, 클라이언트는 `import-state.json`을 폴링한다. 번역 단계는 이번 범위에서 제외한다.

---

## 2. 사용자 스토리

- 사용자로서, YouTube URL과 대본 URL을 제출하면 **즉시 접수 확인(videoId)** 을 받고 싶다. (긴 작업을 기다리지 않기 위해)
- 사용자로서, 임포트가 어느 단계까지 진행됐는지 **폴링으로 확인**하고 싶다.
- 사용자로서, 정합 품질이 낮으면(`matchRate < 0.85`) **명확한 실패 사유**를 보고, 비싼 다운로드를 다시 하지 않고 **부분 재시도**하고 싶다.

---

## 3. 기술 결정 (ADR)

### ADR-001: 비동기 임포트 실행을 인프로세스 Fire-and-forget으로 구현

**Status**: Accepted (2026-06-25)

**Context**

- `POST /api/import`는 수 분 걸리는 파이프라인을 구동해야 하나, HTTP 요청을 그 시간 동안 붙잡을 수 없다 (타임아웃·UX). 따라서 즉시 `202`로 수락하고 백그라운드에서 실행해야 한다(spec-fixed §3-1).
- Next.js App Router에는 내장 잡 큐가 없다. 실행 모델을 직접 선택해야 한다.
- 운영 환경은 **로컬 단일 사용자 + 장기 실행 Node 서버**(`next start`/`next dev`)이며, 데이터는 `.shadowing/` 파일시스템에 저장된다. 기존 `lib/services/episodes.ts`는 이미 "파일시스템 = 단일 진실 소스" 패턴을 따른다.

**Decision**

- 라우트 핸들러가 ① 입력 검증 → ② 초기 `import-state.json`(`status: downloading`) 기록 → ③ 오케스트레이터 `runImportPipeline(videoId, ...)`를 **`await` 없이** 호출 → ④ 즉시 `202 { videoId, status }` 반환한다.
- 파이프라인은 동일 Node 프로세스 이벤트 루프에서 실행되며, 각 단계마다 `import-state.json`을 갱신한다.
- 진행 상태 폴링은 **별도 신규 상태 계층 없이** `import-state.json`을 읽는 것으로 충족한다(에피소드 조회 API/서비스 재사용).
- 오케스트레이터는 후속 모듈(`youtube`, `freakonomics`, `alignTranscript`, `import-state`)을 호출하는 **순수 async 함수**로 구현해 테스트 가능성을 확보한다.

**Alternatives**

- **안 B (인메모리 잡 매니저 싱글톤)** — 거부. 동시성/취소 제어를 위해 인메모리 `Map` 계층을 추가하지만, 이는 MVP 단일 사용자에 불필요한 기능이며 인메모리↔파일 상태 불일치(재시작 reconcile) 문제와 비결정적 테스트 난이도를 유발한다.
- **안 C (별도 워커 프로세스)** — 거부. 프로세스 격리로 가장 견고하나, child process/IPC/빌드 복잡도가 MVP 범위 대비 과도하다. 통합 수준 테스트가 강제되어 피드백 루프가 느려진다.

**Consequences**

- (+) 가장 단순하고 기존 `episodes.ts` 파일시스템-진실 패턴과 완전히 일관된다.
- (+) 오케스트레이터가 순수 함수라 스텝 모킹·상태파일 검증으로 단위 테스트가 쉽다.
- (+) 폴링용 별도 상태 인프라가 필요 없다.
- (−) **서버 재시작 시 진행 중이던 잡은 끊긴다** — `import-state.json`이 `downloading` 등 중간 상태로 멈춘 채 남는다. (완화: 재시도는 `retryStep`으로 수동 재개. 중간 상태 자동 복구는 Out of Scope.)
- (−) **동시성 제어가 없다** — 서로 다른 videoId 다발 임포트 시 yt-dlp/CPU 부하 제한이 없다. (단일 사용자 가정상 수용.)
- (−) 무거운 작업이 Next 서버 프로세스와 이벤트 루프를 공유한다 (단일 사용자 로컬 환경상 수용).

---

## 4. 아키텍처 3안 비교 (선택 대기)

공통 전제:

- 데이터는 모두 `.shadowing/episodes/{videoId}/`에 영속화하며 `import-state.json`이 폴링 소스다 (기존 `episodes.ts` 패턴 계승).
- 오케스트레이터(`lib/services/import-pipeline.ts`)가 후속 모듈(`youtube`, `freakonomics`, `alignTranscript`, `import-state`)을 호출하는 구조는 3안 공통.
- 로컬 단일 사용자 + 장기 실행 Node 서버(`next start`/`next dev`) 환경.

### 안 A — 인프로세스 Fire-and-forget (라우트가 await 없이 백그라운드 실행)

라우트 핸들러가 검증 → 초기 `import-state.json` 기록 → `runPipeline(videoId)`를 **await 없이** 호출 → 즉시 `202` 반환. 파이프라인은 같은 Node 프로세스 이벤트 루프에서 단계별로 `import-state.json`을 갱신.

### 안 B — 인프로세스 잡 매니저 (모듈 싱글톤 레지스트리)

모듈 레벨 싱글톤 `ImportManager`가 실행 잡을 메모리(`Map<videoId, Job>`)로 추적하고 동시성 큐/중복 제어를 담당. POST는 enqueue 후 `202`. `import-state.json`도 영속화하되 활성 잡 제어는 메모리 계층이 담당.

### 안 C — 별도 워커 프로세스 (detached child process / worker_threads)

POST가 잡 디스크립터를 기록하고 파이프라인을 **요청 수명 밖의 별도 프로세스**(detached child 또는 worker_thread)에서 실행. 무거운 yt-dlp/CPU 작업을 Next 서버 프로세스에서 격리.

### 비교표 (7가지 고정 기준)

| #   | 기준                 | 안 A (Fire-and-forget)                                   | 안 B (잡 매니저 싱글톤)                             | 안 C (별도 워커 프로세스)                      |
| --- | -------------------- | -------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| 1   | 데이터 구조          | `import-state.json` 단일 소스                            | `import-state.json` + 인메모리 `Map` (이중 소스)    | `import-state.json` + 잡 디스크립터/큐 파일    |
| 2   | API 레이어 변경지점  | `api/import/route.ts`(POST) 추가, 폴링은 기존 GET 재사용 | 동일 + 매니저 모듈, 향후 cancel 엔드포인트 여지     | 라우트 + 워커 엔트리 스크립트 + spawn 로직     |
| 3   | 상태관리 변경지점    | 없음 (파일시스템이 곧 상태)                              | 서버 인메모리 싱글톤(신규 stateful 모듈)            | 프로세스 간 상태 동기화 필요                   |
| 4   | 핵심 동작            | `runPipeline()`을 await 없이 호출                        | `manager.enqueue()` + 동시성 큐, 동일 프로세스 실행 | detached child/worker가 파이프라인 실행        |
| 5   | 컴포넌트 구조        | 오케스트레이터 = 순수 async 함수                         | + `ImportManager` 클래스                            | + 워커 러너 모듈 + IPC 프로토콜                |
| 6   | 기존 패턴과의 일관성 | 매우 높음 (episodes.ts의 파일시스템-진실 패턴과 동일)    | 중간 (인메모리 싱글톤이라는 신규 패턴 도입)         | 낮음 (child process라는 가장 무거운 신규 패턴) |
| 7   | 테스트 용이성        | 높음 (순수 함수 → 스텝 모킹·상태파일 검증 용이)          | 중간 (타이밍/동시성 → 결정적 테스트 어려움)         | 낮음 (프로세스 spawn → 통합 수준 테스트 필요)  |

### 트레이드오프 요약

- **안 A**: 가장 단순·일관·테스트 용이. 단, 서버 재시작 시 진행 중 잡은 끊김(파일 상태는 `downloading`에 멈춤). 동시성 제어 없음 → MVP 단일 사용자엔 충분.
- **안 B**: 동시성 제한·중복 제어·취소를 인메모리로 구현 가능. 단, 인메모리/파일 상태 불일치(재시작 시 reconcile 필요), 복잡도·테스트 난이도 상승.
- **안 C**: 진짜 비동기·격리로 가장 견고. 단, 프로세스 관리·IPC·빌드 복잡도가 MVP 대비 과함.

### 추천: **안 A**

- 로컬 단일 사용자 + 장기 실행 Node 서버라는 전제에서 fire-and-forget이 안전하게 동작.
- 기존 `episodes.ts`의 "파일시스템 = 단일 진실 소스" 패턴을 그대로 계승 → 일관성 최상.
- 동시성/취소/격리(B·C의 장점)는 MVP 범위에서 불필요한 과설계.

---

## 5. Out of Scope

이번 import-api 피처에서 **구현하지 않는 것**:

1. **한국어 번역 단계** (OpenRouter, `TRANSLATION_MODEL`). 파이프라인은 `alignment` 완료 후 `completed`로 종료한다. 번역은 별도 후속 피처.
2. **후속 모듈의 내부 구현**. `youtube`(yt-dlp 다운로드), `freakonomics`/`transcript`(스크래핑·파싱), `alignTranscript`(정합), `import-state`(상태 저장)의 **상세 구현은 각각의 별도 태스크**이며, 본 피처는 이들을 호출하는 **오케스트레이션 + 라우트 계약**까지를 범위로 한다.
3. **동시성/큐 제어** — 동시 임포트 개수 제한, 우선순위, 백프레셔. (안 A 채택에 따라 미구현)
4. **임포트 취소(cancel) API** — 진행 중 잡 중단 기능.
5. **서버 재시작 시 중간 상태 자동 복구(reconcile)** — `downloading`에 멈춘 잡의 자동 재개. 재시도는 사용자의 `retryStep` 수동 요청으로만.
6. **transcriptUrl 도메인/형식 엄격 검증** — 비어있음 여부만 확인(spec-fixed §3-5).
7. **실패 시 아티펙트 롤백/삭제** — 유지 정책 채택(spec-fixed §3-6).
8. **인증/인가·레이트리밋** — 단일 사용자 로컬 전제.
9. **임포트 폼/페이지 UI** — `import-form-ui`, `import-page`는 별도 태스크. 본 피처는 API 계약만 제공해 폴링 가능하게 한다.
10. **번역 진행 상태(`translating`) 노출** — `ImportState`의 해당 상태값은 이번 범위에서 사용하지 않음.

---

## 6. 용어 정의

[spec-fixed.md §6 Ubiquitous Language](./spec-fixed.md) 와 동기화한다. (변경 시 양쪽 갱신)
