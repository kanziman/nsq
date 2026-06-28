# Issue #9 — youtube: downloadAudio → audio.mp3 (+ runner 추상화)

> 근거: `docs/features/import-engine/{prd.md,spec-fixed.md,issues.md}` · ADR-002(시나리오 C) 순수 코어 + 얇은 어댑터.
> 대상 파일: `src/lib/services/import/youtube.ts`

## 1. 시그니처 (확정)

```ts
// 외부 프로세스(yt-dlp) 실행 추상. 기본 child_process.spawn 래퍼, 테스트는 fake 주입.
export interface RunnerResult {
  code: number; // 프로세스 종료 코드 (0 = 정상)
  stderr: string; // 캡처된 표준 에러 (실패 진단용)
}
export type Runner = (command: string, args: string[]) => Promise<RunnerResult>;

// download: youtubeUrl → .shadowing/episodes/{videoId}/audio.mp3
// runner 미주입 시 기본 spawn 래퍼 사용. PipelineSteps 계약(2-arity)과 호환.
export async function downloadAudio(
  videoId: string,
  youtubeUrl: string,
  runner?: Runner,
): Promise<void>;
```

### 환경 변수 (env)

| 변수                | 기본값   | 용도                                         |
| ------------------- | -------- | -------------------------------------------- |
| `YT_DLP_PATH`       | `yt-dlp` | 실행할 yt-dlp 바이너리 경로(오버라이드 가능) |
| `YT_DLP_TIMEOUT_MS` | `300000` | 프로세스당 타임아웃(기본 runner에 적용, A6)  |

→ `.env.example`에 두 변수 추가.

### yt-dlp 호출 규약

- args: `--extract-audio --audio-format mp3 --audio-quality 0 --force-overwrites -o <outputPath> <youtubeUrl>`
- `outputPath` = `.shadowing/episodes/{videoId}/audio.mp3`
- 항상 덮어쓰기(멱등 재생성). 사전 디렉토리 보장(ensureDir) 후 실행.

### 에러 조건 (throw)

- `runner` 결과 `code !== 0` → `stderr` 말미를 포함한 `Error` throw. (A7-a)
- `code === 0`이나 `audio.mp3` 미생성 → `Error` throw. (A7-b)
- (A6 타임아웃 — 기본 runner 책임. AC 범위 외, 본 이슈는 env 해석·전달까지.)

## 2. 테스트 시나리오 (8/8 통과)

### [정상]

- [x] `[정상] downloadAudio — should call runner once with mp3 args and audio.mp3 output path when given valid url and successful runner`
- [x] `[정상] downloadAudio — should resolve without throwing when runner exits 0 and audio.mp3 is produced`
- [x] `[정상] downloadAudio — should pass --audio-quality 0 flag to runner`

### [경계]

- [x] `[경계] downloadAudio — should re-run and overwrite (no skip) when audio.mp3 already exists`
- [x] `[경계] downloadAudio — should use YT_DLP_PATH binary as command when YT_DLP_PATH env is set`
- [x] `[경계] downloadAudio — should default command to 'yt-dlp' when YT_DLP_PATH is unset`

### [예외]

- [x] `[예외] downloadAudio — should throw Error including stderr tail when runner exits with non-zero code`
- [x] `[예외] downloadAudio — should include only the stderr tail (drop the head) when stderr exceeds 500 chars` (AC3 경계, ac-verifier 보강)
- [x] `[예외] downloadAudio — should throw Error when runner exits 0 but audio.mp3 was not produced`

## 3. AC ↔ 시나리오 교차 대조

| #   | Acceptance Criteria                                          | 커버 시나리오                                                    |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | 유효 URL·성공 runner → mp3 인자·audio.mp3 경로 1회 호출·정상 | [정상] call runner once with mp3 args / resolve without throwing |
| 2   | audio.mp3 기존 존재 → 다시 실행해 덮어씀(스킵 금지)          | [경계] re-run and overwrite when audio.mp3 already exists        |
| 3   | runner exit≠0 → stderr 말미 포함 Error throw                 | [예외] throw including stderr tail on non-zero exit              |
| 4   | 정상 종료했으나 audio.mp3 미생성 → throw                     | [예외] throw when exit 0 but audio.mp3 not produced              |
| 5   | YT_DLP_PATH 설정 → 해당 경로 바이너리로 실행                 | [경계] use YT_DLP_PATH binary as command                         |

→ 모든 AC가 1개 이상 시나리오로 커버됨.
