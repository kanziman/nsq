# 임포트 API 엔드포인트 (import-api) 이슈 분해

> 근거: [prd.md](./prd.md) · [spec-fixed.md](./spec-fixed.md)
> 원칙: 수직 슬라이싱(각 이슈 = 폴링으로 검증 가능한 독립 동작), 의존성 순방향, 이슈당 반나절~하루 TDD.

## 공통 전제

- **관찰 지점(검증 소스)**: `.shadowing/episodes/{videoId}/import-state.json`. 모든 동작은 이 파일의 상태 전이로 검증한다(HTTP 폴링 라우트는 `episodes-api` 별도 태스크).
- **모듈 경계**: 오케스트레이터는 후속 모듈을 **TypeScript 인터페이스(계약)** 로 호출한다. 모듈 내부 구현은 각각 별도 checklist 태스크(`import-youtube`, `import-transcript`, `import-alignment`, `import-state`). 본 피처의 이슈는 **계약 정의 + 오케스트레이션 + 라우트**를 범위로 하며, 테스트는 모듈을 **테스트 더블(주입)** 로 대체해 결정적으로 수행한다.

---

## Issue 1 — `POST /api/import` 접수·검증·초기 상태 생성

**목적**: 사용자가 URL을 제출하면 즉시 수락(`202`)되고, 폴링이 가능하도록 초기 `import-state.json`이 생성된다. 잘못된 입력·중복은 차단된다.

**범위**

- `src/app/api/import/route.ts` POST 핸들러.
- 입력 검증: `youtubeUrl`→ videoId 추출(불가 시 `400`), `transcriptUrl` 비어있음 검증(`400`).
- 중복/동시성: 기존 상태 조회 후 진행중/`completed` → `409`(retryStep 없을 때), `failed`/없음 → 진행.
- 초기 `import-state.json`(`status: downloading`, `progress: 0`, `currentStep`) 기록 후 `202 { videoId, status }` 반환.
- 이 단계에서 파이프라인 실행은 no-op 스텁(호출만, Issue 2에서 구현).

**의존성**: 없음 (시작 이슈). 기존 `lib/services/episodes.ts`의 상태 조회 헬퍼 재사용.

**Acceptance Criteria**

- [x] Given 유효한 youtubeUrl·transcriptUrl, When `POST /api/import`, Then `202`와 `{ videoId }`를 반환하고 `import-state.json`이 `status: downloading`으로 생성된다.
- [x] Given videoId 추출 불가한 youtubeUrl, When `POST /api/import`, Then `400`을 반환하고 상태 파일을 만들지 않는다.
- [x] Given 빈 transcriptUrl, When `POST /api/import`, Then `400`을 반환한다.
- [x] Given 진행중(`downloading`) 또는 `completed`인 videoId, When retryStep 없이 `POST /api/import`, Then `409`와 현재 `status`를 반환한다.
- [x] Given `failed` 또는 미존재 videoId, When `POST /api/import`, Then `202`로 신규 시작한다.

---

## Issue 2 — 파이프라인 오케스트레이션: 단계 상태 전이 · matchRate 검증 · 실패 처리

**목적**: 수락된 임포트가 백그라운드에서 `download → subtitle → transcript → alignment` 단계를 진행하며 상태를 갱신하고, 성공 시 `completed`, 실패 시 `failed`(아티펙트 유지)로 끝난다.

**범위**

- 후속 모듈 **인터페이스 정의**(각 step 함수 시그니처: 입력/산출 아티펙트 경로/반환).
- `lib/services/import-pipeline.ts`의 `runImportPipeline(videoId, urls)` 순수 async 오케스트레이터.
- 단계별 `import-state.json` 갱신(`currentStep`, `status`, `progress`).
- alignment 후 `matchRate < 0.85` 시 `failed` 처리(에러 메시지에 수치 포함), 아티펙트 미삭제.
- 임의 단계 throw 시 `status: failed` + `currentStep` + `error` 기록, 아티펙트 유지.
- Issue 1의 라우트가 `runImportPipeline`을 `await` 없이 호출(fire-and-forget)하도록 연결.

**의존성**: Issue 1 (라우트·초기 상태). 모듈은 테스트 더블로 주입.

**Acceptance Criteria**

- [ ] Given 모든 step 더블이 성공, When `runImportPipeline` 실행, Then `import-state.json`이 download→subtitle→transcript→alignment 순으로 `currentStep`이 전이되고 최종 `status: completed`, `segments.json`이 생성된다.
- [ ] Given alignment 더블이 `matchRate 0.72` 반환, When 실행, Then `status: failed`, `currentStep: alignment`, `error`에 `0.72 < 0.85`가 포함되고 다운로드된 아티펙트는 삭제되지 않는다.
- [ ] Given 임의 step이 예외를 throw, When 실행, Then `status: failed`와 해당 `currentStep`·`error`가 기록되고 기존 아티펙트는 유지된다.
- [ ] Given 라우트가 `202`를 반환, When 직후 `import-state.json`을 폴링, Then 응답 지연 없이 진행 상태가 갱신되어 간다(fire-and-forget 동작 확인).

---

## Issue 3 — retryStep 부분 재시도 (아티펙트 재사용)

**목적**: 실패/완료한 임포트를 비싼 재다운로드 없이 부분 재시도할 수 있다.

**범위**

- 라우트가 `retryStep`(`all`|`transcript`|`subtitles`)을 받아 기존 에피소드 재처리를 허용(409 예외).
- 오케스트레이터가 retryStep에 따라 재실행 단계와 재사용 아티펙트를 분기:
  - `all` → 전체 재실행(재다운로드)
  - `transcript` → `audio.mp3`·`subtitle.en.vtt` 재사용, transcript fetch/parse → align
  - `subtitles` → `audio.mp3`·`transcript.txt` 재사용, subtitle 재다운로드 → align

**의존성**: Issue 2 (오케스트레이터·단계 전이).

**Acceptance Criteria**

- [ ] Given `failed`이고 `audio.mp3`·`subtitle.en.vtt`가 존재, When `retryStep: "transcript"`로 `POST /api/import`, Then download/subtitle step은 호출되지 않고 transcript→alignment만 재실행되어 상태가 갱신된다.
- [ ] Given `completed`인 에피소드, When `retryStep: "subtitles"`로 `POST /api/import`, Then `409` 없이 수락되고 `audio.mp3`는 재다운로드되지 않으며 subtitle→alignment가 재실행된다.
- [ ] Given `retryStep: "all"`, When `POST /api/import`, Then 모든 단계가 처음부터 재실행된다(audio 재다운로드 포함).
- [ ] Given 재사용 대상 아티펙트가 누락, When 해당 retryStep 실행, Then 명확한 `error`와 함께 `failed` 처리된다.

---

## 의존성 그래프

```
Issue 1 (라우트·검증·초기상태)
   └─▶ Issue 2 (오케스트레이션·상태전이·실패처리)
          └─▶ Issue 3 (retryStep 부분 재시도)
```

각 이슈는 완료 시점에 `import-state.json` 폴링만으로 검증 가능한 독립 동작을 제공한다.
