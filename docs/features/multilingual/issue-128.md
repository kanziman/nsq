# Issue #128 — [multilingual] 후리가나 생성 + RubyText 렌더링

> `/test-scenarios 128` 산출. 승인 게이트는 사용자 상시 정책(추천안 자동 진행)으로 통과 처리.

## 1. 시그니처 명세

### 1-1. 타입 (`src/lib/types.ts`)

```ts
/** 루비 토큰 — text 전체를 덮는 시퀀스 조각. 한자 조각만 rt(요미가나) 보유 (spec-fixed B6). */
export interface RubyToken {
  text: string;
  rt?: string;
}

export interface Segment {
  // ...기존 유지
  ruby?: RubyToken[]; // 신규 — 렌더 시 join(text)===segment.text 검증 실패면 무시
}
```

### 1-2. 후리가나 스텝 (`src/lib/services/import/furigana.ts`, 신규 — translation 동형)

```ts
/** 세그먼트 배치를 받아 동일 길이의 루비 시퀀스 배열을 반환하는 주석기 계약. */
export type FuriganaAnnotator = (batch: Segment[]) => Promise<RubyToken[][]>;

export interface AnnotateFuriganaDeps {
  annotator: FuriganaAnnotator;
  batchSize?: number; // 기본 20 (translation과 동일)
}

/**
 * segments.json에서 한자 포함 && ruby 없는 세그먼트만 배치로 주석 → ruby 주입 재기록.
 * - 멱등: ruby 있는 세그먼트 스킵. 한자 없는 세그먼트 스킵(루비 불필요).
 * - 세그먼트별 검증: tokens.map(t=>t.text).join('') === segment.text 불일치 → 그 세그먼트 폐기.
 * - 배치 실패/길이 불일치 → 그 배치 스킵(격리), 배치 성공마다 증분 저장. best-effort.
 * - segments.json 부재 → throw(파이프라인이 흡수).
 */
export async function annotateFurigana(
  videoId: string,
  deps: AnnotateFuriganaDeps,
): Promise<void>;

/** OpenRouter 기반 annotator 팩토리. 파싱/길이 불일치 → [], HTTP/키 부재 → throw. */
export function createOpenRouterFuriganaAnnotator(
  config: OpenRouterConfig,
): FuriganaAnnotator;

export function hasKanji(text: string): boolean; // CJK 통합 한자 범위
```

### 1-3. 파이프라인 (`src/lib/services/import-pipeline.ts`)

```ts
export interface PipelineSteps {
  /** furigana(자막 전용 ja): Segment.ruby 주입 (best-effort, 상태 슬롯 없음) */
  annotateFurigana?(videoId: string): Promise<void>;
}
```

- 자막 전용 모드에서 `language === 'ja'`일 때만 translate 직후 실행. try/catch 삼킴(전용 상태·retryStep 없음 — issues.md).

### 1-4. 표시 합성 (`src/lib/utils/tokenize.ts` 확장 + `RubyText.tsx` 신규 + `SegmentText.tsx`)

```ts
// tokenize.ts — 단어 토큰과 루비 토큰의 문자 오프셋 병합
export interface RubyPiece {
  text: string;
  rt?: string; // 루비 토큰이 경계에서 잘리면 rt 폐기(보수적)
}
export interface ComposedWord {
  pieces: RubyPiece[];
  isWord: boolean;
  word: string; // 사전 클릭용 단어 원문
}
/** ruby가 없거나 join!==text면 단어 토큰만으로 폴백(모든 조각 rt 없음). */
export function composeRuby(
  words: WordToken[],
  ruby: RubyToken[] | undefined,
  text: string,
): ComposedWord[];
```

```tsx
// RubyText.tsx — 검증된 조각 시퀀스를 <ruby><rt> 렌더
export function RubyText({
  pieces,
}: {
  pieces: RubyPiece[];
}): React.ReactElement;
```

- `SegmentText`: `showRuby?: boolean`(기본 true) 추가. ja 경로에서 `composeRuby`로 단어 스팬 내부에
  RubyText 렌더 — **단어당 data-word 스팬 1개 유지**(하이라이트·클릭 기존 계약 보존). `showRuby === false`면 ruby 무시.
- `ScriptView`/`FocusPanel`: `showRuby?` 전달. `ShadowingPlayer`: 컨트롤 헤더에 후리가나 토글
  (ja에서만 노출, 기본 ON, 번역 토글 #114와 동일 패턴).

## 2. 테스트 시나리오

### annotateFurigana / createOpenRouterFuriganaAnnotator

- [x] [정상] annotateFurigana — should inject validated ruby sequences for kanji segments
- [x] [정상] annotateFurigana — should skip segments that already have ruby or contain no kanji
- [x] [경계] annotateFurigana — should drop ruby for a segment when token join mismatches text
- [x] [경계] annotateFurigana — should isolate a failing batch and continue with later batches
- [x] [예외] annotateFurigana — should throw when segments.json is missing
- [x] [정상] createOpenRouterFuriganaAnnotator — should parse a valid JSON ruby matrix
- [x] [경계] createOpenRouterFuriganaAnnotator — should return empty array on length mismatch or unparseable response
- [x] [예외] createOpenRouterFuriganaAnnotator — should throw when API key missing or HTTP error

### composeRuby (tokenize)

- [x] [정상] composeRuby — should align ruby tokens inside word boundaries keeping rt
- [x] [경계] composeRuby — should drop rt when a ruby token straddles a word boundary
- [x] [경계] composeRuby — should fall back to word-only pieces when ruby join mismatches text

### SegmentText / RubyText / 토글

- [x] [정상] SegmentText — should render rt over kanji pieces and none over kana when ruby present (AC1)
- [x] [정상] SegmentText — should ignore ruby when showRuby is false (AC2)
- [x] [정상] SegmentText — should keep word highlight and dictionary click working with ruby present (공존)
- [x] [경계] SegmentText — should fall back to plain text without crashing when ruby join mismatches (AC3)
- [x] [정상] ShadowingPlayer — should show 후리가나 toggle only for ja episodes with default ON
- [x] [정상] ShadowingPlayer — should hide all rt when toggle turned OFF and restore when ON (AC2)

### runImportPipeline (furigana)

- [x] [정상] runImportPipeline — should call annotateFurigana after translate in subtitle-only ja mode
- [x] [정상] runImportPipeline — should still complete when annotateFurigana throws (AC4)
- [x] [정상] runImportPipeline — should not run annotateFurigana in transcript mode or for en subtitle-only

## 3. AC 교차 대조

| AC                                              | 커버 시나리오                                               |
| :---------------------------------------------- | :---------------------------------------------------------- |
| AC1: 한자 토큰 위 요미가나, 가나·비한자 rt 없음 | SegmentText rt 렌더 + composeRuby 정렬 + annotate 검증 주입 |
| AC2: 토글 OFF → 원문만, ON 복원                 | showRuby=false + 플레이어 토글 시나리오                     |
| AC3: 검증 실패 세그먼트 → 크래시 없이 원문 폴백 | composeRuby 폴백 + SegmentText 불일치 폴백                  |
| AC4: ruby 전면 누락에도 completed·원문 표시     | pipeline best-effort + annotate 배치 격리                   |
