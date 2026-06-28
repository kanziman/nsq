import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fetchTranscript, type Fetcher } from './transcript';
import type { Sentence } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-issue11-vid';
const URL = 'https://freakonomics.com/episode/test';

function txtPath(id: string): string {
  return path.join(BASE, id, 'transcript.txt');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const GOOD_HTML = `
  <p><strong>Angela DUCKWORTH:</strong> Hello world. How are you?</p>
  <p><strong>Stephen DUBNER:</strong> I am fine.</p>`;

function fakeFetcher(body: string, status = 200): Fetcher {
  return vi.fn(
    async () => new Response(body, { status }),
  ) as unknown as Fetcher;
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('fetchTranscript', () => {
  // [정상]
  it('should write transcript.txt as JSONL with one valid Sentence per line on success', async () => {
    await fetchTranscript(VID, URL, fakeFetcher(GOOD_HTML));
    const content = await fs.readFile(txtPath(VID), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);
    const parsed: Sentence[] = lines.map((l) => JSON.parse(l));
    expect(parsed).toEqual([
      { speaker: 'DUCKWORTH', text: 'Hello world.' },
      { speaker: 'DUCKWORTH', text: 'How are you?' },
      { speaker: 'DUBNER', text: 'I am fine.' },
    ]);
    for (const s of parsed) {
      expect(typeof s.text).toBe('string');
      expect(['DUCKWORTH', 'DUBNER', 'BOTH', 'NARRATOR']).toContain(s.speaker);
    }
  });

  // [경계]
  it('should overwrite an existing transcript.txt', async () => {
    await fs.mkdir(path.join(BASE, VID), { recursive: true });
    await fs.writeFile(txtPath(VID), 'OLD CONTENT');
    await fetchTranscript(VID, URL, fakeFetcher(GOOD_HTML));
    const content = await fs.readFile(txtPath(VID), 'utf-8');
    expect(content).not.toContain('OLD CONTENT');
    expect(content.trim().split('\n')).toHaveLength(3);
  });

  // [예외]
  it('should throw when fetcher responds with a non-2xx status', async () => {
    const fetcher = fakeFetcher('server error', 500);
    await expect(fetchTranscript(VID, URL, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(await fileExists(txtPath(VID))).toBe(false);
  });

  it('should throw when parsing yields zero sentences', async () => {
    const fetcher = fakeFetcher('<p>[LAUGHTER]</p>', 200);
    await expect(fetchTranscript(VID, URL, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(await fileExists(txtPath(VID))).toBe(false);
  });
});
