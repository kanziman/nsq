import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { runImportPipeline, type PipelineSteps } from './import-pipeline';
import { downloadAudio, fetchSubtitle, type Runner } from './import/youtube';
import { fetchTranscript, type Fetcher } from './import/transcript';
import { alignTranscript } from './import/alignment';
import type { ImportState } from '../types';

// 오케스트레이터의 상태 전이 시퀀스를 포착(파일은 덮어써 최종만 남으므로).
const { stateLog } = vi.hoisted(() => ({
  stateLog: [] as { status: string; progress: number }[],
}));
vi.mock('./episodes', async (importActual) => {
  const actual = await importActual<typeof import('./episodes')>();
  return {
    ...actual,
    saveImportState: vi.fn(async (videoId: string, state: ImportState) => {
      stateLog.push({ status: state.status, progress: state.progress });
      return actual.saveImportState(videoId, state);
    }),
  };
});

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-pipeline-integration-vid';
const URLS = {
  youtubeUrl: 'https://www.youtube.com/watch?v=integration',
  transcriptUrl: 'https://freakonomics.com/episode/integration',
};

function dir(id: string): string {
  return path.join(BASE, id);
}
function artifact(id: string, name: string): string {
  return path.join(dir(id), name);
}
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const VTT = `WEBVTT

00:00:00.000 --> 00:00:06.000
The grizzly bear caught a salmon.

00:00:06.000 --> 00:00:12.000
Antarctica penguins waddle slowly today.`;

const TRANSCRIPT_HTML = `
  <p><strong>Angela DUCKWORTH:</strong> The grizzly bear caught a salmon.</p>
  <p><strong>Stephen DUBNER:</strong> Antarctica penguins waddle slowly today.</p>`;

// fake runner: yt-dlp 대체. --extract-audio → audio.mp3, --write-subs → subtitle.en.vtt.
const fakeRunner: Runner = async (_cmd, args) => {
  const out = args[args.indexOf('-o') + 1];
  if (args.includes('--extract-audio')) {
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, 'FAKE_MP3');
  } else if (args.includes('--write-subs')) {
    const vttPath = out.replace('%(ext)s', 'en.vtt');
    await fs.mkdir(path.dirname(vttPath), { recursive: true });
    await fs.writeFile(vttPath, VTT);
  }
  return { code: 0, stderr: '' };
};

// fake fetcher: 대본 HTML 반환.
const fakeFetcher: Fetcher = (async () =>
  new Response(TRANSCRIPT_HTML, { status: 200 })) as Fetcher;

// 실제 단계 모듈을 fake runner/fetcher로 배선한 PipelineSteps.
function realSteps(): PipelineSteps {
  return {
    downloadAudio: vi.fn((vid: string, url: string) =>
      downloadAudio(vid, url, fakeRunner),
    ),
    fetchSubtitle: vi.fn((vid: string, url: string) =>
      fetchSubtitle(vid, url, fakeRunner),
    ),
    fetchTranscript: vi.fn((vid: string, url: string) =>
      fetchTranscript(vid, url, fakeFetcher),
    ),
    alignTranscript: vi.fn((vid: string) => alignTranscript(vid)),
  };
}

beforeEach(() => {
  stateLog.length = 0;
});
afterEach(async () => {
  await fs.rm(dir(VID), { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('runImportPipeline — engine integration (#14)', () => {
  it('should create all 4 artifacts and transition downloading→processing_subtitles→processing_transcript→aligning→completed(100)', async () => {
    await runImportPipeline(VID, URLS, realSteps());

    expect(await exists(artifact(VID, 'audio.mp3'))).toBe(true);
    expect(await exists(artifact(VID, 'subtitle.en.vtt'))).toBe(true);
    expect(await exists(artifact(VID, 'transcript.txt'))).toBe(true);
    expect(await exists(artifact(VID, 'segments.json'))).toBe(true);

    expect(stateLog.map((s) => s.status)).toEqual([
      'downloading',
      'processing_subtitles',
      'processing_transcript',
      'aligning',
      'completed',
    ]);
    expect(stateLog[stateLog.length - 1]).toEqual({
      status: 'completed',
      progress: 100,
    });
  });

  it("retryStep='transcript' should skip download/subtitle, run transcript+alignment, and complete", async () => {
    // 기존 audio/subtitle 산출물 사전 배치.
    await fs.mkdir(dir(VID), { recursive: true });
    await fs.writeFile(artifact(VID, 'audio.mp3'), 'EXISTING_MP3');
    await fs.writeFile(artifact(VID, 'subtitle.en.vtt'), VTT);

    const steps = realSteps();
    await runImportPipeline(VID, { ...URLS, retryStep: 'transcript' }, steps);

    expect(steps.downloadAudio).not.toHaveBeenCalled();
    expect(steps.fetchSubtitle).not.toHaveBeenCalled();
    expect(steps.fetchTranscript).toHaveBeenCalledTimes(1);
    expect(steps.alignTranscript).toHaveBeenCalledTimes(1);
    expect(await exists(artifact(VID, 'transcript.txt'))).toBe(true);
    expect(await exists(artifact(VID, 'segments.json'))).toBe(true);
    expect(stateLog[stateLog.length - 1].status).toBe('completed');
  });

  it('should mark failed at the failing step, skip subsequent steps, and keep prior artifacts', async () => {
    const steps = realSteps();
    // transcript 단계 실패: fetcher가 비-2xx 반환.
    steps.fetchTranscript = vi.fn((vid: string, url: string) =>
      fetchTranscript(
        vid,
        url,
        (async () => new Response('error', { status: 500 })) as Fetcher,
      ),
    );

    await runImportPipeline(VID, URLS, steps);

    const raw = await fs.readFile(artifact(VID, 'import-state.json'), 'utf-8');
    const state = JSON.parse(raw) as ImportState;
    expect(state.status).toBe('failed');
    expect(state.currentStep).toBe('transcript');
    // 후속(alignment) 미실행.
    expect(steps.alignTranscript).not.toHaveBeenCalled();
    expect(await exists(artifact(VID, 'segments.json'))).toBe(false);
    // 선행 아티펙트 유지.
    expect(await exists(artifact(VID, 'audio.mp3'))).toBe(true);
    expect(await exists(artifact(VID, 'subtitle.en.vtt'))).toBe(true);
  });
});
