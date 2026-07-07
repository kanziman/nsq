/**
 * #128: furigana 스텝 배선 — 자막 전용 ja 모드에서 translate 직후 best-effort.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { runImportPipeline, type PipelineSteps } from './import-pipeline';
import type { ImportState } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-furigana-pipe-vid';
const YT = 'https://www.youtube.com/watch?v=test-furigana-pipe-vid';

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
    buildSentences: vi.fn().mockResolvedValue(undefined),
    translate: vi.fn().mockResolvedValue(undefined),
    annotateFurigana: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
});

describe('runImportPipeline (furigana step)', () => {
  // [정상] 자막 전용 ja: translate 이후 실행
  it('should call annotateFurigana after translate in subtitle-only ja mode', async () => {
    const order: string[] = [];
    const steps = makeSteps({
      translate: vi.fn(async () => {
        order.push('translate');
      }),
      annotateFurigana: vi.fn(async () => {
        order.push('furigana');
      }),
    });
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    expect(order).toEqual(['translate', 'furigana']);
    expect(steps.annotateFurigana).toHaveBeenCalledWith(VID);
    expect((await readState())?.status).toBe('completed');
  });

  // [정상] AC4: furigana 실패해도 completed(원문 표시 유지)
  it('should still complete when annotateFurigana throws', async () => {
    const steps = makeSteps({
      annotateFurigana: vi.fn().mockRejectedValue(new Error('llm down')),
    });
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    const state = await readState();
    expect(state?.status).toBe('completed');
    expect(state?.progress).toBe(100);
  });

  // [정상] retryStep 'sentences' 재실행 시 ruby 유실을 furigana 재실행이 복구
  it("should re-run annotateFurigana when retryStep is 'sentences' (ruby 재주입 경로)", async () => {
    await fs.mkdir(path.join(BASE, VID), { recursive: true });
    await fs.writeFile(path.join(BASE, VID, 'subtitle.ja.vtt'), 'dummy');
    const steps = makeSteps();
    await runImportPipeline(
      VID,
      { youtubeUrl: YT, language: 'ja', retryStep: 'sentences' },
      steps,
    );
    expect(steps.annotateFurigana).toHaveBeenCalledWith(VID);
    expect((await readState())?.status).toBe('completed');
  });

  // [정상] 대본 정합 모드·en 자막 전용에서는 미실행
  it('should not run annotateFurigana in transcript mode or for en subtitle-only', async () => {
    const transcript = makeSteps();
    await runImportPipeline(
      VID,
      {
        youtubeUrl: YT,
        transcriptUrl: 'https://example.com/t',
        language: 'en',
      },
      transcript,
    );
    expect(transcript.annotateFurigana).not.toHaveBeenCalled();

    await fs.rm(path.join(BASE, VID), { recursive: true, force: true });

    const enSubOnly = makeSteps();
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'en' }, enSubOnly);
    expect(enSubOnly.annotateFurigana).not.toHaveBeenCalled();
  });
});
