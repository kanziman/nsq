# import-engine — 확정 요구사항 (spec-fixed)

> Stage 1 인터뷰로 확정된 요구사항. 근거 아이디어: [spec-original.md](./spec-original.md)
> 다음 단계: 이 문서 승인(GATE 1) → PRD/ADR 작성.

---

## 1. 개요 / 한 줄 정의

임포트 파이프라인의 **백엔드 엔진**을 완성한다. UI 없이 파일시스템·알고리즘으로만 도는 순수 로직 영역
(`import-youtube` + `import-transcript` + `import-alignment` + `import-state`)을 하나의 통합 엔진으로 설계한다.
오케스트레이터(`runImportPipeline`)와 계약(`PipelineSteps`)·파일명·산출 위치는 **고정**이며 변경하지 않는다.
구현 대상은 세 스텁(`fetchSubtitle`/`downloadAudio`, `fetchTranscript`, `alignTranscript`)을 동작 구현으로 채우는 것이고,
`import-state`는 **이미 구현·테스트 완료**라 갭 확인만 한다.

## 2. 핵심 사용자 (Primary User)

직접 사용자는 **임포트 오케스트레이터**(`runImportPipeline`)다. 단계 모듈은 사람 UI가 아니라 파이프라인이 DI로
호출하는 내부 로직이다. 최종 수혜자는 쉐도잉 콘텐츠를 임포트하는 앱 사용자.
→ 검증은 산출 아티펙트와 `import-state.json` 상태 전이로 한다.

## 3. 데이터 흐름 (seam)

```text
youtubeUrl ─┬─[downloadAudio]──→ audio.mp3
            └─[fetchSubtitle]──→ subtitle.en.vtt ─┐
transcriptUrl ─[fetchTranscript]─→ transcript.txt ┴─[alignTranscript]→ segments.json (+matchRate)
모든 단계 → import-state.json 상태 전이 (오케스트레이터가 기록)
```

## 4. 최소 동작 시나리오

1. **정상 임포트(전체)**: 유효 `youtubeUrl`+`transcriptUrl` → `audio.mp3`, `subtitle.en.vtt`, `transcript.txt`,
   `segments.json` 생성, matchRate≥0.85, 상태 `completed`.
2. **부분 재시도**: `retryStep='transcript'` → 기존 `audio.mp3`/`subtitle.en.vtt` 재사용, `transcript`·`alignment`만 재실행.
3. **저품질 중단**: 정합 결과 matchRate<0.85 → `segments.json`은 기록되되 상태 `failed`(아티펙트 유지, 롤백 없음).

---

## 5. 확정 결정 — A. import-youtube (`src/lib/services/import/youtube.ts`)

| #   | 항목        | 결정                                                                                                                                                                                                             |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 썸네일      | **Out of Scope.** 계약(`PipelineSteps`) 확장 없음. checklist 썸네일 언급 무시(소스가 진실의 원천).                                                                                                               |
| A2  | 자막 소스   | **수동(en) 우선 → 없으면 자동생성(en) 폴백 → 둘 다 없으면 실패.** 산출은 항상 `subtitle.en.vtt`(VTT).                                                                                                            |
| A3  | 멱등성      | **항상 덮어쓰기.** 단계는 멱등 재생성만 책임. "어떤 단계 재실행"은 오케스트레이터 `retryStep`이 결정.                                                                                                            |
| A4  | yt-dlp 호출 | 기본 PATH의 `yt-dlp`, `YT_DLP_PATH` 환경변수로 오버라이드(.env.example 추가). 프로세스 실행은 **주입 가능한 runner**(기본 `child_process.spawn`)로 래핑 → 테스트는 fake runner로 결정적 검증(CLAUDE.md DI 관습). |
| A5  | 오디오 포맷 | mp3. yt-dlp `--extract-audio --audio-format mp3 --audio-quality 0`(최고 품질), ffmpeg 후처리.                                                                                                                    |
| A6  | 타임아웃    | 프로세스당 기본 300초, `YT_DLP_TIMEOUT_MS`로 오버라이드. 초과 시 프로세스 종료 후 throw.                                                                                                                         |
| A7  | 실패 감지   | (a) runner exit≠0 → `stderr` 말미 포함 `Error` throw. (b) 정상 종료했으나 기대 산출물 미생성 → throw.                                                                                                            |

## 6. 확정 결정 — B. import-transcript (`src/lib/services/import/transcript.ts`)

| #   | 항목                  | 결정                                                                                                                                                               |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | transcript.txt 스키마 | **JSONL.** 한 줄 = `{"speaker": <4종>, "text": <문장>}` (types.ts `Sentence`). 확장자 .txt는 계약 고정, 내용은 JSONL. alignment가 파싱 없이 바로 읽음.             |
| B2  | fetch/파싱            | **주입 가능한 fetcher**(기본 `fetch`, 테스트는 고정 HTML fixture 반환). 파싱은 **경량 HTML 파서 의존성 추가**(linkedom 또는 node-html-parser 후보 — PRD에서 확정). |
| B3  | 화자 정규화           | Angela(Duckworth)→`DUCKWORTH`, Stephen/Steven(Dubner)→`DUBNER`, 공동 발화 표기→`BOTH`, **그 외 전부(게스트·아나운서 등)→`NARRATOR`.**                              |
| B4  | 비발화 제거           | 대괄호/괄호 큐(`[LAUGHTER]`, `(MUSIC)` 등), 광고·후원 리드, 각주/메타 텍스트 제거. (구체 패턴은 PRD에서 fixture 기반 확정)                                         |
| B5  | 문장 분할             | 문단을 문장 경계(마침표·물음표·느낌표 + 공백) 기준으로 분할, 화자 라벨은 분할된 각 문장에 전파.                                                                    |
| B6  | 실패                  | fetch 비-2xx/네트워크 오류 → throw. 파싱 결과 문장 0개 → throw.                                                                                                    |

## 7. 확정 결정 — C. import-alignment (`src/lib/services/import/alignment.ts`)

| #   | 항목              | 결정                                                                                                                                                                                                                                      |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | matchRate 정의    | **`anchored / candidate`** = (LIS로 앵커 확정된 대본 단어 수) / (앵커 후보 대본 단어 수). 0~1. 정확한 분모·분자 정의는 PRD에 명기.                                                                                                        |
| C2  | 세그먼트 입도     | **문장 단위 타이밍만.** Segment = `{id, start, end, speaker, text}`. `words[]`는 **생략**(후속 확장).                                                                                                                                     |
| C3  | 저 matchRate 기록 | **segments.json 항상 기록** + `{matchRate}` 반환. 합격/실패 판단은 오케스트레이터 단독(임계값 0.85는 오케스트레이터에만 존재).                                                                                                            |
| C4  | 알고리즘          | VTT 파싱→토큰(`VttToken`), 대본 문장→토큰. 정규화(소문자·구두점 제거) 후 **양쪽에 1회씩만 등장하는 희소 공통 단어**를 앵커 후보로, **patience-diff + LIS**로 단조 증가 앵커 집합 확정, 앵커 사이는 **선형 보간**으로 문장 경계 시간 산출. |
| C5  | 실패              | 입력(`subtitle.en.vtt` 또는 `transcript.txt`) 누락 → throw.                                                                                                                                                                               |

## 8. 확정 결정 — D. import-state

| #   | 항목          | 결정                                                                                                                                                                                   |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 현황          | `ImportState` 타입 + `saveImportState`/`getImportState`([episodes.ts](../../../src/lib/services/episodes.ts)) + 오케스트레이터 상태 전이 — **이미 구현·테스트 완료**(import-api 산출). |
| D2  | 잔여 작업     | **재구현 없음.** 엔진 통합 관점에서 상태 전이 일관성만 검증(회귀 테스트 존재 확인).                                                                                                    |
| D3  | `translating` | `ImportState.status`에 정의돼 있으나 번역 단계가 이번 범위 밖이라 **미사용**. 제거하지 않고 보존(후속 번역 피처용).                                                                    |

---

## 9. 경계 조건

- **빈/잘못된 URL**: 본 엔진 책임 아님. `extractVideoId`·라우트 검증(import-api)에서 이미 차단. 단계는 유효 입력 전제.
- **디렉토리 미존재**: `.shadowing/episodes/{videoId}/` 없으면 생성 후 기록(episodes.ts `ensureDir` 패턴).
- **부분 산출물 잔존**: youtube는 덮어쓰기(A3). transcript/alignment도 매 실행 새로 기록.
- **자막/대본 토큰 불일치 심함**: 낮은 matchRate로 반영, throw 아님(C3) — 오케스트레이터가 failed 처리.

## 10. 에러 처리 / 전파 원칙

- 단계 함수는 실패 시 **throw만** 한다(상태 파일 직접 쓰지 않음). 상태(`failed`)·에러 메시지·롤백-없음은 오케스트레이터 담당.
- 에러 메시지는 원인 식별 가능하게: yt-dlp는 `stderr` 말미, transcript는 HTTP status/원인, alignment는 누락 입력명 포함.

## 11. 성능 제약

- 다운로드/스크래핑은 수 분 가능 → 비동기 파이프라인(202+폴링) 위에서 동작, 단계 SLA 없음. 단 yt-dlp는 타임아웃(A6)으로 무한 대기 방지.
- 정합 알고리즘은 단일 에피소드(수백~수천 토큰) 대상 → 메모리 내 처리로 충분.

## 12. 기존 패턴 / 재사용 / 종속성

- `extractVideoId`([utils/youtube.ts](../../../src/lib/utils/youtube.ts)) — 호출부에서 이미 사용.
- 파일 IO: [episodes.ts](../../../src/lib/services/episodes.ts) `ensureDir`/`readJson` 패턴.
- 타입: `Sentence`, `VttToken`, `Segment`([types.ts](../../../src/lib/types.ts)), 화자 매핑 참조 [constants/speakers.ts](../../../src/lib/constants/speakers.ts)(name: Angela/Steven).
- **모듈 간 의존**: subtitle+transcript → alignment (순방향). state는 독립(완료).
- 신규 의존성: 경량 HTML 파서 1종(B2) — PRD에서 확정.

## 13. 용어 정의 (Ubiquitous Language)

| 용어                        | 정의                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **단계 모듈(step module)**  | 파이프라인 한 단계를 구현하는 함수. 본 엔진: download·subtitle·transcript·alignment.                                                   |
| **runner**                  | 외부 프로세스(yt-dlp) 실행 추상. 기본 `child_process.spawn`, 테스트는 fake 주입.                                                       |
| **fetcher**                 | HTTP GET 추상(transcript). 기본 `fetch`, 테스트는 fixture 반환.                                                                        |
| **산출 아티펙트(artifact)** | 단계가 디스크에 남기는 파일: `audio.mp3`, `subtitle.en.vtt`, `transcript.txt`, `segments.json`. 위치 `.shadowing/episodes/{videoId}/`. |
| **수동/자동생성 자막**      | 업로더 자막 vs 음성인식 자막. manual(en) 우선, auto(en) 폴백.                                                                          |
| **앵커(anchor)**            | 자막·대본 양쪽에 1회씩만 등장하는 희소 공통 단어. patience-diff+LIS로 단조 매칭.                                                       |
| **matchRate**               | 앵커로 확정된 대본 단어 비율(0~1). 0.85 임계값은 오케스트레이터에만 존재.                                                              |
| **멱등 재생성**             | 기존 산출물 유무와 무관하게 새로 받아 덮어쓰는 동작.                                                                                   |
| **계약(contract)**          | `PipelineSteps` 인터페이스. 시그니처·산출 파일명 고정.                                                                                 |

---

## ✅ GATE 1 체크리스트

- [ ] 스코프 통합(4모듈 = import-engine) 동의, import-state는 갭 확인만(재구현 없음)
- [ ] A. youtube 결정(A1~A7) 동의
- [ ] B. transcript 결정(B1~B6): transcript.txt=JSONL, fetcher 주입+경량 파서, 화자 정규화, 비발화 제거
- [ ] C. alignment 결정(C1~C5): matchRate 공식, 문장 단위, 저품질도 기록
- [ ] 신규 의존성(경량 HTML 파서) 추가 허용
- [ ] 용어 정의 합의
