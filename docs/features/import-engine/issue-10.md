# Issue #10 — youtube: fetchSubtitle → subtitle.en.vtt (수동→자동 폴백)

> 근거: `docs/features/import-engine/issues.md` (Issue 2) · 의존성: #9(runner 추상화, 머지 완료).
> 대상 파일: `src/lib/services/import/youtube.ts`

## 1. 시그니처 (확정)

```ts
// #9에서 확립한 Runner/RunnerResult/defaultRunner 재사용.
// subtitle: youtubeUrl → .shadowing/episodes/{videoId}/subtitle.en.vtt
// runner 미주입 시 기본 spawn 래퍼. PipelineSteps 계약(2-arity)과 호환.
export async function fetchSubtitle(
  videoId: string,
  youtubeUrl: string,
  runner?: Runner,
): Promise<void>;
```

### yt-dlp 호출 규약

- 공통 인자: `--sub-langs en --sub-format vtt --convert-subs vtt --skip-download --force-overwrites -o <dir>/subtitle.%(ext)s <youtubeUrl>`
- **수동 단계**: 위 + `--write-subs` (수동 업로더 자막)
- **자동 폴백**: 위 + `--write-auto-subs` (음성인식 자막) — 수동 산출물 없을 때만 실행
- 산출물 경로: `.shadowing/episodes/{videoId}/subtitle.en.vtt`

### 동작 순서

1. 디렉토리 보장(mkdir recursive).
2. 기존 `subtitle.en.vtt` 제거(force) — 멱등 재생성 + 수동/자동 산출 판별 정확성 확보.
3. **수동 단계** 실행 → `subtitle.en.vtt` 생성되면 성공(자동 폴백 미호출).
4. 미생성 시 **자동 폴백** 실행 → 생성되면 성공.
5. 수동·자동 모두 미생성 → `stderr` 말미 포함 `Error` throw.

> 폴백 판단은 **종료 코드가 아니라 산출 파일 존재 여부**로 한다(자막 부재 시 yt-dlp가 비-0으로 끝날 수 있으므로). 최종 미산출일 때만 throw.

## 2. 테스트 시나리오 (6/6 통과)

### [정상]

- [x] `[정상] fetchSubtitle — should produce subtitle.en.vtt from manual step and not call auto fallback when manual subs exist`
- [x] `[정상] fetchSubtitle — should pass --write-subs and --sub-langs en/--sub-format vtt on the manual step`

### [경계]

- [x] `[경계] fetchSubtitle — should run auto fallback (--write-auto-subs) and produce subtitle.en.vtt when manual subs are absent`
- [x] `[경계] fetchSubtitle — should re-fetch and overwrite when subtitle.en.vtt already exists`

### [예외]

- [x] `[예외] fetchSubtitle — should throw Error and leave no subtitle.en.vtt when neither manual nor auto subs exist`
- [x] `[예외] fetchSubtitle — should include stderr tail in the error when both steps fail`

## 3. AC ↔ 시나리오 교차 대조

| #   | Acceptance Criteria                                  | 커버 시나리오                                          |
| --- | ---------------------------------------------------- | ------------------------------------------------------ |
| 1   | 수동 en 보유 → subtitle.en.vtt 산출·자동 폴백 미호출 | [정상] manual produces, auto not called                |
| 2   | 수동 없음·자동 있음 → 폴백 실행·subtitle.en.vtt 산출 | [경계] auto fallback produces when manual absent       |
| 3   | 수동·자동 모두 없음 → Error throw·파일 없음          | [예외] throw and leave no file when neither exists     |
| 4   | 기존 subtitle.en.vtt → 재호출 시 새로 받아 덮어씀    | [경계] re-fetch and overwrite when file already exists |

→ 모든 AC가 1개 이상 시나리오로 커버됨.
