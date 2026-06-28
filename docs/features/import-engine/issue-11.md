# Issue #11 — transcript: fetchTranscript → transcript.txt (JSONL)

> 근거: `docs/features/import-engine/issues.md` (Issue 3) · PRD §모듈구조(시나리오 C) 순수함수 + 얇은 어댑터.
> 대상: `src/lib/services/import/transcript/parse.ts`(순수), `src/lib/services/import/transcript.ts`(어댑터).
> 신규 의존성: `node-html-parser` (순수 parse에서만 사용).

## 1. 시그니처 (확정)

```ts
// import/transcript/parse.ts — 순수 함수: 대본 HTML → Sentence[]
// 비발화 제거 · 화자 정규화 · 문장 분할 포함.
import { Sentence } from '@/lib/types';
export function parseTranscriptHtml(html: string): Sentence[];

// import/transcript.ts — 어댑터: 주입형 fetcher로 HTML 취득 → parse → JSONL 기록.
// Fetcher = 전역 fetch 시그니처. 테스트는 fake fetch로 고정 HTML/상태 반환.
export type Fetcher = typeof fetch;
export async function fetchTranscript(
  videoId: string,
  transcriptUrl: string,
  fetcher?: Fetcher,
): Promise<void>;
```

`Sentence`(types.ts): `{ text: string; speaker: 'DUCKWORTH' | 'DUBNER' | 'BOTH' | 'NARRATOR' }`

## 2. HTML 계약 / 파싱 규칙 (fixture로 인코딩)

대본은 `<p>` 단위 발화. 화자 라벨은 문단 선두 `<strong>`/`<b>`의 `이름:` 형식.

- **화자 정규화** (라벨 텍스트, 대소문자 무시):
  - `angela` 또는 `duckworth` 포함 → `DUCKWORTH`
  - `stephen`/`steven` 또는 `dubner` 포함 → `DUBNER`
  - 두 인물 모두 포함(공동 발화) → `BOTH`
  - 그 외(게스트·아나운서 등) 또는 라벨 없음 → `NARRATOR`
- **비발화 제거**:
  - 인라인 큐 `[...]`(예: `[LAUGHTER]`), `(...)`(예: `(MUSIC)`) 제거.
  - 큐 제거 후 텍스트가 비면 해당 문장/문단 드롭.
  - `class`에 `ad`/`sponsor`/`footnote`/`meta` 포함된 `<p>`는 통째로 스킵.
- **문장 분할**: 발화 텍스트를 문장 경계(`.?!` + 공백)로 분할, 각 문장에 동일 화자 전파.

## 3. 어댑터 동작 (fetchTranscript)

1. `fetcher(transcriptUrl)` 호출 → 응답.
2. `res.ok === false`(비-2xx) → `Error` throw.
3. `html = await res.text()` → `parseTranscriptHtml(html)`.
4. 결과 0문장 → `Error` throw.
5. 디렉토리 보장 후 `transcript.txt`에 JSONL 기록(한 줄 = `JSON.stringify(Sentence)`). 항상 덮어쓰기.
   - 경로: `.shadowing/episodes/{videoId}/transcript.txt`

## 4. 테스트 시나리오 (10/10 통과)

### [정상]

- [x] `[정상] parseTranscriptHtml — should normalize Angela/Stephen labels to DUCKWORTH/DUBNER`
- [x] `[정상] fetchTranscript — should write transcript.txt as JSONL with one valid Sentence per line on success`

### [경계]

- [x] `[경계] parseTranscriptHtml — should map unmapped (guest) speaker label to NARRATOR`
- [x] `[경계] parseTranscriptHtml — should map joint Angela+Stephen label to BOTH`
- [x] `[경계] parseTranscriptHtml — should strip [LAUGHTER]/(MUSIC) cues and drop cue-only paragraphs`
- [x] `[경계] parseTranscriptHtml — should skip ad/sponsor/footnote paragraphs`
- [x] `[경계] parseTranscriptHtml — should split a multi-sentence paragraph and propagate the same speaker`
- [x] `[경계] fetchTranscript — should overwrite an existing transcript.txt`

### [예외]

- [x] `[예외] fetchTranscript — should throw when fetcher responds with a non-2xx status`
- [x] `[예외] fetchTranscript — should throw when parsing yields zero sentences`

## 5. AC ↔ 시나리오 교차 대조

| #   | Acceptance Criteria                                                | 커버 시나리오                              |
| --- | ------------------------------------------------------------------ | ------------------------------------------ |
| 1   | Angela·Stephen → DUCKWORTH/DUBNER 정규화·JSONL 각 줄 유효 Sentence | parse normalize + fetchTranscript JSONL    |
| 2   | 매핑 외 화자 → NARRATOR                                            | parse unmapped → NARRATOR                  |
| 3   | `[LAUGHTER]`/`(MUSIC)`/광고·각주 → 결과에서 제외                   | strip cues + skip ad/footnote              |
| 4   | 다문장 문단 → 문장 분할·동일 화자 전파                             | split multi-sentence + propagate speaker   |
| 5   | fetcher 비-2xx(또는 0문장) → throw                                 | throw on non-2xx + throw on zero sentences |

> 추가: BOTH(공동 발화) 정규화는 AC에 명시되진 않으나 `Sentence` 타입·spec B3에 존재 → 경계 시나리오로 커버.

## 6. 알려진 한계 / 후속 (Known limitations)

- **약어 문장 오분할**: 문장 분할이 `(?<=[.?!])\s+` 기반이라 `Dr.`/`Mr.`/`U.S.`/`Ph.D.` 같은 약어 뒤에서 오분할될 수 있다. 본 이슈 AC(다문장 분할·화자 전파)에는 미포함이며, 실제 대본 데이터에서 빈번하면 약어 예외 사전 기반 보호를 **후속 이슈**로 다룬다. (ac-verifier #11 지적)
- **역할 클래스 스킵**: `ad`/`sponsor`/`footnote`/`meta` 역할 클래스는 정확 일치 또는 `role-`/`role_` 접두만 스킵하고, `metadata`처럼 구분자 없는 일반 클래스는 보존한다(테스트로 고정). 실제 Freakonomics HTML의 클래스 명명이 다르면 fixture·규칙을 함께 갱신한다.
