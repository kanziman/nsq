import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Episode, ImportState } from '@/lib/types';
import {
  upsertEpisodeManifest,
  selectCopyFiles,
  assertPublishable,
  publishEpisode,
  type AudioUploader,
} from './publish-episode';

// ------------------------------- 헬퍼 -------------------------------

const tmpDirs: string[] = [];
async function makeDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}
async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, 'utf-8')) as T;
}
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function episode(id: string, addedAt: string): Episode {
  return {
    id,
    title: `Episode ${id}`,
    duration: 300,
    youtubeUrl: `https://youtube.com/watch?v=${id}`,
    addedAt,
    importState: {
      videoId: id,
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      updatedAt: addedAt,
    },
  };
}

function state(status: ImportState['status']): ImportState {
  return {
    videoId: 'vid123',
    status,
    progress: status === 'completed' ? 100 : 40,
    currentStep: status,
    updatedAt: new Date().toISOString(),
  };
}

// completed 에피소드를 writeBase/<id>에 구성 (meta/segments/subtitle/import-state/audio)
async function seedSource(writeBase: string, id: string): Promise<void> {
  const dir = path.join(writeBase, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'meta.json'),
    JSON.stringify({
      id,
      title: `Episode ${id}`,
      duration: 300,
      youtubeUrl: `https://youtube.com/watch?v=${id}`,
      addedAt: '2026-07-01T00:00:00Z',
    }),
  );
  await fs.writeFile(path.join(dir, 'segments.json'), JSON.stringify([]));
  await fs.writeFile(path.join(dir, 'subtitle.en.vtt'), 'WEBVTT\n');
  await fs.writeFile(
    path.join(dir, 'import-state.json'),
    JSON.stringify(state('completed')),
  );
  await fs.writeFile(path.join(dir, 'audio.mp3'), Buffer.from('MP3DATA'));
}

function mockUploader(): AudioUploader & { calls: Array<[string, Buffer]> } {
  const calls: Array<[string, Buffer]> = [];
  return {
    calls,
    uploadAudio: vi.fn(async (videoId: string, body: Buffer) => {
      calls.push([videoId, body]);
    }),
  };
}

afterEach(async () => {
  while (tmpDirs.length) {
    await fs.rm(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

// --------------------------- upsertEpisodeManifest ---------------------------

describe('upsertEpisodeManifest', () => {
  it('should append entry when id is not present', () => {
    const a = episode('a', '2026-07-01T00:00:00Z');
    const b = episode('b', '2026-07-02T00:00:00Z');
    const result = upsertEpisodeManifest([a], b);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('should replace existing entry (no duplicate) when id already present', () => {
    const a1 = episode('a', '2026-07-01T00:00:00Z');
    const a2 = { ...episode('a', '2026-07-05T00:00:00Z'), title: 'Updated' };
    const result = upsertEpisodeManifest([a1], a2);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Updated');
  });

  it('should return list sorted by addedAt descending', () => {
    const a = episode('a', '2026-07-01T00:00:00Z');
    const c = episode('c', '2026-07-03T00:00:00Z');
    const b = episode('b', '2026-07-02T00:00:00Z');
    const result = upsertEpisodeManifest([a, c], b);
    expect(result.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('should return single-element array when manifest is empty', () => {
    const a = episode('a', '2026-07-01T00:00:00Z');
    expect(upsertEpisodeManifest([], a)).toEqual([a]);
  });
});

// ------------------------------ selectCopyFiles ------------------------------

describe('selectCopyFiles', () => {
  it('should keep meta/segments/subtitle.vtt/import-state files', () => {
    const files = [
      'meta.json',
      'segments.json',
      'subtitle.en.vtt',
      'import-state.json',
    ];
    expect(selectCopyFiles(files).sort()).toEqual(files.sort());
  });

  it('should exclude audio.mp3', () => {
    const result = selectCopyFiles(['meta.json', 'audio.mp3']);
    expect(result).not.toContain('audio.mp3');
    expect(result).toContain('meta.json');
  });

  it('should return empty array when only mp3 files are present', () => {
    expect(selectCopyFiles(['audio.mp3'])).toEqual([]);
  });
});

// ------------------------------ assertPublishable ----------------------------

describe('assertPublishable', () => {
  it('should not throw when status is completed', () => {
    expect(() => assertPublishable('vid123', state('completed'))).not.toThrow();
  });

  it('should throw when state is null', () => {
    expect(() => assertPublishable('vid123', null)).toThrow();
  });

  it('should throw when status is not completed', () => {
    expect(() => assertPublishable('vid123', state('downloading'))).toThrow();
  });
});

// -------------------------------- publishEpisode -----------------------------

describe('publishEpisode', () => {
  it("should upload audio to '<id>/audio.mp3' via injected uploader when completed", async () => {
    const writeBase = await makeDir('pub-write-');
    const publicBase = await makeDir('pub-public-');
    await seedSource(writeBase, 'vid123');
    const uploader = mockUploader();

    const result = await publishEpisode('vid123', {
      uploader,
      writeBase,
      publicBase,
    });

    expect(uploader.calls).toHaveLength(1);
    expect(uploader.calls[0][0]).toBe('vid123');
    expect(uploader.calls[0][1].toString()).toBe('MP3DATA');
    expect(result.audioKey).toBe('vid123/audio.mp3');
  });

  it('should copy non-mp3 files into publicBase/<id>', async () => {
    const writeBase = await makeDir('pub-write-');
    const publicBase = await makeDir('pub-public-');
    await seedSource(writeBase, 'vid123');

    await publishEpisode('vid123', {
      uploader: mockUploader(),
      writeBase,
      publicBase,
    });

    const dest = path.join(publicBase, 'vid123');
    expect(await exists(path.join(dest, 'meta.json'))).toBe(true);
    expect(await exists(path.join(dest, 'segments.json'))).toBe(true);
    expect(await exists(path.join(dest, 'subtitle.en.vtt'))).toBe(true);
    expect(await exists(path.join(dest, 'import-state.json'))).toBe(true);
  });

  it('should NOT copy audio.mp3 into publicBase', async () => {
    const writeBase = await makeDir('pub-write-');
    const publicBase = await makeDir('pub-public-');
    await seedSource(writeBase, 'vid123');

    await publishEpisode('vid123', {
      uploader: mockUploader(),
      writeBase,
      publicBase,
    });

    expect(await exists(path.join(publicBase, 'vid123', 'audio.mp3'))).toBe(
      false,
    );
  });

  it('should upsert the episode entry into publicBase/index.json', async () => {
    const writeBase = await makeDir('pub-write-');
    const publicBase = await makeDir('pub-public-');
    await seedSource(writeBase, 'vid123');

    const result = await publishEpisode('vid123', {
      uploader: mockUploader(),
      writeBase,
      publicBase,
    });

    const manifest = await readJson<Episode[]>(
      path.join(publicBase, 'index.json'),
    );
    expect(manifest.map((e) => e.id)).toContain('vid123');
    expect(result.manifestCount).toBe(1);
  });

  it('should throw and perform no upload/copy when import-state is missing or not completed', async () => {
    const writeBase = await makeDir('pub-write-');
    const publicBase = await makeDir('pub-public-');
    // 미완료 상태로 시드
    const dir = path.join(writeBase, 'vid123');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'import-state.json'),
      JSON.stringify(state('downloading')),
    );
    await fs.writeFile(path.join(dir, 'audio.mp3'), Buffer.from('MP3DATA'));
    const uploader = mockUploader();

    await expect(
      publishEpisode('vid123', { uploader, writeBase, publicBase }),
    ).rejects.toThrow();
    expect(uploader.calls).toHaveLength(0);
    expect(await exists(path.join(publicBase, 'index.json'))).toBe(false);
  });

  it('should throw and perform no upload when the episode directory does not exist at all', async () => {
    const writeBase = await makeDir('pub-write-');
    const publicBase = await makeDir('pub-public-');
    // 어떤 파일도 시드하지 않음 — .shadowing에 해당 id 디렉터리 자체가 없음(AC4 "없거나").
    const uploader = mockUploader();

    await expect(
      publishEpisode('unknownid', { uploader, writeBase, publicBase }),
    ).rejects.toThrow();
    expect(uploader.calls).toHaveLength(0);
    expect(await exists(path.join(publicBase, 'unknownid'))).toBe(false);
    expect(await exists(path.join(publicBase, 'index.json'))).toBe(false);
  });

  it('should propagate uploader error and NOT write manifest when upload fails', async () => {
    const writeBase = await makeDir('pub-write-');
    const publicBase = await makeDir('pub-public-');
    await seedSource(writeBase, 'vid123');
    const failing: AudioUploader = {
      uploadAudio: vi.fn(async () => {
        throw new Error('R2 upload failed');
      }),
    };

    await expect(
      publishEpisode('vid123', { uploader: failing, writeBase, publicBase }),
    ).rejects.toThrow(/R2 upload failed/);
    expect(await exists(path.join(publicBase, 'index.json'))).toBe(false);
  });
});
