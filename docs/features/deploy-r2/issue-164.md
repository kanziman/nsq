# Issue #164: [deploy S4] 로컬 퍼블리시 스크립트 — R2 업로드 + public 복사 + index.json 매니페스트

부모: #157 (배포 전략 전환 — R2 하이브리드)의 수직 슬라이스 S4 (마지막).

로컬 임포트 완료 에피소드를 배포 형태로 퍼블리시한다: 오디오는 R2에 업로드,
조회 데이터는 `public/episodes/[id]/`로 복사, `index.json` 매니페스트 갱신.

## 사전 확인 (이미 충족)

- `.env.example`: R2 변수(`R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`/`NEXT_PUBLIC_R2_BASE_URL`) 이미 존재(S1 #158).
- `.gitignore`: `.shadowing/`·`.env.local` 이미 무시. → S4에서 `public/episodes/**/*.mp3` 방어 라인만 추가(AC3 안전망, mp3 실수 커밋 차단).
- `@aws-sdk/client-s3`: **미설치** → devDependency로 설치 필요(green 단계).

## 1. 구현 대상 (시그니처 및 변경) — `scripts/publish-episode.ts` (신규)

기존 `scripts/seed-episode.ts` 패턴(순수 함수 + 주입식 baseDir + CLI 가드) 준수.

```ts
// R2(오브젝트 스토리지)에 오디오를 올리는 주입식 인터페이스 — 테스트에서 목 주입.
export interface AudioUploader {
  // '<videoId>/audio.mp3' 키로 업로드한다.
  uploadAudio(videoId: string, body: Buffer): Promise<void>;
}

export interface PublishEpisodeOptions {
  uploader: AudioUploader;
  writeBase?: string; // 기본 .shadowing/episodes (로컬 작업본, 읽기 소스)
  publicBase?: string; // 기본 public/episodes (조회 정적 소스, 쓰기 대상)
}

export interface PublishResult {
  videoId: string;
  audioKey: string; // 'vid123/audio.mp3'
  copiedFiles: string[]; // public로 복사된 파일명
  manifestCount: number; // 갱신 후 index.json 항목 수
}

// --- 순수 로직 (단위 테스트 집중 대상, AC5) ---

// id로 upsert 후 addedAt 내림차순 정렬(조회 getEpisodes 정렬과 일치).
export function upsertEpisodeManifest(
  manifest: Episode[],
  entry: Episode,
): Episode[];

// 복사 대상에서 오디오(mp3)를 제외한 파일명만 남긴다.
export function selectCopyFiles(fileNames: string[]): string[];

// import-state가 완료 상태인지 검증. null/미완료면 Error를 던진다.
export function assertPublishable(
  videoId: string,
  state: ImportState | null,
): void;

// --- 오케스트레이터 (side-effect, 주입식) ---

// 검증 → R2 업로드(먼저) → public 복사(mp3 제외) → index.json upsert.
export async function publishEpisode(
  videoId: string,
  options: PublishEpisodeOptions,
): Promise<PublishResult>;

// --- 실제 R2 업로더 팩토리 (env 기반, 단위 테스트 제외) ---
// @aws-sdk/client-s3를 지연 로드해 env로 S3Client 구성 후 PutObjectCommand로 업로드.
export function createR2Uploader(): AudioUploader;
```

### 오케스트레이션 순서 (데이터 일관성 — AC1)

1. `writeBase/<id>`에서 `import-state.json` 읽기 → `assertPublishable` (실패 시 즉시 종료, side-effect 없음).
2. `audio.mp3` 버퍼 읽기 → `uploader.uploadAudio(id, buf)` **await 성공 후** 다음 단계.
3. `selectCopyFiles`로 mp3 제외 파일을 `publicBase/<id>/`로 복사.
4. `publicBase/index.json` 읽기(부재 시 `[]`) → `{ ...meta, importState }` 항목을 `upsertEpisodeManifest` → 기록.
5. `PublishResult` 반환.

### CLI

`npx tsx scripts/publish-episode.ts <videoId>` — `createR2Uploader()`로 실제 업로더 구성 후 `publishEpisode` 실행. 인자 없으면 usage 출력 후 비정상 종료.

### 에러 케이스

- `videoId` 미제공(CLI) → usage 안내 + exit(1).
- `import-state.json` 부재 또는 `status !== 'completed'` → `assertPublishable`에서 throw, 업로드/복사/매니페스트 미수행.
- `uploader.uploadAudio` 실패 → 예외 전파, 복사·매니페스트 미수행(순서 보장으로 반쪽 배포 방지).

## 2. 테스트 시나리오 (전 항목 Green — 16/16 통과)

### `upsertEpisodeManifest` (순수)

- [정상] upsertEpisodeManifest — should append entry when id is not present
- [정상] upsertEpisodeManifest — should replace existing entry (no duplicate) when id already present
- [정상] upsertEpisodeManifest — should return list sorted by addedAt descending
- [경계] upsertEpisodeManifest — should return single-element array when manifest is empty

### `selectCopyFiles` (순수)

- [정상] selectCopyFiles — should keep meta/segments/subtitle.vtt/import-state files
- [정상] selectCopyFiles — should exclude audio.mp3
- [경계] selectCopyFiles — should return empty array when only mp3 files are present

### `assertPublishable` (순수)

- [정상] assertPublishable — should not throw when status is completed
- [예외] assertPublishable — should throw when state is null
- [예외] assertPublishable — should throw when status is not completed

### `publishEpisode` (오케스트레이터, 목 업로더 + tmp 디렉토리)

- [정상] publishEpisode — should upload audio to `<id>/audio.mp3` via injected uploader when completed
- [정상] publishEpisode — should copy non-mp3 files into `publicBase/<id>`
- [정상] publishEpisode — should NOT copy audio.mp3 into publicBase
- [정상] publishEpisode — should upsert the episode entry into publicBase/index.json
- [예외] publishEpisode — should throw and perform no upload/copy when import-state is missing or not completed
- [예외] publishEpisode — should throw and perform no upload when the episode directory does not exist at all (AC4 "없거나")
- [예외] publishEpisode — should propagate uploader error and NOT write manifest when upload fails

## 3. AC 교차 대조

- **AC1** (R2 `<id>/audio.mp3` 업로드, 업로드 성공 후 매니페스트) → publishEpisode 업로드 + upload-fail-no-manifest
- **AC2** (public 복사 + index.json upsert) → publishEpisode 복사·upsert + upsertEpisodeManifest 4건
- **AC3** (mp3 public 미복사) → publishEpisode no-copy-mp3 + selectCopyFiles exclude + `.gitignore` 방어 라인
- **AC4** (부재/미완료 id → 업로드·복사 없이 에러 종료) → assertPublishable 3건 + publishEpisode throw-no-side-effect
- **AC5** (순수 로직 단위 테스트 + R2 목 주입) → 순수 3함수 전 시나리오 + publishEpisode의 주입식 업로더
