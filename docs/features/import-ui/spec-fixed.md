# import-ui (프론트엔드 연동) — 확정 요구사항 (spec-fixed)

> 1단계 인터뷰로 확정. [GATE 1] 승인 대기.
> 범위: `import-form-ui` + `import-page`. 백엔드 엔진(#9~#14)·`POST /api/import`는 구현 완료 전제.

## 1. 핵심 사용자 (Primary User)

콘텐츠를 임포트하는 **앱 사용자**. `/import` 화면에서 YouTube URL + 대본 URL을 입력·제출하고, 4단계 파이프라인 진행을 모니터링하며, 실패 시 해당 단계를 재시도한다. 최종 수혜는 임포트된 에피소드로 쉐도잉 학습.

## 2. 최소 동작 시나리오 (3)

1. **정상 임포트**: 두 URL 입력 → 제출 → 202 접수 → 폴링으로 4단계 타임라인(다운로드→자막→대본→정합) 순차 진행 → `completed`(성공 상태 + matchRate, '새 임포트'/에피소드 placeholder).
2. **검증/접수 실패**: 빈값·비 http(s) → 제출 버튼 비활성(클라 검증). 통과했으나 서버가 400(videoId 추출 실패)·409(이미 진행중/완료)·500 → 폼 하단 **인라인 에러**.
3. **실패 후 재시도**: 정합 단계 실패(저 matchRate 등) → 타임라인에 `정합` 단계 실패 표시 → **컨텍스트 재시도** 버튼([대본·정합 재시도] = `retryStep='transcript'`) → 재접수·재폴링.

## 3. 데이터 흐름 (통신)

```
[폼] ──POST /api/import {youtubeUrl, transcriptUrl, retryStep?}──▶ 202 {videoId, status:'downloading'}
[모니터] ──poll(2~3s) GET /api/import?videoId=X──▶ ImportState {status, progress, currentStep, error?}
           └ status ∈ {completed, failed} 이면 폴링 중단
```

- **신설 필요**: `GET /api/import?videoId=` — `getImportState(videoId)` 반환(없으면 404/`null`). 폼·모니터의 유일한 상태 소스.
- POST 응답코드: 202(접수)/400(검증)/409(중복)/500(예외) — 기존 라우트 그대로.

## 4. status → step 매핑 (4단계 타임라인)

| 단계(step) | 진행중 status             | progress(참고) |
| ---------- | ------------------------- | -------------- |
| 다운로드   | `downloading`             | 10             |
| 자막       | `processing_subtitles`    | 40             |
| 대본       | `processing_transcript`   | 70             |
| 정합       | `aligning`                | 90             |
| (터미널)   | `completed`(100)/`failed` | —              |

- 각 단계 표시 상태: 현재 status 기준 **이전 단계=완료 / 현재=진행 / 이후=대기**. `failed`면 `currentStep`=실패, 그 이전=완료.
- `idle`/`translating` 상태는 본 화면에서 **미사용**(보존). 전체 progress 게이지(0~100) 병행.

## 5. 컨텍스트 재시도 ↔ retryStep 매핑

| 실패 currentStep         | 노출 버튼          | retryStep    | 근거(재사용 아티펙트)              |
| ------------------------ | ------------------ | ------------ | ---------------------------------- |
| `download`/`subtitle`    | [전체 재시도]      | `all`        | 재사용 가능 산출물 없음 → 전체     |
| `transcript`/`alignment` | [대본·정합 재시도] | `transcript` | audio.mp3 + subtitle.en.vtt 재사용 |

- `subtitles` retryStep은 audio+transcript 재사용을 요구하나 자막 실패 시점엔 transcript가 없어 **미사용**(단순·안전).
- 재시도 제출은 동일 `POST /api/import`에 `retryStep` 동봉.

## 6. 에러·경계 처리 (UI 전달)

- **클라 검증**: 두 URL 비었거나 http(s) 형태 아니면 제출 비활성.
- **400**: "youtubeUrl is required" 등 서버 메시지 인라인.
- **409**: "이미 {status} 상태입니다" 인라인 — 진행중이면 모니터로 안내(해당 videoId 폴링).
- **500**: 일반 에러 인라인 + 재시도 가능.
- **폴링 404/null**: "상태를 찾을 수 없음" 처리(접수 직후 레이스 대비 짧은 재시도 허용).

## 7. 기존 UI 재사용·성능

- 컴포넌트: `ui/button`(primary/secondary), `ui/input`, `ui/card`, `ui/badge`(단계 상태 칩). 디자인 시스템 토큰(CSS 변수) 준수, 하드코딩 색상 금지.
- 폴링 2~3초, 터미널 상태에서 중단. 파이프라인은 수 분 가능 → 무한 폴링 방지(터미널 중단으로 충족).

## 8. 진입·네비게이션

- 홈(`app/page.tsx`)에 **/import 진입 버튼** 추가.
- `completed` 시 성공 상태 + '새 임포트'. **에피소드 보기 링크는 placeholder/비활성**(에피소드 상세·목록 화면은 본 범위 밖).

## 9. 용어 정의 (Ubiquitous Language)

| 용어                | 정의                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| **임포트 폼**       | YouTube URL + 대본 URL 입력·제출 UI (`import-form`).                  |
| **모니터**          | 접수된 videoId의 상태를 폴링해 4단계 타임라인+게이지로 보여주는 영역. |
| **단계(step)**      | 파이프라인 4단계: 다운로드·자막·대본·정합.                            |
| **폴링(polling)**   | `GET /api/import?videoId=`를 2~3초 간격 호출, 터미널 상태에서 중단.   |
| **컨텍스트 재시도** | 실패한 currentStep에 맞춰 안전한 retryStep만 노출하는 재시도.         |
| **터미널 상태**     | `completed` 또는 `failed` — 폴링 종료 조건.                           |
| **진입 버튼**       | 홈 → `/import` 이동 버튼.                                             |

## 10. Out of Scope (예고 — PRD에서 확정)

- 에피소드 상세/목록 화면, 플레이어 연결
- 실시간 푸시(SSE/WebSocket) — 폴링으로 대체
- 썸네일·메타 표시, translating(번역) 단계 UI
- 임포트 이력/큐 관리, 동시 다중 임포트 대시보드
