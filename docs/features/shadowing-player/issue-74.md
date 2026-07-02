# Issue #74 — 완료 시 meta.json 저장 (실제 제목·재생시간·썸네일)

> 의존: 임포트 파이프라인 · 흡수: `import-episode-meta`
> AC1 실제 제목 표시 / AC2 duration>0 → 탐색 바 정상 / AC3 메타 수집 실패 시 폴백(회귀 없음)

---

## 1. 시그니처 명세

### ① `src/lib/services/import/youtube.ts` (확장)

```ts
export interface RunnerResult {
  code: number;
  stderr: string;
  stdout?: string; // yt-dlp --dump-single-json 출력 캡처용(추가)
}

// yt-dlp --dump-single-json 으로 {title, duration, thumbnail} 취득 → meta.json 기록.
export function writeEpisodeMeta(
  videoId: string,
  youtubeUrl: string,
  runner?: Runner,
): Promise<void>;
// 실패(code!=0 또는 stdout 없음/파싱 실패) 시 throw — 호출측(파이프라인)이 best-effort로 흡수.
```

### ② `src/lib/services/import-pipeline.ts` (수정)

```ts
export interface PipelineSteps {
  // ...기존
  fetchMeta?(videoId: string, youtubeUrl: string): Promise<void>; // optional(하위호환)
}
// alignment 성공 후 completed 기록 직전에 best-effort 호출:
//   try { await steps.fetchMeta?.(videoId, youtubeUrl); } catch { /* AC3 폴백 */ }
```

### ③ `src/lib/services/episodes.ts`

- 기존대로 meta.json 존재 시 그대로 Episode로 사용(별도 변경 불필요). meta 부재 폴백은 #73에서 status 반영 완료.

---

## 2. 테스트 시나리오

### `writeEpisodeMeta`

- [정상] should write meta.json with title/duration/thumbnail from yt-dlp JSON (AC1/AC2)
- [경계] should fall back title/duration when JSON fields are missing
- [예외] should throw when yt-dlp exits non-zero (so pipeline can absorb) (AC3)

### `runImportPipeline`

- [정상] should call fetchMeta after a successful alignment
- [정상] should still complete when fetchMeta throws (best-effort, AC3)

### `getEpisodeById`

- [정상] should use real title/duration from meta.json when present (AC1/AC2)

---

## 3. AC ↔ 시나리오

| AC                        | 커버                                                         |
| :------------------------ | :----------------------------------------------------------- |
| **AC1** 실제 제목         | writeEpisodeMeta(title), getEpisodeById(meta title)          |
| **AC2** duration>0 탐색바 | writeEpisodeMeta(duration), getEpisodeById(meta duration)    |
| **AC3** 수집 실패 폴백    | writeEpisodeMeta throw, pipeline best-effort still completes |
