import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type { Segment } from '@/lib/types';
import { buildCueSegments, SUBTITLE_ONLY_SPEAKER } from './cue-segments';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-cue-segments-vid';

const JA_VTT = `WEBVTT
Kind: captions
Language: ja

00:00:00.000 --> 00:00:02.000 align:start position:0%
 
こんにちは<00:00:00.500><c>皆さん</c>

00:00:02.000 --> 00:00:04.000 align:start position:0%
こんにちは皆さん
今日は<00:00:02.500><c>いい</c><00:00:03.000><c>天気</c>
`;

const EMPTY_VTT = `WEBVTT

Kind: captions
`;

async function writeVtt(lang: string, content: string): Promise<void> {
  await fs.mkdir(path.join(BASE, VID), { recursive: true });
  await fs.writeFile(path.join(BASE, VID, `subtitle.${lang}.vtt`), content);
}

async function readSegments(): Promise<Segment[]> {
  const raw = await fs.readFile(path.join(BASE, VID, 'segments.json'), 'utf-8');
  return JSON.parse(raw) as Segment[];
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
});

describe('buildCueSegments', () => {
  // [정상] 큐 → 세그먼트: SPEAKER 화자, cue-{n} id, 큐 타이밍
  it("should write segments.json with speaker 'SPEAKER', cue-{n} ids and cue timings when subtitle.ja.vtt has cues", async () => {
    await writeVtt('ja', JA_VTT);
    await buildCueSegments(VID, 'ja');

    const segments = await readSegments();
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      id: 'cue-1',
      speaker: SUBTITLE_ONLY_SPEAKER,
      text: 'こんにちは皆さん',
      start: 0,
      end: 2,
    });
    expect(segments[1]).toMatchObject({
      id: 'cue-2',
      text: '今日はいい天気',
      start: 2,
      end: 4,
    });
  });

  // [경계] 롤링 중복 제거 후에도 순서·단조 증가 start 유지
  it('should keep cue order and monotonic start times when rolling captions repeat text', async () => {
    await writeVtt('ja', JA_VTT);
    await buildCueSegments(VID, 'ja');

    const segments = await readSegments();
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].start);
    }
    // 이월 텍스트가 별도 세그먼트로 중복 생성되지 않는다.
    const texts = segments.map((s) => s.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  // [예외] 자막 파일 부재 → throw
  it('should throw when subtitle.{lang}.vtt is missing', async () => {
    await expect(buildCueSegments(VID, 'ja')).rejects.toThrow(
      /subtitle\.ja\.vtt/,
    );
  });

  // [예외] 파싱 결과 큐 0개 → throw
  it('should throw when parsed cue list is empty', async () => {
    await writeVtt('ja', EMPTY_VTT);
    await expect(buildCueSegments(VID, 'ja')).rejects.toThrow(/no cues/i);
  });
});
