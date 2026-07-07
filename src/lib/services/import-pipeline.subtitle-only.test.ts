/**
 * #124: 자막 전용(subtitle-only) 모드 — transcriptUrl 부재 시
 * download → subtitle(lang) → segments(큐) → translation → meta → completed.
 * alignment·matchRate 게이트는 실행하지 않는다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { runImportPipeline, type PipelineSteps } from './import-pipeline';
import type { ImportState } from '../types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-subonly-vid';
const YT = 'https://www.youtube.com/watch?v=test-subonly-vid';

async function readState(): Promise<ImportState | null> {
  try {
    const raw = await fs.readFile(
      path.join(BASE, VID, 'import-state.json'),
      'utf-8',
    );
    return JSON.parse(raw) as ImportState;
  } catch {
    return null;
  }
}

function makeSteps(overrides: Partial<PipelineSteps> = {}): PipelineSteps {
  return {
    downloadAudio: vi.fn().mockResolvedValue(undefined),
    fetchSubtitle: vi.fn().mockResolvedValue(undefined),
    fetchTranscript: vi.fn().mockResolvedValue(undefined),
    alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.95 }),
    buildCueSegments: vi.fn().mockResolvedValue(undefined),
    translate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
});

describe('runImportPipeline (subtitle-only mode)', () => {
  // [정상] transcript/alignment 없이 큐 세그먼트 경로로 완주
  it('should run download→subtitle→segments→translation without transcript/alignment when transcriptUrl is absent', async () => {
    const steps = makeSteps();
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);

    expect(steps.downloadAudio).toHaveBeenCalledTimes(1);
    expect(steps.fetchSubtitle).toHaveBeenCalledTimes(1);
    expect(steps.buildCueSegments).toHaveBeenCalledWith(VID, 'ja');
    expect(steps.fetchTranscript).not.toHaveBeenCalled();
    expect(steps.alignTranscript).not.toHaveBeenCalled();
    expect(steps.translate).toHaveBeenCalledTimes(1);

    const state = await readState();
    expect(state?.status).toBe('completed');
    expect(state?.progress).toBe(100);
    expect(state?.matchRate).toBeUndefined();
  });

  // [정상] fetchSubtitle에 lang 전달
  it("should pass language to fetchSubtitle when language is 'ja'", async () => {
    const steps = makeSteps();
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    expect(steps.fetchSubtitle).toHaveBeenCalledWith(VID, YT, 'ja');
  });

  // [정상] 기존 대본 정합 경로 회귀: transcriptUrl 있으면 alignment 실행, 큐 스텝 미실행
  it('should keep existing transcript+alignment flow when transcriptUrl is present', async () => {
    const steps = makeSteps();
    await runImportPipeline(
      VID,
      {
        youtubeUrl: YT,
        transcriptUrl: 'https://example.com/t',
        language: 'en',
      },
      steps,
    );
    expect(steps.fetchTranscript).toHaveBeenCalledTimes(1);
    expect(steps.alignTranscript).toHaveBeenCalledTimes(1);
    expect(steps.buildCueSegments).not.toHaveBeenCalled();
    const state = await readState();
    expect(state?.status).toBe('completed');
    expect(state?.matchRate).toBe(0.95);
  });

  // [정상] 모든 상태 쓰기에서 language 보존
  it("should preserve language in every import-state write when language is 'ja'", async () => {
    const seen: Array<string | undefined> = [];
    const record = async () => {
      seen.push((await readState())?.language);
    };
    const steps = makeSteps({
      downloadAudio: vi.fn(record),
      fetchSubtitle: vi.fn(record),
      buildCueSegments: vi.fn(record),
    });
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);

    expect(seen).toEqual(['ja', 'ja', 'ja']);
    expect((await readState())?.language).toBe('ja');
  });

  // [경계] 빈 문자열 transcriptUrl → 자막 전용 모드
  it('should treat empty-string transcriptUrl as subtitle-only mode', async () => {
    const steps = makeSteps();
    await runImportPipeline(
      VID,
      { youtubeUrl: YT, transcriptUrl: '', language: 'ja' },
      steps,
    );
    expect(steps.buildCueSegments).toHaveBeenCalledTimes(1);
    expect(steps.fetchTranscript).not.toHaveBeenCalled();
  });

  // [예외] subtitle 단계 실패 → failed
  it('should mark failed at subtitle step when fetchSubtitle throws in subtitle-only mode', async () => {
    const steps = makeSteps({
      fetchSubtitle: vi.fn().mockRejectedValue(new Error('no subs')),
    });
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    const state = await readState();
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('subtitle');
    expect(state?.error).toMatch(/no subs/);
  });

  // [예외] 큐 세그먼트 스텝 실패 → failed (필수 단계)
  it('should mark failed at segments step when buildCueSegments throws', async () => {
    const steps = makeSteps({
      buildCueSegments: vi.fn().mockRejectedValue(new Error('no cues')),
    });
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    const state = await readState();
    expect(state?.status).toBe('failed');
    expect(state?.currentStep).toBe('segments');
  });

  // [정상] translate 실패는 best-effort — 자막 전용 모드에서도 완주
  it('should still complete when translate throws in subtitle-only mode', async () => {
    const steps = makeSteps({
      translate: vi.fn().mockRejectedValue(new Error('llm down')),
    });
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    expect(steps.buildCueSegments).toHaveBeenCalledTimes(1);
    expect((await readState())?.status).toBe('completed');
  });
});
