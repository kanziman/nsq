import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Episode, EpisodeMeta, ImportState } from '@/lib/types';

// 로컬 임포트 완료 에피소드를 배포 형태로 퍼블리시한다(#164, S4).
// 오디오는 R2에 업로드하고, 조회 데이터는 public/episodes/<id>/로 복사하며
// index.json 매니페스트를 갱신한다. R2 업로드가 side-effect라 주입식 인터페이스로 분리한다.

// 조회 소스(READ_BASE)·임포트 작업본(WRITE_BASE) 기본 경로.
const DEFAULT_WRITE_BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const DEFAULT_PUBLIC_BASE = path.join(process.cwd(), 'public', 'episodes');
const AUDIO_FILE = 'audio.mp3';
const MANIFEST_FILE = 'index.json';

/**
 * R2(오브젝트 스토리지)에 오디오를 올리는 주입식 인터페이스.
 * 실제 구현은 createR2Uploader가 제공하고, 테스트는 목을 주입한다.
 */
export interface AudioUploader {
  // '<videoId>/audio.mp3' 키로 업로드한다.
  uploadAudio(videoId: string, body: Buffer): Promise<void>;
}

export interface PublishEpisodeOptions {
  uploader: AudioUploader;
  writeBase?: string; // 기본 .shadowing/episodes (읽기 소스)
  publicBase?: string; // 기본 public/episodes (쓰기 대상)
}

export interface PublishResult {
  videoId: string;
  audioKey: string; // 'vid123/audio.mp3'
  copiedFiles: string[]; // public로 복사된 파일명
  manifestCount: number; // 갱신 후 index.json 항목 수
}

// -------------------------------- 순수 로직 --------------------------------

/**
 * 매니페스트에 항목을 upsert(id 기준 교체 또는 추가)하고 addedAt 내림차순 정렬해 반환한다.
 * 정렬 규칙은 조회 getEpisodes()와 일치시켜 목록 순서를 보존한다.
 */
export function upsertEpisodeManifest(
  manifest: Episode[],
  entry: Episode,
): Episode[] {
  const others = manifest.filter((e) => e.id !== entry.id);
  return [...others, entry].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  );
}

/**
 * 퍼블리시 복사 대상에서 오디오(mp3)를 제외한 파일명만 남긴다.
 * 오디오는 R2 전용이며 git(public)에 복사하지 않는다(대용량 커밋 방지).
 */
export function selectCopyFiles(fileNames: string[]): string[] {
  return fileNames.filter((name) => !name.toLowerCase().endsWith('.mp3'));
}

/**
 * import-state가 완료 상태인지 검증한다. 부재/미완료면 Error를 던진다.
 */
export function assertPublishable(
  videoId: string,
  state: ImportState | null,
): void {
  if (!state) {
    throw new Error(
      `[publish] ${videoId}: import-state.json이 없습니다. 임포트 완료 후 실행하세요.`,
    );
  }
  if (state.status !== 'completed') {
    throw new Error(
      `[publish] ${videoId}: 완료되지 않은 에피소드입니다(status=${state.status}).`,
    );
  }
}

// ---------------------------- 오케스트레이터 ----------------------------

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

/**
 * videoId 에피소드를 퍼블리시한다.
 * 순서 보장(데이터 일관성): 검증 → R2 업로드(먼저·성공 후) → public 복사(mp3 제외)
 *   → index.json upsert. 업로드 실패 시 복사·매니페스트를 수행하지 않는다.
 */
export async function publishEpisode(
  videoId: string,
  options: PublishEpisodeOptions,
): Promise<PublishResult> {
  const writeBase = options.writeBase ?? DEFAULT_WRITE_BASE;
  const publicBase = options.publicBase ?? DEFAULT_PUBLIC_BASE;
  const srcDir = path.join(writeBase, videoId);

  // 1. 검증 — 부재/미완료면 side-effect 없이 종료.
  const state = await readJson<ImportState>(
    path.join(srcDir, 'import-state.json'),
  );
  assertPublishable(videoId, state);

  // 2. R2 업로드 먼저 — 성공해야 다음 단계로 진행(반쪽 배포 방지).
  const audioBuffer = await fs.readFile(path.join(srcDir, AUDIO_FILE));
  await options.uploader.uploadAudio(videoId, audioBuffer);
  const audioKey = `${videoId}/${AUDIO_FILE}`;

  // 3. public/episodes/<id>/로 mp3 제외 파일 복사.
  const destDir = path.join(publicBase, videoId);
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir);
  const copiedFiles = selectCopyFiles(entries);
  for (const name of copiedFiles) {
    await fs.copyFile(path.join(srcDir, name), path.join(destDir, name));
  }

  // 4. index.json 매니페스트 upsert.
  const meta = await readJson<EpisodeMeta>(path.join(srcDir, 'meta.json'));
  const entry: Episode = {
    ...(meta as EpisodeMeta),
    importState: state ?? undefined,
  };
  const manifestPath = path.join(publicBase, MANIFEST_FILE);
  const existing = (await readJson<Episode[]>(manifestPath)) ?? [];
  const manifest = upsertEpisodeManifest(existing, entry);
  await fs.mkdir(publicBase, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return {
    videoId,
    audioKey,
    copiedFiles,
    manifestCount: manifest.length,
  };
}

// ------------------------- 실제 R2 업로더 (env 기반) -------------------------

/**
 * env(R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME)로
 * S3 호환 R2 업로더를 구성한다. @aws-sdk/client-s3는 지연 로드해 단위 테스트가
 * 의존성 없이 순수 로직만 검증할 수 있게 한다.
 */
export function createR2Uploader(): AudioUploader {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      '[publish] R2 자격증명이 없습니다. .env.local에 R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME을 설정하세요.',
    );
  }

  return {
    async uploadAudio(videoId: string, body: Buffer): Promise<void> {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `${videoId}/${AUDIO_FILE}`,
          Body: body,
          ContentType: 'audio/mpeg',
        }),
      );
    },
  };
}

// CLI: npx tsx scripts/publish-episode.ts <videoId>
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void (async () => {
    const videoId = process.argv[2];
    if (!videoId) {
      console.error('Usage: npx tsx scripts/publish-episode.ts <videoId>');
      process.exit(1);
    }
    try {
      // createR2Uploader()도 try 안에서 호출해 자격증명 부재 에러를 깔끔히 보고한다.
      const r = await publishEpisode(videoId, {
        uploader: createR2Uploader(),
      });
      console.log(
        `Published ${r.videoId}: audio→${r.audioKey}, copied ${r.copiedFiles.length} files, manifest ${r.manifestCount} episodes.`,
      );
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  })();
}
