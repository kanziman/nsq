# import-engine 이슈 분해

> 근거: [prd.md](./prd.md) · [spec-fixed.md](./spec-fixed.md)
> 원칙: 수직 슬라이싱(각 이슈 = 산출 아티펙트로 검증 가능한 독립 동작), 의존성 순방향, 이슈당 반나절~하루 TDD.
> 아키텍처: ADR-002(시나리오 C) — 순수 함수 코어 + 얇은 어댑터.

## GitHub 등록 매핑 (kanziman/nsq)

| 로컬    | GitHub                                           | 의존성(GitHub)     |
| ------- | ------------------------------------------------ | ------------------ |
| Issue 1 | [#9](https://github.com/kanziman/nsq/issues/9)   | —                  |
| Issue 2 | [#10](https://github.com/kanziman/nsq/issues/10) | #9                 |
| Issue 3 | [#11](https://github.com/kanziman/nsq/issues/11) | —                  |
| Issue 4 | [#12](https://github.com/kanziman/nsq/issues/12) | #10, #11           |
| Issue 5 | [#13](https://github.com/kanziman/nsq/issues/13) | #12                |
| Issue 6 | [#14](https://github.com/kanziman/nsq/issues/14) | #9 #10 #11 #12 #13 |

> 칸반 보드 추가는 `read:project` 스코프 부재로 생략(`gh auth refresh -s project,read:project` 후 `gh project item-add` 가능).

## 공통 전제

- **관찰 지점(검증 소스)**: `.shadowing/episodes/{videoId}/`의 산출 파일(`audio.mp3`/`subtitle.en.vtt`/`transcript.txt`/`segments.json`)과 `import-state.json` 상태 전이.
- **계약 고정**: `PipelineSteps` 시그니처·산출 파일명 불변. 단계 함수는 실패 시 **throw만**(상태 기록은 오케스트레이터).
- **결정적 테스트**: 외부 부수효과(yt-dlp·네트워크)는 주입형 **runner/fetcher**를 fake로 대체. 순수 함수 코어(`vtt/parse`·`transcript/parse`·`align/*`)는 입출력 fixture로 단위 검증.
- **위치**: 어댑터는 `src/lib/services/import/{youtube,transcript,alignment}.ts`, 순수 코어는 그 하위 폴더(`vtt/`, `transcript/`, `align/`).

---

## Issue 1 — youtube: `downloadAudio` → `audio.mp3` (+ runner 추상화 확립)

**목적**: 유효 `youtubeUrl`로 호출 시 yt-dlp가 mp3 오디오를 산출한다. 이후 단계가 재사용할 **주입형 runner**를 확립한다.

**범위**

- `src/lib/services/import/youtube.ts` `downloadAudio` 구현.
- 주입형 `runner`(기본 `child_process.spawn` 래퍼) 도입, `YT_DLP_PATH`/`YT_DLP_TIMEOUT_MS` env 해석, `.env.example` 갱신.
- yt-dlp 인자: `--extract-audio --audio-format mp3 --audio-quality 0`, 출력 템플릿 → `audio.mp3`. 항상 덮어쓰기.

**Acceptance Criteria**

- **Given** 유효 `youtubeUrl`과 성공하는 fake runner, **When** `downloadAudio(videoId, url)` 호출, **Then** runner가 mp3 추출 인자와 `audio.mp3` 출력 경로로 1회 호출되고 함수가 정상 종료한다.
- **Given** `audio.mp3`가 이미 존재, **When** `downloadAudio` 재호출, **Then** runner를 다시 실행해 덮어쓴다(스킵하지 않음).
- **Given** runner가 exit≠0(또는 stderr), **When** 호출, **Then** stderr 말미를 포함한 `Error`를 throw한다.
- **Given** runner가 정상 종료했으나 `audio.mp3` 미생성, **When** 호출, **Then** throw한다.
- **Given** `YT_DLP_PATH` 설정, **When** 호출, **Then** runner가 해당 경로 바이너리로 실행된다.

**의존성**: 없음(첫 이슈, runner 확립).

---

## Issue 2 — youtube: `fetchSubtitle` → `subtitle.en.vtt` (수동→자동 폴백)

**목적**: 영어 자막을 받아 VTT로 산출한다. 수동 자막 우선, 없으면 자동생성, 둘 다 없으면 실패.

**범위**

- `src/lib/services/import/youtube.ts` `fetchSubtitle` 구현(Issue 1의 runner 재사용).
- yt-dlp: 수동 en(`--write-subs --sub-langs en`) 시도 → 산출 없으면 자동(`--write-auto-subs`) 폴백. `--sub-format vtt --convert-subs vtt`, 출력 → `subtitle.en.vtt`. 항상 덮어쓰기.

**Acceptance Criteria**

- **Given** 수동 en 자막 보유 영상(fake runner가 수동 단계에서 `subtitle.en.vtt` 생성), **When** `fetchSubtitle` 호출, **Then** `subtitle.en.vtt`가 산출되고 자동생성 폴백은 호출되지 않는다.
- **Given** 수동 자막 없음·자동생성 있음(fake runner가 수동 단계엔 미생성, 자동 단계에 생성), **When** 호출, **Then** 폴백이 실행되어 `subtitle.en.vtt`가 산출된다.
- **Given** 수동·자동 모두 없음, **When** 호출, **Then** `Error`를 throw하고 `subtitle.en.vtt`는 없다.
- **Given** `subtitle.en.vtt` 기존 존재, **When** 재호출, **Then** 새로 받아 덮어쓴다.

**의존성**: Issue 1(runner 추상화).

---

## Issue 3 — transcript: `fetchTranscript` → `transcript.txt` (JSONL)

**목적**: 대본 URL을 받아 HTML을 파싱, 비발화 제거·화자 정규화·문장 분할 후 `Sentence` JSONL을 산출한다.

**범위**

- 순수 함수 `src/lib/services/import/transcript/parse.ts`: HTML 문자열 → `Sentence[]`(비발화 제거, 화자 정규화, 문장 분할). `node-html-parser` 사용.
- 어댑터 `src/lib/services/import/transcript.ts` `fetchTranscript`: 주입형 `fetcher`(기본 `fetch`)로 HTML 취득 → `parse` → JSONL(`{speaker,text}` 한 줄씩) 기록. 항상 덮어쓰기.
- 테스트는 고정 HTML fixture 사용.

**Acceptance Criteria**

- **Given** Angela·Stephen 발화가 섞인 HTML fixture, **When** `fetchTranscript` 호출, **Then** `transcript.txt`가 JSONL로 기록되고 각 줄은 유효 `Sentence`이며 화자가 `DUCKWORTH`/`DUBNER`로 정규화된다.
- **Given** 게스트/아나운서 등 매핑 외 화자, **When** 파싱, **Then** 해당 문장의 speaker는 `NARRATOR`다.
- **Given** `[LAUGHTER]`·`(MUSIC)`·광고/각주 등 비발화, **When** 파싱, **Then** 결과 문장에 포함되지 않는다.
- **Given** 한 문단에 여러 문장, **When** 파싱, **Then** 문장 경계로 분할되고 각 문장에 동일 화자가 전파된다.
- **Given** fetcher가 비-2xx 반환(또는 파싱 결과 0문장), **When** 호출, **Then** throw한다.

**의존성**: 없음(youtube와 독립; `transcriptUrl`만 필요).

---

## Issue 4 — alignment 기본 정합: `subtitle.en.vtt` + `transcript.txt` → `segments.json` + matchRate

**목적**: 정상 정합 경로 — 자막 토큰과 대본 문장을 앵커링·보간해 문장 단위 타임라인 세그먼트와 품질 지표를 산출한다.

**범위**

- 순수 함수 코어: `import/vtt/parse.ts`(VTT→`VttToken[]`), `import/align/anchor.ts`(희소 공통 단어 후보), `import/align/lis.ts`(LIS), `import/align/interpolate.ts`(앵커+토큰타임→`Segment[]` 문장 타이밍, `matchRate` 산출). 정규화는 소문자·구두점 제거.
- 어댑터 `import/alignment.ts` `alignTranscript`: `subtitle.en.vtt`+`transcript.txt` 로드 → 코어 조립 → `segments.json` 기록(words 생략) + `{matchRate}` 반환.

**Acceptance Criteria**

- **Given** 잘 일치하는 VTT·transcript fixture, **When** `alignTranscript(videoId)` 호출, **Then** `segments.json`이 `Segment[]`로 기록되고 각 세그먼트는 `id/start/end/speaker/text`를 가지며 `start<end`, 시간이 단조 증가한다.
- **Given** 동일 입력, **When** 호출, **Then** 반환된 `matchRate`는 0~1이며 `앵커수/후보수` 정의와 일치한다(잘 일치하므로 ≥0.85).
- **Given** 앵커 사이 비매칭 구간, **When** 보간, **Then** 해당 문장 경계 시간이 인접 앵커 시간으로 선형 보간된다.
- **Given** 순수 함수 단위(`lis`/`anchor`/`interpolate`/`vtt/parse`), **When** fixture 입력, **Then** 각 함수가 입출력만으로 결정적으로 검증된다.

**의존성**: Issue 2(`subtitle.en.vtt`), Issue 3(`transcript.txt`).

---

## Issue 5 — alignment 품질·경계 처리

**목적**: 저품질·결손 입력에서의 안전 동작 — 낮은 matchRate도 기록, 누락 입력은 throw.

**범위**

- `import/alignment.ts` 및 코어의 경계 처리 보강.

**Acceptance Criteria**

- **Given** 거의 일치하지 않는 VTT·transcript, **When** `alignTranscript` 호출, **Then** `segments.json`은 **여전히 기록**되고 `matchRate`(<0.85)가 반환된다(함수는 throw하지 않음).
- **Given** `subtitle.en.vtt` 또는 `transcript.txt` 누락, **When** 호출, **Then** 누락 파일명을 포함한 `Error`를 throw한다.
- **Given** 공통 앵커가 0개인 입력, **When** 호출, **Then** `matchRate`는 0이고 함수는 throw하지 않는다(segments.json 기록).
- **Given** 저 matchRate를 반환하는 alignment, **When** 오케스트레이터가 호출, **Then** 상태가 `failed`로 기록되고 아티펙트는 유지된다(기존 오케스트레이터 회귀).

**의존성**: Issue 4.

---

## Issue 6 — 엔진 통합 회귀 + import-state 검증

**목적**: 네 단계가 오케스트레이터 위에서 일관되게 흐르고, 상태 전이가 올바른지 통합 검증한다. `import-state`(완료분) 회귀 확인 포함.

**범위**

- 통합 테스트: `runImportPipeline`에 **fake runner/fetcher가 주입된 실제 단계 모듈**(또는 산출물 fixture)을 구성해 전체 흐름 검증. 신규 프로덕션 코드 최소(주로 배선·회귀).
- `import-state` 갭 확인(전이·`translating` 미사용 보존).

**Acceptance Criteria**

- **Given** 전체 성공 경로(모든 단계 성공·matchRate≥0.85), **When** `runImportPipeline(videoId, {youtubeUrl, transcriptUrl})`, **Then** 4개 아티펙트가 모두 생성되고 `import-state.json`이 `downloading→processing_subtitles→processing_transcript→aligning→completed(progress 100)`로 전이한다.
- **Given** `retryStep='transcript'`와 기존 `audio.mp3`/`subtitle.en.vtt`, **When** 실행, **Then** download/subtitle은 재실행되지 않고 transcript·alignment만 수행되어 `completed`가 된다.
- **Given** 한 단계가 throw, **When** 실행, **Then** 상태가 해당 `currentStep`의 `failed`로 기록되고 후속 단계는 실행되지 않으며 아티펙트는 유지된다.
- **Given** 기존 `import-state` 단위 테스트(`saveImportState`/`getImportState`), **When** 전체 테스트 실행, **Then** 회귀 없이 통과한다.

**의존성**: Issue 1·2·3·4·5.

---

## 의존성 그래프

```text
Issue 1 (downloadAudio, runner) ─┐
Issue 2 (fetchSubtitle) ─────────┤
Issue 3 (fetchTranscript) ───────┤
                                  ├─ Issue 4 (alignment 기본) ─ Issue 5 (alignment 경계) ─┐
                                  └──────────────────────────────────────────────────────┴─ Issue 6 (통합 회귀)
```

- Issue 1 → 2 (runner 재사용). Issue 4 ← 2(subtitle)+3(transcript). Issue 5 ← 4. Issue 6 ← 전부.
- Issue 3은 1·2와 병렬 가능(독립).

## ✅ GATE 4 체크리스트

- [ ] 각 이슈가 산출 아티펙트로 **독립 검증 가능**(수직 슬라이스)한가
- [ ] 수평 분할(레이어별) 아님 — 순수함수는 해당 수직 이슈 내부 단위로 포함
- [ ] 의존성 순방향·이슈당 반나절~하루 크기
- [ ] AC가 Given-When-Then 형식·관찰 지점 명확
- [ ] 승인 시 `gh issue create`로 등록
