import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { alignTranscript } from './alignment';
import type { Segment } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-issue12-vid';

function dir(id: string): string {
  return path.join(BASE, id);
}

const VTT = `WEBVTT

00:00:00.000 --> 00:00:06.000
The grizzly bear caught a salmon.

00:00:06.000 --> 00:00:12.000
Antarctica penguins waddle slowly today.`;

const TRANSCRIPT =
  [
    { speaker: 'DUCKWORTH', text: 'The grizzly bear caught a salmon.' },
    { speaker: 'DUBNER', text: 'Antarctica penguins waddle slowly today.' },
  ]
    .map((s) => JSON.stringify(s))
    .join('\n') + '\n';

async function writeFixtures(): Promise<void> {
  await fs.mkdir(dir(VID), { recursive: true });
  await fs.writeFile(path.join(dir(VID), 'subtitle.en.vtt'), VTT);
  await fs.writeFile(path.join(dir(VID), 'transcript.txt'), TRANSCRIPT);
}

async function readSegments(): Promise<Segment[]> {
  const raw = await fs.readFile(path.join(dir(VID), 'segments.json'), 'utf-8');
  return JSON.parse(raw) as Segment[];
}

afterEach(async () => {
  await fs.rm(dir(VID), { recursive: true, force: true });
});

describe('alignTranscript', () => {
  it('should write segments.json (Segment[]) and return matchRate>=0.85 for a well-matched fixture', async () => {
    await writeFixtures();
    const { matchRate } = await alignTranscript(VID);
    expect(matchRate).toBeGreaterThanOrEqual(0.85);
    expect(matchRate).toBeLessThanOrEqual(1);

    const segments = await readSegments();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments).toHaveLength(2);
    for (const s of segments) {
      expect(typeof s.id).toBe('string');
      expect(s.start).toBeLessThan(s.end);
      expect(['DUCKWORTH', 'DUBNER', 'BOTH', 'NARRATOR']).toContain(s.speaker);
      expect(typeof s.text).toBe('string');
    }
    expect(segments[0].speaker).toBe('DUCKWORTH');
    expect(segments[1].speaker).toBe('DUBNER');
  });

  it('segments should have start<end and monotonically increasing times', async () => {
    await writeFixtures();
    await alignTranscript(VID);
    const segments = await readSegments();
    for (let i = 0; i < segments.length; i++) {
      expect(segments[i].start).toBeLessThan(segments[i].end);
      if (i > 0) {
        expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].end);
      }
    }
  });

  it('should throw when subtitle.en.vtt is missing', async () => {
    await fs.mkdir(dir(VID), { recursive: true });
    await fs.writeFile(path.join(dir(VID), 'transcript.txt'), TRANSCRIPT);
    await expect(alignTranscript(VID)).rejects.toThrow();
  });

  it('should throw when transcript.txt is missing', async () => {
    await fs.mkdir(dir(VID), { recursive: true });
    await fs.writeFile(path.join(dir(VID), 'subtitle.en.vtt'), VTT);
    await expect(alignTranscript(VID)).rejects.toThrow();
  });
});
