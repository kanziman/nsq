/**
 * #137: ja 자막 전용 에피소드의 VTT 실측 단어 시각(wordStarts) 부착.
 * getEpisodeSegments가 subtitle.{language}.vtt를 일반화해 ja 세그먼트에도
 * 인라인 단어 타임스탬프 기반 wordStarts/audioStart를 부착하는지 검증한다.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getEpisodeSegments } from './episodes';
import { tokenizeJa } from '@/lib/utils/tokenize';
import type { Segment, EpisodeMeta, LanguageCode } from '@/lib/types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-ja137-vid';

function dir(): string {
  return path.join(BASE, VID);
}

function jaWordCount(text: string): number {
  return tokenizeJa(text).filter((t) => t.isWord).length;
}

async function writeEpisode(opts: {
  segments: Segment[];
  language?: LanguageCode;
  jaVtt?: string;
  enVtt?: string;
}): Promise<void> {
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(
    path.join(dir(), 'segments.json'),
    JSON.stringify(opts.segments),
  );
  if (opts.language) {
    const meta: EpisodeMeta = {
      id: VID,
      title: 'JA episode',
      duration: 60,
      youtubeUrl: `https://youtu.be/${VID}`,
      addedAt: new Date().toISOString(),
      language: opts.language,
    };
    await fs.writeFile(path.join(dir(), 'meta.json'), JSON.stringify(meta));
  }
  if (opts.jaVtt) {
    await fs.writeFile(path.join(dir(), 'subtitle.ja.vtt'), opts.jaVtt);
  }
  if (opts.enVtt) {
    await fs.writeFile(path.join(dir(), 'subtitle.en.vtt'), opts.enVtt);
  }
}

// sent-2(7.01–15.34s) 실측 대조 케이스. 인라인 단어 타임스탬프 보유.
const JA_TEXT = 'シェアするプラットフォーム風';
const JA_VTT =
  'WEBVTT\n\n' +
  '00:00:07.010 --> 00:00:15.340\n' +
  'シェア<00:00:08.870><c>する</c>' +
  '<00:00:12.140><c>プラットフォーム</c>' +
  '<00:00:14.100><c>風</c>\n';

const JA_SEG: Segment = {
  id: 'sent-2',
  start: 7.01,
  end: 15.34,
  speaker: 'SPEAKER',
  text: JA_TEXT,
};

afterEach(async () => {
  await fs.rm(dir(), { recursive: true, force: true });
});

describe('getEpisodeSegments (#137 ja wordStarts)', () => {
  it('should attach wordStarts from subtitle.ja.vtt inline word times when meta.language is ja', async () => {
    await writeEpisode({ segments: [JA_SEG], language: 'ja', jaVtt: JA_VTT });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].wordStarts).toBeDefined();
    expect(result[0].wordStarts!.length).toBe(jaWordCount(JA_TEXT));
  });

  it('should resolve the VTT path from meta.language (ja file read, en ignored)', async () => {
    // subtitle.en.vtt만 있고 meta.language=ja면, en을 읽지 않아 부착이 없어야 한다.
    await writeEpisode({
      segments: [JA_SEG],
      language: 'ja',
      enVtt: 'WEBVTT\n\n00:00:07.010 --> 00:00:15.340\nhello world\n',
    });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].wordStarts).toBeUndefined();
  });

  it('should size wordStarts by tokenizeJa word tokens (not whitespace split)', async () => {
    await writeEpisode({ segments: [JA_SEG], language: 'ja', jaVtt: JA_VTT });
    const result = await getEpisodeSegments(VID, BASE);
    // 공백 분해라면 무공백 ja는 1이 되지만, 토큰 기준이면 2개 이상이어야 한다.
    expect(result[0].wordStarts!.length).toBeGreaterThan(1);
    expect(result[0].wordStarts!.length).toBe(jaWordCount(JA_TEXT));
  });

  it('should attach audioStart = first ja VTT inline token time in the segment window', async () => {
    await writeEpisode({ segments: [JA_SEG], language: 'ja', jaVtt: JA_VTT });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].audioStart).toBeCloseTo(7.01);
  });

  it('should map wordStarts to the exact VTT inline times (issue 실측치)', async () => {
    await writeEpisode({ segments: [JA_SEG], language: 'ja', jaVtt: JA_VTT });
    const ws = (await getEpisodeSegments(VID, BASE))[0].wordStarts!;
    // シェア(첫 단어는 세그먼트 시작에 앵커), する, プラットフォーム, 風.
    const expected = [7.01, 8.87, 12.14, 14.1];
    expect(ws).toHaveLength(expected.length);
    expected.forEach((v, i) => expect(ws[i]).toBeCloseTo(v, 2));
  });

  it('should read subtitle.en.vtt when meta.language is explicitly en', async () => {
    await writeEpisode({
      segments: [
        { id: 's1', start: 0, end: 3, speaker: 'DUBNER', text: 'hello there' },
      ],
      language: 'en',
      enVtt: 'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].wordStarts).toHaveLength(2);
  });

  it('should produce monotonically non-decreasing wordStarts within [start, end)', async () => {
    await writeEpisode({ segments: [JA_SEG], language: 'ja', jaVtt: JA_VTT });
    const ws = (await getEpisodeSegments(VID, BASE))[0].wordStarts!;
    for (let i = 0; i < ws.length; i++) {
      expect(ws[i]).toBeGreaterThanOrEqual(JA_SEG.start);
      expect(ws[i]).toBeLessThan(JA_SEG.end);
      if (i > 0) expect(ws[i]).toBeGreaterThanOrEqual(ws[i - 1]);
    }
  });

  it('should keep en behavior unchanged (reads subtitle.en.vtt) when meta.language is absent', async () => {
    await writeEpisode({
      segments: [
        { id: 's1', start: 0, end: 3, speaker: 'DUBNER', text: 'hello there' },
      ],
      enVtt: 'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].wordStarts).toHaveLength(2);
  });

  it('should skip attach for a ja segment whose window has no VTT tokens', async () => {
    const segs: Segment[] = [
      JA_SEG,
      { id: 'sent-3', start: 100, end: 103, speaker: 'SPEAKER', text: '猫犬' },
    ];
    await writeEpisode({ segments: segs, language: 'ja', jaVtt: JA_VTT });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[1].wordStarts).toBeUndefined();
  });

  it('should skip attach when ja segment text yields zero word tokens', async () => {
    // 구간에 VTT 토큰은 있으나 텍스트가 구두점뿐 → 단어 수 0 → 부착 스킵.
    const punctSeg: Segment = {
      id: 'sent-p',
      start: 7.01,
      end: 15.34,
      speaker: 'SPEAKER',
      text: '。、！',
    };
    await writeEpisode({ segments: [punctSeg], language: 'ja', jaVtt: JA_VTT });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].wordStarts).toBeUndefined();
  });

  it('should fall back (no wordStarts) when subtitle.ja.vtt is missing', async () => {
    await writeEpisode({ segments: [JA_SEG], language: 'ja' });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].wordStarts).toBeUndefined();
  });

  it('should fall back (no wordStarts, no crash) when subtitle.ja.vtt is malformed', async () => {
    await writeEpisode({
      segments: [JA_SEG],
      language: 'ja',
      jaVtt: 'NOT VALID VTT @@@',
    });
    const result = await getEpisodeSegments(VID, BASE);
    expect(result[0].wordStarts).toBeUndefined();
    expect(result[0].text).toBe(JA_TEXT);
  });
});
