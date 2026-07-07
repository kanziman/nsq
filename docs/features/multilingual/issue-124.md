# Issue #124 — [multilingual] 언어 선택 + 자막 전용 임포트 (큐 세그먼트)

> `/test-scenarios 124` 산출. 시그니처·시나리오 승인 게이트는 사용자 상시 정책(추천안 자동 진행)으로 통과 처리.
> **TDD Green 완료** — 전체 스위트 526/526 통과(2026-07-07).

## 1. 시그니처 명세

### 1-1. 타입 (`src/lib/types.ts`)

```ts
/** 에피소드 콘텐츠 언어. 부재 시 'en' 간주(기존 에피소드 하위호환). */
export type LanguageCode = 'en' | 'ja';

export interface EpisodeMeta {
  // ...기존 필드 유지
  language?: LanguageCode; // 신규
}

export interface ImportState {
  // ...기존 필드 유지
  language?: LanguageCode; // 신규 — 재시도 재접수용, 모든 상태 쓰기에서 보존
}

export interface ImportRequestBody {
  youtubeUrl: string; // 필수(기존)
  transcriptUrl?: string; // 선택화 — 부재 시 자막 전용 모드
  language?: LanguageCode; // 선택, 기본 'en'
  retryStep?: RetryStep; // 기존
}

/** VTT 큐(문장 이전의 표시 단위). 자막 전용 모드의 세그먼트 원천. */
export interface VttCue {
  start: number; // 초
  end: number; // 초
  text: string;
}
```

### 1-2. VTT 큐 파서 (`src/lib/utils/vtt-parser.ts`)

```ts
/**
 * WebVTT → 큐 목록. 자동자막(롤링)은 활성 라인(인라인 태그 보유)만 취해 이월 중복을 제거하고,
 * 인라인 태그는 공백 삽입 없이 제거한다(ja 무공백 보존). 빈 텍스트 큐는 스킵.
 * malformed 블록은 스킵(throw 없음).
 */
export function parseVttCues(vtt: string): VttCue[];
```

### 1-3. YouTube 스텝 (`src/lib/services/import/youtube.ts`)

```ts
// lang 인자 추가(기본 'en' — 기존 호출 무변경). --sub-langs {lang}, subtitle.{lang}.vtt 산출.
export async function fetchSubtitle(
  videoId: string,
  youtubeUrl: string,
  lang?: LanguageCode, // 기본 'en'
  runner?: Runner,
): Promise<void>;

// language 인자 추가 — meta.json에 language 영속.
export async function writeEpisodeMeta(
  videoId: string,
  youtubeUrl: string,
  language?: LanguageCode, // 기본 'en'
  runner?: Runner,
): Promise<void>;
```

- 에러: 기존과 동일(비정상 종료·산출물 부재 시 throw).

### 1-4. 큐 세그먼트 스텝 (`src/lib/services/import/cue-segments.ts`, 신규)

```ts
/**
 * subtitle.{lang}.vtt → 큐 단위 segments.json 기록 (자막 전용 모드 산출).
 * speaker는 'SPEAKER' 고정, id는 `cue-{n}`(1-base).
 * 에러: 자막 파일 부재 또는 파싱 결과 큐 0개 → throw (필수 단계 실패).
 */
export async function buildCueSegments(
  videoId: string,
  lang: LanguageCode,
): Promise<void>;

export const SUBTITLE_ONLY_SPEAKER = 'SPEAKER';
```

### 1-5. 파이프라인 (`src/lib/services/import-pipeline.ts`)

```ts
export interface PipelineSteps {
  // fetchSubtitle 시그니처에 lang 추가
  fetchSubtitle(
    videoId: string,
    youtubeUrl: string,
    lang: LanguageCode,
  ): Promise<void>;
  /** 자막 전용 모드: subtitle.{lang}.vtt → 큐 세그먼트 segments.json */
  buildCueSegments?(videoId: string, lang: LanguageCode): Promise<void>;
  fetchMeta?(
    videoId: string,
    youtubeUrl: string,
    language: LanguageCode,
  ): Promise<void>;
  // downloadAudio·fetchTranscript·alignTranscript·translate 기존 유지
}

export async function runImportPipeline(
  videoId: string,
  urls: {
    youtubeUrl: string;
    transcriptUrl?: string; // 선택화 — 부재 시 자막 전용 모드
    language?: LanguageCode; // 기본 'en'
    retryStep?: RetryStep;
  },
  steps?: PipelineSteps,
): Promise<void>;
```

- **모드 판정**: `transcriptUrl` 부재(undefined/빈문자) → 자막 전용 모드.
- **자막 전용 흐름**: `download(10) → subtitle(40) → segments(90, status 'aligning'·currentStep 'segments') → translation(95) → meta → completed(100)`. transcript 단계·alignTranscript·matchRate 게이트 실행 안 함(모니터 라벨 정비는 #125).
- **대본 정합 흐름**: 기존과 완전 동일(lang은 'en'으로 전달).
- **language 보존**: 모든 writeState에서 `ImportState.language` 유지.
- **재시도**: `retryStep: 'all'`만 자막 전용 모드에서 유효(transcript/translation 재사용 검증은 기존 로직 유지 — translation 재시도는 segments.json 재사용이라 모드 무관 동작).

### 1-6. API 라우트 (`src/app/api/import/route.ts`)

- `transcriptUrl`: 필수 검증 제거 — 존재하면 non-empty string 검증(빈 문자열이면 부재로 취급).
- `language`: 부재 시 `'en'`. `'en'|'ja'` 외 값 → **400**.
- `language === 'ja' && transcriptUrl 존재` → **400** (`ja does not support transcript alignment yet`).
- 초기 ImportState에 `language` 기록, `runImportPipeline`에 전달.
- GET·409·retryStep 분기 기존 유지.

### 1-7. 클라이언트 (`src/lib/utils/import-form.ts`, `ImportForm.tsx`, `ImportMonitor.tsx`)

```ts
// import-form.ts — language 인자 추가
export function isSubmittable(
  youtubeUrl: string,
  transcriptUrl: string,
  language: LanguageCode,
): boolean;
// 규칙: youtubeUrl은 http(s) 필수.
// en: transcriptUrl은 비어있거나(자막 전용) http(s)여야 제출 가능.
// ja: transcriptUrl이 비어있어야 제출 가능(폼에서 입력 자체를 숨김).
```

- `ImportForm`: `language` 상태(기본 `'en'`) + 세그먼티드 버튼(EN/JA). `ja` 선택 시 대본 URL 입력 숨김·값 초기화. POST 바디: `transcriptUrl`은 공백이면 생략, `language` 항상 포함. 대본 URL 라벨에 "(선택)" 표기.
- `ImportMonitor.handleRetry`: 바디에 `language: state.language`, `transcriptUrl`은 state에 없으면 생략.

## 2. 테스트 시나리오

### parseVttCues (vtt-parser)

- [x] [정상] parseVttCues — should return cues with start/end seconds and tag-free text when given manual VTT
- [x] [정상] parseVttCues — should keep only active lines and dedupe carried-over text when given YouTube rolling auto captions
- [x] [정상] parseVttCues — should preserve no-space text (no space insertion) when removing inline tags from ja auto captions
- [x] [경계] parseVttCues — should skip cues with empty text when blocks contain timing but no content
- [x] [경계] parseVttCues — should return empty array when vtt has no timing blocks
- [x] [예외] parseVttCues — should skip malformed blocks without throwing when timing line is corrupt

### fetchSubtitle / writeEpisodeMeta (youtube)

- [x] [정상] fetchSubtitle — should pass --sub-langs ja and produce subtitle.ja.vtt when lang is 'ja'
- [x] [정상] fetchSubtitle — should default to en and produce subtitle.en.vtt when lang omitted (기존 회귀)
- [x] [예외] fetchSubtitle — should throw when neither manual nor auto subtitle artifact is produced (기존 회귀, ja 경로)
- [x] [정상] writeEpisodeMeta — should persist language in meta.json when language is 'ja'
- [x] [정상] writeEpisodeMeta — should default language to 'en' when omitted (기존 회귀)

### buildCueSegments (cue-segments)

- [x] [정상] buildCueSegments — should write segments.json with speaker 'SPEAKER', cue-{n} ids and cue timings when subtitle.ja.vtt has cues
- [x] [경계] buildCueSegments — should keep cue order and non-overlapping monotonic start times when rolling captions repeat text
- [x] [예외] buildCueSegments — should throw when subtitle.{lang}.vtt is missing
- [x] [예외] buildCueSegments — should throw when parsed cue list is empty

### runImportPipeline (모드 분기)

- [x] [정상] runImportPipeline — should run download→subtitle→segments→translation→meta→completed without transcript/alignment when transcriptUrl is absent
- [x] [정상] runImportPipeline — should keep existing transcript+alignment flow with matchRate gate when transcriptUrl is present (기존 회귀)
- [x] [정상] runImportPipeline — should preserve language in every import-state write when language is 'ja'
- [x] [경계] runImportPipeline — should treat empty-string transcriptUrl as subtitle-only mode
- [x] [예외] runImportPipeline — should mark failed at subtitle step when fetchSubtitle throws in subtitle-only mode
- [x] [예외] runImportPipeline — should mark failed at segments step when buildCueSegments throws
- [x] [정상] runImportPipeline — should still complete when translate throws in subtitle-only mode (best-effort 유지)

### POST /api/import (route)

- [x] [정상] POST — should accept 202 and start subtitle-only pipeline when body has youtubeUrl + language 'ja' and no transcriptUrl
- [x] [정상] POST — should accept 202 with legacy body (youtubeUrl + transcriptUrl, no language) and default language 'en' (기존 회귀)
- [x] [경계] POST — should treat blank transcriptUrl as absent and accept subtitle-only import for language 'en'
- [x] [예외] POST — should return 400 when language is not 'en' or 'ja'
- [x] [예외] POST — should return 400 when language 'ja' is combined with transcriptUrl
- [x] [정상] POST — should persist language in initial import-state when accepted

### isSubmittable (import-form)

- [x] [정상] isSubmittable — should return true when en + valid youtubeUrl + valid transcriptUrl (기존 회귀)
- [x] [정상] isSubmittable — should return true when en + valid youtubeUrl + empty transcriptUrl (자막 전용)
- [x] [정상] isSubmittable — should return true when ja + valid youtubeUrl + empty transcriptUrl
- [x] [경계] isSubmittable — should return false when en + transcriptUrl is non-empty but not http(s)
- [x] [예외] isSubmittable — should return false when ja + non-empty transcriptUrl

### ImportForm (UI)

- [x] [정상] ImportForm — should render language segmented buttons with 'en' selected by default
- [x] [정상] ImportForm — should hide transcript input and clear its value when 'ja' is selected
- [x] [정상] ImportForm — should POST body with language and without transcriptUrl when ja import is submitted
- [x] [정상] ImportForm — should POST legacy en body including transcriptUrl when en + transcript provided (기존 회귀)
- [x] [예외] ImportForm — should show error and keep form when API returns 400

### ImportMonitor (재시도 컨텍스트)

- [x] [정상] ImportMonitor — should include language and omit transcriptUrl in retry body when state has language 'ja' and no transcriptUrl
- [x] [정상] ImportMonitor — should show 전체 재시도(all) for failed subtitle step in subtitle-only import (기존 매핑 재사용)

## 3. AC 교차 대조

| AC                                                                                                      | 커버 시나리오                                                                                                                                  |
| :------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: ja 선택+대본 없음 제출 → 202, subtitle.ja.vtt·큐 segments.json·meta(language:'ja') 생성, completed | POST 202 ja / fetchSubtitle ja / buildCueSegments 정상 / runImportPipeline subtitle-only 정상 / writeEpisodeMeta language / ImportForm ja 제출 |
| AC2: ja completed 에피소드 열람 → 큐 세그먼트 표시·재생·A-B 반복 동작                                   | buildCueSegments 산출 스키마(기존 Segment 계약 준수) + 기존 플레이어 테스트 회귀(신규 UI 변경 없음 — E2E는 /create-pr 단계에서 확인)           |
| AC3: en+대본 입력 → 기존 정합 경로 그대로(matchRate 게이트, 회귀 없음)                                  | runImportPipeline transcript-present 회귀 / POST legacy body 회귀 / isSubmittable·ImportForm en 회귀                                           |
| AC4: 자막이 전혀 없는 영상 ja 임포트 → subtitle 단계 failed + 모니터 에러                               | fetchSubtitle throw 회귀 / runImportPipeline subtitle 실패 / ImportMonitor 전체 재시도 노출                                                    |
