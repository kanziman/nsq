# Issue #12 — alignment 기본 정합 → segments.json + matchRate

> 근거: spec-fixed §7(C1~C5), PRD §모듈구조(시나리오 C). 의존성: #10(subtitle.en.vtt), #11(transcript.txt).
> 본 이슈는 **정상 정합 경로(happy path)**. 희소 앵커·외삽 등 경계 강건화는 #13.

## 1. 모듈 & 시그니처 (확정)

### 순수 코어

```ts
// import/vtt/parse.ts — VTT 텍스트 → 단어 토큰. 큐 구간을 단어 수로 균등 분배.
import { VttToken } from '@/lib/types';
export function parseVtt(vtt: string): VttToken[];

// import/align/anchor.ts — 정규화 + 희소 공통 단어(양쪽 1회씩) 앵커 후보.
export function normalizeWord(word: string): string; // 소문자 + 구두점 제거
export interface AnchorCandidate {
  word: string;
  vttIndex: number; // vtt 토큰 인덱스
  transcriptIndex: number; // 대본 단어 인덱스
}
// 입력은 정규화된 단어 배열(빈 문자열은 후보에서 제외). transcriptIndex 오름차순 반환.
export function findAnchorCandidates(
  vttWords: string[],
  transcriptWords: string[],
): AnchorCandidate[];

// import/align/lis.ts — 최장 증가 부분수열(strict). 인덱스 배열 반환.
export function longestIncreasingSubsequence(values: number[]): number[];

// import/align/interpolate.ts — 확정 앵커 + 토큰 타임 → 문장 경계 시간 → Segment[], matchRate.
import { Segment, Sentence } from '@/lib/types';
export interface AnchorPoint {
  transcriptIndex: number;
  time: number; // 초(vtt 토큰 시작 시간)
}
// 앵커 사이 선형 보간, 바깥은 최근접 앵커로 클램프(외삽 강건화는 #13).
export function interpolateTime(anchors: AnchorPoint[], index: number): number;
export interface AlignInput {
  sentences: Sentence[];
  wordToSentence: number[]; // 대본 단어별 소속 문장 인덱스
  anchorPoints: AnchorPoint[]; // 확정·단조 증가
  candidateCount: number;
  anchoredCount: number;
}
export function buildAlignment(input: AlignInput): {
  segments: Segment[];
  matchRate: number;
};
```

### 어댑터

```ts
// import/alignment.ts — 파일 로드 → 코어 조립 → segments.json 기록 + {matchRate} 반환.
export async function alignTranscript(
  videoId: string,
): Promise<{ matchRate: number }>;
```

## 2. 알고리즘 (C4) · 핵심 결정

- **정규화**: 소문자 + 구두점 제거(`normalizeWord`). 빈 문자열은 앵커 비대상(인덱스는 보존).
- **앵커 후보**: 정규화 후 **양쪽에서 정확히 1회** 등장하는 단어. `{word, vttIndex, transcriptIndex}`.
- **확정**: 후보를 transcriptIndex 오름차순 정렬 → `vttIndex` 배열에 **LIS** 적용 → 단조 증가 앵커만 확정.
- **matchRate (C1)**: `anchored / candidate` = 확정 앵커 수 / 후보 수. 후보 0이면 0. 범위 [0,1].
- **보간**: `AnchorPoint`(transcriptIndex→time) 사이 선형 보간으로 임의 대본 단어 위치의 시간 산출. 문장 start = 첫 단어 시간, end = 다음 경계 시간. start<end·문장 간 단조 증가를 최소 간격으로 보장.
- **세그먼트(C2)**: `{id, start, end, speaker, text}` 문장 단위. `words[]` 생략.
- **저품질도 기록(C3)**: matchRate 낮아도 segments.json 기록·{matchRate} 반환. 임계값 판단은 오케스트레이터(본 이슈 아님).
- **실패(C5)**: subtitle.en.vtt 또는 transcript.txt 누락 → throw.

## 3. 테스트 시나리오 (18/18 통과)

### [정상]

- [x] `[정상] parseVtt — should produce word tokens with monotonic times distributed across each cue`
- [x] `[정상] findAnchorCandidates — should return only words occurring exactly once on both sides`
- [x] `[정상] longestIncreasingSubsequence — should return indices of the longest strictly increasing subsequence`
- [x] `[정상] interpolateTime — should linearly interpolate time between two anchors`
- [x] `[정상] buildAlignment — should produce Segment[] with id/start/end/speaker/text and matchRate in [0,1]`
- [x] `[정상] alignTranscript — should write segments.json (Segment[]) and return matchRate≥0.85 for a well-matched fixture`

### [경계]

- [x] `[경계] normalizeWord — should lowercase and strip punctuation`
- [x] `[경계] findAnchorCandidates — should exclude words appearing multiple times on either side`
- [x] `[경계] findAnchorCandidates — should ignore empty (punctuation-only) normalized words`
- [x] `[경계] longestIncreasingSubsequence — strict(동률 비증가)/empty`
- [x] `[경계] interpolateTime — should clamp to nearest anchor time outside the anchor range`
- [x] `[경계] buildAlignment — should enforce start<end and monotonically increasing segment times`
- [x] `[경계] buildAlignment — should return matchRate 0 when there are no candidates`
- [x] `[경계] alignTranscript — segments should have start<end and monotonically increasing times`

### [예외]

- [x] `[예외] alignTranscript — should throw when subtitle.en.vtt is missing`
- [x] `[예외] alignTranscript — should throw when transcript.txt is missing`

## 4. AC ↔ 시나리오 교차 대조

| #   | Acceptance Criteria                                          | 커버 시나리오                                                     |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | segments.json=Segment[]·각 필드·start<end·시간 단조 증가     | buildAlignment Segment 필드 + alignTranscript well-matched + 단조 |
| 2   | matchRate∈[0,1]·anchored/candidate 정의 일치(≥0.85)          | buildAlignment matchRate 범위 + alignTranscript ≥0.85             |
| 3   | 앵커 사이 비매칭 → 인접 앵커 시간으로 선형 보간              | interpolateTime 선형 보간                                         |
| 4   | 순수 함수 단위(lis/anchor/interpolate/vtt parse) 결정적 검증 | 각 순수 함수 단위 시나리오                                        |
| +   | 입력 누락 → throw (C5)                                       | alignTranscript missing vtt / missing transcript                  |
