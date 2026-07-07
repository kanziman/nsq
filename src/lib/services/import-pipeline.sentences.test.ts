/**
 * #125: 문장 복원(sentences) 스텝 배선 — 자막 전용 모드에서 큐 세그먼트 직후
 * status 'building_sentences'로 실행(best-effort), retryStep 'sentences' 지원.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { runImportPipeline, type PipelineSteps } from './import-pipeline';
import type { ImportState } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-sentences-vid';
const YT = 'https://www.youtube.com/watch?v=test-sentences-vid';

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

async function writeArtifact(name: string): Promise<void> {
  await fs.mkdir(path.join(BASE, VID), { recursive: true });
  await fs.writeFile(path.join(BASE, VID, name), 'dummy');
}

function makeSteps(overrides: Partial<PipelineSteps> = {}): PipelineSteps {
  return {
    downloadAudio: vi.fn().mockResolvedValue(undefined),
    fetchSubtitle: vi.fn().mockResolvedValue(undefined),
    fetchTranscript: vi.fn().mockResolvedValue(undefined),
    alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.95 }),
    buildCueSegments: vi.fn().mockResolvedValue(undefined),
    buildSentences: vi.fn().mockResolvedValue(undefined),
    translate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
});

describe('runImportPipeline (sentences step)', () => {
  // [정상] 자막 전용: 큐 세그먼트 직후 building_sentences 상태로 실행
  it("should run buildSentences with status 'building_sentences' after cue segments in subtitle-only mode", async () => {
    const seen: Array<{ status: string; currentStep: string }> = [];
    const record = async () => {
      const s = await readState();
      if (s) seen.push({ status: s.status, currentStep: s.currentStep });
    };
    const steps = makeSteps({
      buildCueSegments: vi.fn(record),
      buildSentences: vi.fn(record),
    });

    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);

    expect(steps.buildSentences).toHaveBeenCalledWith(VID);
    expect(seen).toEqual([
      { status: 'aligning', currentStep: 'segments' },
      { status: 'building_sentences', currentStep: 'sentences' },
    ]);
    expect((await readState())?.status).toBe('completed');
  });

  // [정상] best-effort: 문장 복원 실패해도 completed(큐 폴백)
  it('should still complete when buildSentences throws', async () => {
    const steps = makeSteps({
      buildSentences: vi.fn().mockRejectedValue(new Error('llm down')),
    });
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    const state = await readState();
    expect(state?.status).toBe('completed');
    expect(state?.progress).toBe(100);
  });

  // [정상] retryStep 'sentences': 큐 재생성→문장→번역, download/subtitle 미실행
  it("should rebuild cues→sentences→translate without download/subtitle when retryStep is 'sentences'", async () => {
    await writeArtifact('subtitle.ja.vtt');
    const steps = makeSteps();

    await runImportPipeline(
      VID,
      { youtubeUrl: YT, language: 'ja', retryStep: 'sentences' },
      steps,
    );

    expect(steps.downloadAudio).not.toHaveBeenCalled();
    expect(steps.fetchSubtitle).not.toHaveBeenCalled();
    expect(steps.buildCueSegments).toHaveBeenCalledWith(VID, 'ja');
    expect(steps.buildSentences).toHaveBeenCalledWith(VID);
    expect(steps.translate).toHaveBeenCalledWith(VID);
    expect((await readState())?.status).toBe('completed');
  });

  // [경계] retryStep 'sentences' + subtitle.{lang}.vtt 부재 → failed(아티팩트 검증)
  it("should fail with missing-artifact error when retryStep 'sentences' and subtitle vtt is absent", async () => {
    const steps = makeSteps();
    await runImportPipeline(
      VID,
      { youtubeUrl: YT, language: 'ja', retryStep: 'sentences' },
      steps,
    );
    const state = await readState();
    expect(state?.status).toBe('failed');
    expect(state?.error).toMatch(/subtitle\.ja\.vtt/);
    expect(steps.buildCueSegments).not.toHaveBeenCalled();
  });

  // [정상] en 자막 전용 임포트도 subtitle.en.vtt 기반으로 sentences 재시도 동작
  it("should reuse subtitle.en.vtt when retryStep 'sentences' with language 'en' (subtitle-only en)", async () => {
    await writeArtifact('subtitle.en.vtt');
    const steps = makeSteps();

    await runImportPipeline(
      VID,
      { youtubeUrl: YT, language: 'en', retryStep: 'sentences' },
      steps,
    );

    expect(steps.buildCueSegments).toHaveBeenCalledWith(VID, 'en');
    expect(steps.buildSentences).toHaveBeenCalledWith(VID);
    expect((await readState())?.status).toBe('completed');
  });

  // [정상] 대본 정합 모드에서는 문장 복원 미실행(회귀)
  it('should not run buildSentences in transcript mode', async () => {
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
    expect(steps.buildSentences).not.toHaveBeenCalled();
    expect((await readState())?.status).toBe('completed');
  });
});
