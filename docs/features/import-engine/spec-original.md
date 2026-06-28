# import-engine — 초기 아이디어 (spec-original)

> 초기 기능 정의서. 인터뷰(Stage 1)를 거쳐 `spec-fixed.md`로 확정된다.

## 한 줄 정의

임포트 파이프라인의 **백엔드(엔진)를 완성**한다. UI 없이 파일시스템·알고리즘으로만 도는 순수 로직 영역
(`import-youtube` + `import-transcript` + `import-alignment` + `import-state`)을 **하나의 통합 엔진**으로 기획해
데이터 파이프라인의 정합성을 한눈에 설계한다.

## 왜 하나로 묶나

네 모듈은 모두 UI가 없고, `.shadowing/episodes/{videoId}/` 아래 파일 산출과 알고리즘으로만 동작한다.
오케스트레이터(`runImportPipeline`)는 이미 완성돼 있고, 이들을 **DI 계약(`PipelineSteps`)** 으로 호출한다.
엔진을 한 번에 설계하면 `audio.mp3 → subtitle.en.vtt → transcript.txt → segments.json`로 흐르는
데이터 시즌(seam)을 일관되게 잡을 수 있다.

## 범위 모듈 (source of truth 기준 현황)

| 모듈              | 구현 대상                                                                                                                                 | 현황                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| import-youtube    | [src/lib/services/import/youtube.ts](../../../src/lib/services/import/youtube.ts) `downloadAudio`, `fetchSubtitle`                        | 스텁(throw)                                                       |
| import-transcript | [src/lib/services/import/transcript.ts](../../../src/lib/services/import/transcript.ts) `fetchTranscript`                                 | 스텁(throw)                                                       |
| import-alignment  | [src/lib/services/import/alignment.ts](../../../src/lib/services/import/alignment.ts) `alignTranscript`                                   | 스텁(throw)                                                       |
| import-state      | `ImportState` 타입 + `saveImportState`/`getImportState` ([episodes.ts](../../../src/lib/services/episodes.ts)) + 오케스트레이터 상태 전이 | **이미 구현·테스트 완료** (import-api 작업 산출). 잔여 갭만 확인. |

> checklist.json의 경로(`src/lib/youtube.ts`, `freakonomics.ts`, `import-state.ts` 등)와 썸네일 언급은 실제 소스와 어긋남. **소스가 진실의 원천.**

## 계약 (변경 금지 고정점)

`PipelineSteps` ([import-pipeline.ts](../../../src/lib/services/import-pipeline.ts)):

- `downloadAudio(videoId, youtubeUrl)` → `audio.mp3`
- `fetchSubtitle(videoId, youtubeUrl)` → `subtitle.en.vtt`
- `fetchTranscript(videoId, transcriptUrl)` → `transcript.txt`
- `alignTranscript(videoId)` → `segments.json` 산출, `{ matchRate }` 반환

오케스트레이터는 `matchRate < 0.85`면 `failed` 기록(롤백 없음). 단계 함수는 실패 시 throw만.

## 데이터 흐름

```
youtubeUrl ─┬─[downloadAudio]──→ audio.mp3
            └─[fetchSubtitle]──→ subtitle.en.vtt ─┐
transcriptUrl ─[fetchTranscript]─→ transcript.txt ┴─[alignTranscript]→ segments.json (+matchRate)
모든 단계 → import-state.json 상태 전이 (오케스트레이터가 기록)
```

## 환경

- 시스템에 `yt-dlp`, `ffmpeg` 설치됨.
- 외부 의존: YouTube(yt-dlp), freakonomics.com(HTTP fetch).

## 열린 질문 (인터뷰에서 해결)

- (youtube) 썸네일·자막소스·멱등성·호출방식·포맷·타임아웃 → **확정됨** (spec-fixed §A).
- (transcript) transcript.txt 스키마(화자 포함 형식), HTML 파싱 방식(의존성 vs 정규식, fetcher 주입), 화자 정규화 규칙, 비발화 제거 범위, 문장 분할.
- (alignment) matchRate 정의(공식), 세그먼트 단위(문장 vs 단어 타임스탬프), 앵커링/보간 세부, 저 matchRate 시 segments.json 기록 여부.
- (state) 잔여 갭 — `translating` 상태 등 미사용 가치 확인.
