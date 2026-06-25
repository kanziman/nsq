# 임포트 API 엔드포인트 (import-api) 확정 요구사항

> 이 문서는 `spec-original.md`의 모호함을 인터뷰로 제거한 **확정 요구사항**이다.
> 이후 모든 코드·문서·대화는 아래 "용어 정의"를 따른다.

---

## 1. 기능 개요

YouTube 비디오 URL과 Freakonomics 대본 URL을 입력받아 **오디오 다운로드 → 자막 추출 → 대본 스크래핑 → 자막↔대본 정합(alignment)**을 수행하는 임포트 파이프라인을 구동하는 POST API.

파이프라인은 수 분이 소요될 수 있으므로 **비동기로 실행**되며, 클라이언트는 진행 상태(`import-state.json`)를 **폴링**하여 추적한다.

> ⚠️ **이번 범위에서 한국어 번역(OpenRouter) 단계는 제외한다.** 파이프라인의 종착 상태는 `aligning` 완료 후 `completed`이며, 번역은 별도 후속 피처로 분리한다.

---

## 2. 핵심 사용자 (Primary User)

- 단일 사용자(로컬 운영). Freakonomics 에피소드를 쉐도잉용으로 임포트하려는 학습자/운영자.
- 로컬 파일 시스템(`.shadowing/`)에 데이터를 영속화하는 단일 인스턴스 환경을 전제로 한다.

---

## 3. 확정된 결정 사항

### 3-1. 실행 모델 — 비동기 + 폴링 ✅

- `POST /api/import`는 입력 검증 후 **즉시 `202 Accepted`** 를 반환한다. 응답 바디에 `videoId`와 초기 `status`를 포함한다.
- 실제 파이프라인은 응답 반환 이후 **백그라운드에서 실행**된다.
- 클라이언트는 반환받은 `videoId`로 진행 상태를 **폴링**한다. (상태 소스: `.shadowing/episodes/{videoId}/import-state.json`)
- 202 반환 직전, 초기 `import-state.json`(`status: downloading`)을 생성하여 폴링이 즉시 가능하도록 한다.

### 3-2. 번역 범위 — 제외 ✅

- 파이프라인 단계: `download → subtitle → transcript → alignment` 까지만 수행한다.
- `alignment` 성공(= `matchRate ≥ 0.85`) 시 `segments.json`을 생성하고 `status: completed`로 종료한다.
- `ImportState`의 `translating` 상태는 이번 피처에서 **사용하지 않는다.**

### 3-3. retryStep 의미 — 선택적 재실행 + 아티펙트 재사용 ✅

| retryStep    | 재실행 단계                                         | 재사용 아티펙트                |
| ------------ | --------------------------------------------------- | ------------------------------ |
| `all`        | 다운로드부터 전부 (audio·subtitle·transcript·align) | 없음 (audio.mp3 재다운로드)    |
| `transcript` | transcript fetch/parse → align                      | `audio.mp3`, `subtitle.en.vtt` |
| `subtitles`  | subtitle 재다운로드 → align                         | `audio.mp3`, `transcript.txt`  |

- 비용이 큰 `audio.mp3` 재다운로드를 피하기 위해 부분 재시도를 지원한다.
- `retryStep`이 **없는** 요청은 신규 임포트로 간주한다(3-4 참조).

### 3-4. 중복 / 동시성 처리 ✅

`retryStep`이 없는 일반 요청 기준, `videoId`의 현재 상태에 따라:

| 현재 상태                         | 동작                                                  |
| --------------------------------- | ----------------------------------------------------- |
| 진행중 (`downloading`~`aligning`) | **`409 Conflict`** (이미 진행중)                      |
| `completed`                       | **`409 Conflict`** (재처리는 `retryStep` 명시 시에만) |
| `failed` 또는 존재하지 않음       | **`202 Accepted`** 신규 시작                          |

- 즉, 이미 존재하는 에피소드를 다시 처리하려면 반드시 `retryStep`을 명시해야 한다.

### 3-5. 입력 검증 ✅

- `youtubeUrl` (필수): `watch?v=`, `youtu.be/` 등 주요 포맷에서 **`videoId` 추출이 가능**해야 한다. 추출 불가 시 **`400`**.
- `transcriptUrl` (필수): **비어있지 않은 문자열**인지만 검증한다. (도메인 강제 없음 — 기본 검증만)
- 두 값 모두 누락/빈 값/비문자열이면 **`400`**.

### 3-6. 실패 시 아티펙트 처리 ✅

- 파이프라인이 중간 실패하면(예: `matchRate < 0.85`), **이미 다운로드된 산출물은 유지**한다(롤백·삭제하지 않음).
- `import-state.json`에 다음을 기록한다:
  - `status: failed`
  - `currentStep`: 실패한 단계
  - `error`: 사람이 읽을 수 있는 사유 (예: `"matchRate 0.72 < 0.85"`)
- 산출물을 유지하므로 `retryStep`이 비용 큰 단계를 건너뛰고 재시도할 수 있다(3-3과 일관).

---

## 4. 입출력 명세

### 요청

```
POST /api/import
Content-Type: application/json

{
  "youtubeUrl": "https://www.youtube.com/watch?v=XXXX",   // 필수
  "transcriptUrl": "https://freakonomics.com/podcast/...", // 필수
  "retryStep": "all" | "transcript" | "subtitles"          // 선택
}
```

### 응답

| 상황                          | 코드  | 바디                                 |
| ----------------------------- | ----- | ------------------------------------ |
| 정상 수락 (신규/재시도)       | `202` | `{ videoId, status: "downloading" }` |
| 입력 검증 실패                | `400` | `{ error }`                          |
| 진행중/완료 중복 (retry 없음) | `409` | `{ error, videoId, status }`         |
| 서버 내부 오류                | `500` | `{ error }`                          |

> 파이프라인 진행/실패 결과 자체는 응답이 아니라 `import-state.json` 폴링으로 확인한다.

---

## 5. 경계 조건 (Boundary Conditions)

- **빈 값 / 비문자열 입력** → `400`.
- **videoId 추출 불가** → `400`.
- **중복 videoId** → 3-4 규칙.
- **matchRate < 0.85** → `status: failed`, 아티펙트 유지(3-6).
- **외부 의존성(yt-dlp/네트워크) 실패** → 해당 단계에서 `status: failed` + `error` 기록.
- **matchRate 임계값**은 `0.85`로 고정한다 (CLAUDE.md 정책과 동일).

---

## 6. Ubiquitous Language (용어 정의)

| 용어                   | 정의                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **임포트 파이프라인**  | `download → subtitle → transcript → alignment` 순서로 진행되는 일련의 처리 과정          |
| **videoId**            | `youtubeUrl`에서 추출한 YouTube 비디오 식별자. 에피소드 디렉토리명·식별자로 사용         |
| **단계(step)**         | 파이프라인의 한 처리 구간: `download`, `subtitle`, `transcript`, `alignment`             |
| **아티펙트(artifact)** | 단계 산출물 파일: `audio.mp3`, `subtitle.en.vtt`, `transcript.txt`, `segments.json`      |
| **import-state**       | `.shadowing/episodes/{videoId}/import-state.json`. 단계별 진행 상태의 영속화 단일 소스   |
| **matchRate**          | 대본 문장 ↔ VTT 토큰 정합 품질 지표(0~1). `< 0.85`면 잘못된 대본으로 판단해 실패 처리    |
| **retryStep**          | 부분 재시도 지시값(`all`/`transcript`/`subtitles`). 재실행 단계와 재사용 아티펙트를 결정 |
| **completed**          | 파이프라인 종착 성공 상태. `segments.json` 생성 완료 (번역 제외)                         |

---

## 7. 명시적 비범위 (이번 인터뷰에서 확정된 제외 사항)

- 한국어 번역(OpenRouter, `TRANSLATION_MODEL`) 단계 — 후속 피처로 분리.
- `transcriptUrl` 도메인/형식 엄격 검증 — 기본(비어있음) 검증만.
- 실패 시 아티펙트 롤백/삭제 — 유지 정책 채택.
- (상세 Out of Scope는 PRD 단계에서 추가 확정)
