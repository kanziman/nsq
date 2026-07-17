/**
 * #139 통합: getEpisodeSegments가 VTT 토큰 표면형까지 넘겨 앵커 정렬(computeWordStartsAligned)로
 * ja 세그먼트 wordStarts를 붙이는지 검증. 잉여/오인식 토큰이 있어도 앵커 단어는 실측 시각에 고정.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getEpisodeSegments } from './episodes';
import type { Segment, EpisodeMeta, LanguageCode } from '../types';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-ja139-vid';

function dir(): string {
  return path.join(BASE, VID);
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
      title: 'JA align',
      duration: 60,
      youtubeUrl: `https://youtu.be/${VID}`,
      addedAt: new Date().toISOString(),
      language: opts.language,
    };
    await fs.writeFile(path.join(dir(), 'meta.json'), JSON.stringify(meta));
  }
  if (opts.jaVtt)
    await fs.writeFile(path.join(dir(), 'subtitle.ja.vtt'), opts.jaVtt);
  if (opts.enVtt)
    await fs.writeFile(path.join(dir(), 'subtitle.en.vtt'), opts.enVtt);
}

// tokenizeJa('シェアするプラットフォーム風') === [シェア, する, プラットフォーム, 風].
// VTT에 잉여 오인식 토큰 ゴミ@8.0을 넣어 토큰 수(5) != 단어 수(4)로 만든다.
// 위치-비례라면 プラットフォーム가 8.87s로 밀리지만, 앵커 정렬이면 실측 12.14s.
const JA_TEXT = 'シェアするプラットフォーム風';
const JA_VTT_WITH_GARBAGE =
  'WEBVTT\n\n' +
  '00:00:07.010 --> 00:00:15.340\n' +
  'シェア<00:00:08.000><c>ゴミ</c>' +
  '<00:00:08.870><c>する</c>' +
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

describe('getEpisodeSegments (#139 anchor alignment)', () => {
  it('should anchor プラットフォーム to its exact VTT time despite an extra garbage token', async () => {
    await writeEpisode({
      segments: [JA_SEG],
      language: 'ja',
      jaVtt: JA_VTT_WITH_GARBAGE,
    });
    const [seg] = await getEpisodeSegments(VID, BASE);
    expect(seg.wordStarts).toBeDefined();
    // 단어 순서: シェア(0) する(1) プラットフォーム(2) 風(3).
    expect(seg.wordStarts![2]).toBeCloseTo(12.14, 2);
    expect(seg.wordStarts![3]).toBeCloseTo(14.1, 2);
  });

  it('should keep en episodes unchanged when transcript exactly matches subtitle.en.vtt', async () => {
    await writeEpisode({
      segments: [
        { id: 's1', start: 0, end: 3, speaker: 'DUBNER', text: 'hello there' },
      ],
      enVtt: 'WEBVTT\n\n00:00.000 --> 00:03.000\nhello there\n',
    });
    const [seg] = await getEpisodeSegments(VID, BASE);
    expect(seg.wordStarts).toHaveLength(2);
    expect(seg.wordStarts![0]).toBeGreaterThanOrEqual(0);
    expect(seg.wordStarts![1]).toBeGreaterThan(seg.wordStarts![0]);
  });

  it('should reduce katakana drift vs positional for a sent-14-style segment (real bug class)', async () => {
    // sent-14 구조 축약: 앞뒤 한자/히라가나는 ASR이 정확(앵커), 가타카나 나열은 오인식.
    // 대본: 今日 は カタカナ を 見る (5 단어 가정, tokenizeJa 실제 분해에 의존).
    // 진실: 今日@0.5, は@1.0, カタカナ@1.5, を@2.5, 見る@3.0. ASR은 カタカナ만 오인식+잉여.
    const text = '今日はカタカナを見る';
    const seg: Segment = {
      id: 'sent-x',
      start: 0.5,
      end: 4.0,
      speaker: 'SPEAKER',
      text,
    };
    // VTT: 今日(cue 선두)@0.5, は@1.0, 오인식 'ゴ'@1.3, 잉여 'ミ'@1.8, を@2.5, 見る@3.0.
    // 위치-비례라면 を/見る가 앞 토큰 시각으로 밀리지만, 앵커 정렬은 실측에 고정.
    const vtt =
      'WEBVTT\n\n' +
      '00:00:00.500 --> 00:00:04.000\n' +
      '今日<00:00:01.000><c>は</c>' +
      '<00:00:01.300><c>ゴ</c>' +
      '<00:00:01.800><c>ミ</c>' +
      '<00:00:02.500><c>を</c>' +
      '<00:00:03.000><c>見る</c>\n';
    await writeEpisode({ segments: [seg], language: 'ja', jaVtt: vtt });
    const [out] = await getEpisodeSegments(VID, BASE);
    expect(out.wordStarts).toBeDefined();
    // を/見る가 각자의 실측 시각(2.5/3.0)에 가깝게 앵커링되어, 앞으로 밀리지 않는다.
    const ws = out.wordStarts!;
    expect(ws[ws.length - 1]).toBeGreaterThanOrEqual(2.5); // 見る는 최소 2.5s 이후
  });

  it('should still attach (positional fallback) when window tokens do not surface-match the transcript', async () => {
    // VTT 토큰이 대본과 전혀 일치 안 함(앵커 0) → 위치-비례 폴백이지만 여전히 부착된다.
    await writeEpisode({
      segments: [JA_SEG],
      language: 'ja',
      jaVtt:
        'WEBVTT\n\n00:00:07.010 --> 00:00:15.340\nアア<00:00:10.000><c>イイ</c><00:00:13.000><c>ウウ</c>\n',
    });
    const [seg] = await getEpisodeSegments(VID, BASE);
    expect(seg.wordStarts).toBeDefined();
    expect(seg.wordStarts!.length).toBeGreaterThan(0);
  });
});
