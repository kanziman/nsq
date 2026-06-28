import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { alignTranscript } from './alignment';
import type { Segment } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-issue13-vid';

function dir(id: string): string {
  return path.join(BASE, id);
}

function transcriptJsonl(rows: { speaker: string; text: string }[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

async function readSegments(): Promise<Segment[]> {
  const raw = await fs.readFile(path.join(dir(VID), 'segments.json'), 'utf-8');
  return JSON.parse(raw) as Segment[];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await fs.rm(dir(VID), { recursive: true, force: true });
});

describe('alignTranscript — boundary / quality (#13)', () => {
  // AC1: 거의 불일치 입력 → segments.json 여전히 기록 + matchRate<0.85, throw 안 함
  it('should still write segments.json and return matchRate<0.85 (no throw) for near-mismatch input', async () => {
    // 단어 순서 전치로 LIS가 후보보다 작아 matchRate<0.85가 되도록 구성.
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
epsilon alpha beta gamma delta`;
    await fs.mkdir(dir(VID), { recursive: true });
    await fs.writeFile(path.join(dir(VID), 'subtitle.en.vtt'), vtt);
    await fs.writeFile(
      path.join(dir(VID), 'transcript.txt'),
      transcriptJsonl([
        { speaker: 'DUCKWORTH', text: 'alpha beta gamma delta epsilon' },
      ]),
    );

    const { matchRate } = await alignTranscript(VID);
    expect(matchRate).toBeLessThan(0.85);
    expect(matchRate).toBeGreaterThan(0);
    const segments = await readSegments();
    expect(segments.length).toBeGreaterThanOrEqual(1);
  });

  // AC3: 공통 앵커 0개 → matchRate=0, throw 안 함, segments.json 기록
  it('should return matchRate 0 and still write segments.json when there are zero common anchors', async () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
xxx yyy zzz`;
    await fs.mkdir(dir(VID), { recursive: true });
    await fs.writeFile(path.join(dir(VID), 'subtitle.en.vtt'), vtt);
    await fs.writeFile(
      path.join(dir(VID), 'transcript.txt'),
      transcriptJsonl([{ speaker: 'DUBNER', text: 'aaa bbb ccc' }]),
    );

    const { matchRate } = await alignTranscript(VID);
    expect(matchRate).toBe(0);
    expect(await fileExists(path.join(dir(VID), 'segments.json'))).toBe(true);
    const segments = await readSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0].start).toBeLessThan(segments[0].end);
  });

  // AC2: 누락 입력 → 누락 파일명 포함 Error
  it('should throw an Error whose message names subtitle.en.vtt when it is missing', async () => {
    await fs.mkdir(dir(VID), { recursive: true });
    await fs.writeFile(
      path.join(dir(VID), 'transcript.txt'),
      transcriptJsonl([{ speaker: 'DUBNER', text: 'aaa bbb' }]),
    );
    await expect(alignTranscript(VID)).rejects.toThrow(/subtitle\.en\.vtt/);
  });

  it('should throw an Error whose message names transcript.txt when it is missing', async () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
xxx yyy zzz`;
    await fs.mkdir(dir(VID), { recursive: true });
    await fs.writeFile(path.join(dir(VID), 'subtitle.en.vtt'), vtt);
    await expect(alignTranscript(VID)).rejects.toThrow(/transcript\.txt/);
  });
});
