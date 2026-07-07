/**
 * #126: 파이프라인이 translation 스텝에 language를 전달하는지 검증.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { runImportPipeline, type PipelineSteps } from './import-pipeline';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-translation-routing-vid';
const YT = 'https://www.youtube.com/watch?v=test-translation-routing-vid';

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

describe('runImportPipeline (translation language routing)', () => {
  // [정상] 자막 전용 ja → translate에 'ja' 전달
  it("should call translate with 'ja' in subtitle-only ja mode", async () => {
    const steps = makeSteps();
    await runImportPipeline(VID, { youtubeUrl: YT, language: 'ja' }, steps);
    expect(steps.translate).toHaveBeenCalledWith(VID, 'ja');
  });

  // [정상] 대본 정합 en → translate에 'en' 전달(회귀)
  it("should call translate with 'en' in transcript mode", async () => {
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
    expect(steps.translate).toHaveBeenCalledWith(VID, 'en');
  });

  // [정상] retryStep 'translation' → state language(ja)로 재보충
  it("should call translate with state language when retryStep is 'translation'", async () => {
    await writeArtifact('segments.json');
    const steps = makeSteps();
    await runImportPipeline(
      VID,
      { youtubeUrl: YT, language: 'ja', retryStep: 'translation' },
      steps,
    );
    expect(steps.translate).toHaveBeenCalledWith(VID, 'ja');
    expect(steps.buildCueSegments).not.toHaveBeenCalled();
    expect(steps.downloadAudio).not.toHaveBeenCalled();
  });
});
