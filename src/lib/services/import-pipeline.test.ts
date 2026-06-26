import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { runImportPipeline, type PipelineSteps } from './import-pipeline';
import type { ImportState } from '../types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const TEST_VIDEO_ID = 'test-pipeline-vid';
const URLS = {
  youtubeUrl: 'https://www.youtube.com/watch?v=test-pipeline-vid',
  transcriptUrl: 'https://example.com/transcript',
};

function episodeDir(id: string): string {
  return path.join(BASE, id);
}

async function readState(id: string): Promise<ImportState | null> {
  try {
    const raw = await fs.readFile(
      path.join(episodeDir(id), 'import-state.json'),
      'utf-8',
    );
    return JSON.parse(raw) as ImportState;
  } catch {
    return null;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** 단계 더블이 산출 아티펙트가 남는지 검증할 수 있도록 더미 파일을 기록한다. */
async function writeArtifact(id: string, name: string): Promise<void> {
  await fs.mkdir(episodeDir(id), { recursive: true });
  await fs.writeFile(path.join(episodeDir(id), name), 'dummy');
}

function makeSteps(overrides: Partial<PipelineSteps> = {}): PipelineSteps {
  return {
    downloadAudio: vi.fn().mockResolvedValue(undefined),
    fetchSubtitle: vi.fn().mockResolvedValue(undefined),
    fetchTranscript: vi.fn().mockResolvedValue(undefined),
    alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.95 }),
    ...overrides,
  };
}

afterEach(async () => {
  await fs.rm(episodeDir(TEST_VIDEO_ID), { recursive: true, force: true });
});

describe('runImportPipeline', () => {
  // ------------------------------ 정상 ------------------------------
  it('should transition status/currentStep through download→subtitle→transcript→alignment in order when all steps succeed', async () => {
    const seen: Array<{ status: string; currentStep: string }> = [];
    const record = async () => {
      const s = await readState(TEST_VIDEO_ID);
      if (s) seen.push({ status: s.status, currentStep: s.currentStep });
    };
    const steps = makeSteps({
      downloadAudio: vi.fn(record),
      fetchSubtitle: vi.fn(record),
      fetchTranscript: vi.fn(record),
      alignTranscript: vi.fn(async () => {
        await record();
        return { matchRate: 0.95 };
      }),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    expect(seen).toEqual([
      { status: 'downloading', currentStep: 'download' },
      { status: 'processing_subtitles', currentStep: 'subtitle' },
      { status: 'processing_transcript', currentStep: 'transcript' },
      { status: 'aligning', currentStep: 'alignment' },
    ]);
  });

  it("should end with status 'completed' and progress 100 when all steps succeed", async () => {
    await runImportPipeline(TEST_VIDEO_ID, URLS, makeSteps());

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('completed');
    expect(state?.progress).toBe(100);
  });

  it('should call each step exactly once in download→subtitle→transcript→alignment order when all steps succeed', async () => {
    const order: string[] = [];
    const steps = makeSteps({
      downloadAudio: vi.fn(async () => {
        order.push('download');
      }),
      fetchSubtitle: vi.fn(async () => {
        order.push('subtitle');
      }),
      fetchTranscript: vi.fn(async () => {
        order.push('transcript');
      }),
      alignTranscript: vi.fn(async () => {
        order.push('alignment');
        return { matchRate: 0.95 };
      }),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    expect(order).toEqual(['download', 'subtitle', 'transcript', 'alignment']);
    expect(steps.downloadAudio).toHaveBeenCalledTimes(1);
    expect(steps.fetchSubtitle).toHaveBeenCalledTimes(1);
    expect(steps.fetchTranscript).toHaveBeenCalledTimes(1);
    expect(steps.alignTranscript).toHaveBeenCalledTimes(1);
  });

  it('should invoke alignTranscript (producer of segments.json) when the alignment stage is reached', async () => {
    const steps = makeSteps();
    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    expect(steps.alignTranscript).toHaveBeenCalledWith(TEST_VIDEO_ID);
  });

  // ------------------------------ 경계 ------------------------------
  it("should mark status 'failed' with currentStep 'alignment' and error containing '0.72 < 0.85' when alignTranscript returns matchRate 0.72", async () => {
    const steps = makeSteps({
      alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.72 }),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('alignment');
    expect(state?.error).toContain('0.72 < 0.85');
  });

  it('should treat matchRate exactly 0.85 as success (completed) since threshold is inclusive', async () => {
    const steps = makeSteps({
      alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.85 }),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('completed');
  });

  it("should mark status 'failed' when alignTranscript returns matchRate 0.84 (just below threshold)", async () => {
    const steps = makeSteps({
      alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.84 }),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('alignment');
  });

  it('should keep downloaded artifacts (not delete the episode dir) when failing on low matchRate', async () => {
    const steps = makeSteps({
      downloadAudio: vi.fn(async () => {
        await writeArtifact(TEST_VIDEO_ID, 'audio.mp3');
      }),
      alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.5 }),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    expect(
      await exists(path.join(episodeDir(TEST_VIDEO_ID), 'audio.mp3')),
    ).toBe(true);
  });

  it('should not call subsequent steps after a failing step (transcript/alignment not called when fetchSubtitle throws)', async () => {
    const steps = makeSteps({
      fetchSubtitle: vi.fn().mockRejectedValue(new Error('subtitle boom')),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    expect(steps.fetchTranscript).not.toHaveBeenCalled();
    expect(steps.alignTranscript).not.toHaveBeenCalled();
  });

  // ------------------------------ 예외 ------------------------------
  it("should set status 'failed' with currentStep 'download' and recorded error when downloadAudio throws", async () => {
    const steps = makeSteps({
      downloadAudio: vi.fn().mockRejectedValue(new Error('download boom')),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('download');
    expect(state?.error).toContain('download boom');
  });

  it("should set status 'failed' with currentStep 'subtitle' and recorded error when fetchSubtitle throws", async () => {
    const steps = makeSteps({
      fetchSubtitle: vi.fn().mockRejectedValue(new Error('subtitle boom')),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('subtitle');
    expect(state?.error).toContain('subtitle boom');
  });

  it("should set status 'failed' with currentStep 'transcript' and recorded error when fetchTranscript throws", async () => {
    const steps = makeSteps({
      fetchTranscript: vi.fn().mockRejectedValue(new Error('transcript boom')),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('transcript');
    expect(state?.error).toContain('transcript boom');
  });

  it("should set status 'failed' with currentStep 'alignment' and recorded error when alignTranscript throws", async () => {
    const steps = makeSteps({
      alignTranscript: vi.fn().mockRejectedValue(new Error('align boom')),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('alignment');
    expect(state?.error).toContain('align boom');
  });

  it('should resolve (not throw) even when a step throws, so the fire-and-forget caller stays safe', async () => {
    const steps = makeSteps({
      downloadAudio: vi.fn().mockRejectedValue(new Error('download boom')),
    });

    await expect(
      runImportPipeline(TEST_VIDEO_ID, URLS, steps),
    ).resolves.toBeUndefined();
  });

  it('should record the thrown value in error when a step throws a non-Error (string)', async () => {
    const steps = makeSteps({
      downloadAudio: vi.fn().mockRejectedValue('raw string failure'),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    const state = await readState(TEST_VIDEO_ID);
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('download');
    expect(state?.error).toContain('raw string failure');
  });

  it('should keep artifacts (not delete) when a step throws', async () => {
    const steps = makeSteps({
      downloadAudio: vi.fn(async () => {
        await writeArtifact(TEST_VIDEO_ID, 'audio.mp3');
      }),
      fetchSubtitle: vi.fn().mockRejectedValue(new Error('subtitle boom')),
    });

    await runImportPipeline(TEST_VIDEO_ID, URLS, steps);

    expect(
      await exists(path.join(episodeDir(TEST_VIDEO_ID), 'audio.mp3')),
    ).toBe(true);
  });
});
