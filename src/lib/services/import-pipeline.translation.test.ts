import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { runImportPipeline, type PipelineSteps } from './import-pipeline';
import { translate, type SegmentTranslator } from './import/translation';
import type { ImportState, Segment } from '../types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-pipeline-translation-vid';
const URLS = {
  youtubeUrl: 'https://www.youtube.com/watch?v=test-pipeline-translation-vid',
  transcriptUrl: 'https://example.com/transcript',
};

function dir(id: string): string {
  return path.join(BASE, id);
}

async function readState(id: string): Promise<ImportState | null> {
  try {
    const raw = await fs.readFile(
      path.join(dir(id), 'import-state.json'),
      'utf-8',
    );
    return JSON.parse(raw) as ImportState;
  } catch {
    return null;
  }
}

async function writeArtifact(id: string, name: string, body = 'dummy') {
  await fs.mkdir(dir(id), { recursive: true });
  await fs.writeFile(path.join(dir(id), name), body);
}

function makeSteps(overrides: Partial<PipelineSteps> = {}): PipelineSteps {
  return {
    downloadAudio: vi.fn().mockResolvedValue(undefined),
    fetchSubtitle: vi.fn().mockResolvedValue(undefined),
    fetchTranscript: vi.fn().mockResolvedValue(undefined),
    alignTranscript: vi.fn().mockResolvedValue({ matchRate: 0.95 }),
    translate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(async () => {
  await fs.rm(dir(VID), { recursive: true, force: true });
});

describe('runImportPipeline — translation step (이슈 #105)', () => {
  it('[정상] AC1: alignment 통과 후 translating(95)로 translate 1회 호출 → completed(100)', async () => {
    let translatingSeen = false;
    const translate = vi.fn(async () => {
      const s = await readState(VID);
      if (s?.status === 'translating' && s.progress === 95)
        translatingSeen = true;
    });
    const steps = makeSteps({ translate });

    await runImportPipeline(VID, URLS, steps);

    expect(steps.translate).toHaveBeenCalledTimes(1);
    expect(steps.translate).toHaveBeenCalledWith(VID);
    expect(translatingSeen).toBe(true);
    const state = await readState(VID);
    expect(state?.status).toBe('completed');
    expect(state?.progress).toBe(100);
  });

  it('[예외] AC2: translate가 throw해도 failed가 아니라 completed (best-effort)', async () => {
    const steps = makeSteps({
      translate: vi.fn().mockRejectedValue(new Error('LLM down')),
    });

    await runImportPipeline(VID, URLS, steps);

    const state = await readState(VID);
    expect(state?.status).toBe('completed');
    expect(state?.progress).toBe(100);
  });

  it("[정상] AC3: retryStep 'translation' & segments.json 존재 → align 등 스킵, translate만 실행", async () => {
    await writeArtifact(VID, 'segments.json', '[]');
    const steps = makeSteps();

    await runImportPipeline(VID, { ...URLS, retryStep: 'translation' }, steps);

    expect(steps.downloadAudio).not.toHaveBeenCalled();
    expect(steps.fetchSubtitle).not.toHaveBeenCalled();
    expect(steps.fetchTranscript).not.toHaveBeenCalled();
    expect(steps.alignTranscript).not.toHaveBeenCalled();
    expect(steps.translate).toHaveBeenCalledTimes(1);
    const state = await readState(VID);
    expect(state?.status).toBe('completed');
  });

  it("[예외] AC4: retryStep 'translation'인데 segments.json 부재 → 아무 단계도 실행 안 하고 failed", async () => {
    const steps = makeSteps();

    await runImportPipeline(VID, { ...URLS, retryStep: 'translation' }, steps);

    expect(steps.alignTranscript).not.toHaveBeenCalled();
    expect(steps.translate).not.toHaveBeenCalled();
    const state = await readState(VID);
    expect(state?.status).toBe('failed');
    expect(state?.error).toMatch(/segments\.json/);
  });

  it('[정상] AC5: 멱등 재보충 — 누락 세그먼트만 채우고 기존 번역 보존', async () => {
    const segments: Segment[] = [
      {
        id: 's0',
        start: 0,
        end: 1,
        speaker: 'DUBNER',
        text: 'a',
        translation: '기존',
      },
      { id: 's1', start: 1, end: 2, speaker: 'DUBNER', text: 'b' },
    ];
    await writeArtifact(VID, 'segments.json', JSON.stringify(segments));
    const stub: SegmentTranslator = async (batch) =>
      batch.map((s) => `[KO] ${s.text}`);
    const steps = makeSteps({
      translate: (videoId: string) => translate(videoId, { translator: stub }),
    });

    await runImportPipeline(VID, { ...URLS, retryStep: 'translation' }, steps);

    const raw = await fs.readFile(
      path.join(dir(VID), 'segments.json'),
      'utf-8',
    );
    const out = JSON.parse(raw) as Segment[];
    expect(out[0].translation).toBe('기존'); // 보존
    expect(out[1].translation).toBe('[KO] b'); // 신규 보충
  });

  it('[정상] AC6: .env.example에 OPENROUTER 키들이 문서화되어 있다', async () => {
    const env = await fs.readFile(
      path.join(process.cwd(), '.env.example'),
      'utf-8',
    );
    expect(env).toContain('OPENROUTER_API_KEY');
    expect(env).toContain('OPENROUTER_MODEL');
    expect(env).toContain('OPENROUTER_BASE_URL');
  });
});
