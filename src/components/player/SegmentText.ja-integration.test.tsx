// @vitest-environment jsdom
/**
 * #137 종단간(end-to-end): getEpisodeSegments(실측 VTT) → SegmentText(렌더).
 * 이슈 표의 プラットフォーム 드리프트 케이스가 실제로 해소되는지, 즉 실측 wordStarts를
 * 소비하면 균등분할과 다른 단어가 강조되는지 한 경로로 검증한다.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import fs from 'fs/promises';
import path from 'path';
import { getEpisodeSegments } from '@/lib/services/episodes';
import { SegmentText } from './SegmentText';
import type { Segment, EpisodeMeta } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-ja137-e2e-vid';

// 이슈 실측: シェア(7.01) する(8.87) プラットフォーム(12.14) 風(14.10).
const JA_TEXT = 'シェアするプラットフォーム風';
const JA_VTT =
  'WEBVTT\n\n' +
  '00:00:07.010 --> 00:00:15.340\n' +
  'シェア<00:00:08.870><c>する</c>' +
  '<00:00:12.140><c>プラットフォーム</c>' +
  '<00:00:14.100><c>風</c>\n';

async function writeJaEpisode(): Promise<void> {
  const dir = path.join(BASE, VID);
  await fs.mkdir(dir, { recursive: true });
  const seg: Segment = {
    id: 'sent-2',
    start: 7.01,
    end: 15.34,
    speaker: 'SPEAKER',
    text: JA_TEXT,
  };
  await fs.writeFile(path.join(dir, 'segments.json'), JSON.stringify([seg]));
  const meta: EpisodeMeta = {
    id: VID,
    title: 'JA e2e',
    duration: 60,
    youtubeUrl: `https://youtu.be/${VID}`,
    addedAt: new Date().toISOString(),
    language: 'ja',
  };
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta));
  await fs.writeFile(path.join(dir, 'subtitle.ja.vtt'), JA_VTT);
}

afterEach(async () => {
  cleanup();
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
});

describe('SegmentText #137 e2e (VTT → getEpisodeSegments → highlight)', () => {
  // t=13.5s: 실측이면 プラットフォーム(12.14~14.10 구간), 균등분할이면 이미 다음 단어(風)로 넘어간다.
  const DRIFT_T = 13.5;

  it('should highlight プラットフォーム at the drift time using VTT-derived wordStarts', async () => {
    await writeJaEpisode();
    const [seg] = await getEpisodeSegments(VID);
    expect(seg.wordStarts).toBeDefined();
    const { container } = render(
      <SegmentText
        segment={seg}
        language="ja"
        highlightWords
        currentTime={DRIFT_T}
      />,
    );
    const current = container.querySelector('[data-current-word]');
    expect(current?.textContent).toBe('プラットフォーム');
  });

  it('should highlight a different (later) word at the same time when falling back to uniform split', async () => {
    await writeJaEpisode();
    const [seg] = await getEpisodeSegments(VID);
    // wordStarts를 제거해 균등분할 폴백을 강제 → 같은 시각에 プラットフォーム가 아니어야 한다.
    const uniform: Segment = { ...seg, wordStarts: undefined };
    const { container } = render(
      <SegmentText
        segment={uniform}
        language="ja"
        highlightWords
        currentTime={DRIFT_T}
      />,
    );
    const current = container.querySelector('[data-current-word]');
    expect(current?.textContent).not.toBe('プラットフォーム');
  });
});
