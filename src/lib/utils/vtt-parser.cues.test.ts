import { describe, it, expect } from 'vitest';
import { parseVttCues } from './vtt-parser';

// 수동 자막(태그 없음, 큐당 완결 텍스트)
const MANUAL_VTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:03.000 --> 00:00:05.000
Second <i>cue</i> line
`;

// YouTube 자동자막(롤링): 이월 라인(태그 없음) + 활성 라인(인라인 태그).
// ja는 공백 없는 텍스트 — 태그 제거 시 공백이 삽입되면 안 된다.
// 타이밍 라인 다음의 ' '(공백 1칸) 라인은 실제 YouTube 자동자막 형식 그대로다.
const ROLLING_JA_VTT = `WEBVTT
Kind: captions
Language: ja

00:00:00.000 --> 00:00:02.000 align:start position:0%
 
こんにちは<00:00:00.500><c>皆さん</c>

00:00:02.000 --> 00:00:04.000 align:start position:0%
こんにちは皆さん
今日は<00:00:02.500><c>いい</c><00:00:03.000><c>天気</c>

00:00:04.000 --> 00:00:06.000 align:start position:0%
今日はいい天気

`;

const EMPTY_CUE_VTT = `WEBVTT

00:00:01.000 --> 00:00:02.000


00:00:02.000 --> 00:00:03.000
Real text
`;

const MALFORMED_VTT = `WEBVTT

garbage --> nonsense
Broken block

00:00:05.000 --> 00:00:06.000
Good cue
`;

describe('parseVttCues', () => {
  // [정상] 수동 VTT: 초 단위 타이밍 + 태그 제거 텍스트
  it('should return cues with start/end seconds and tag-free text when given manual VTT', () => {
    const cues = parseVttCues(MANUAL_VTT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 1, end: 3, text: 'Hello world' });
    expect(cues[1].start).toBe(3);
    expect(cues[1].end).toBe(5);
    expect(cues[1].text).toBe('Second cue line');
  });

  // [정상] 롤링 자동자막: 활성 라인만 취하고 이월 텍스트 중복 제거
  it('should keep only active lines and dedupe carried-over text when given YouTube rolling auto captions', () => {
    const cues = parseVttCues(ROLLING_JA_VTT);
    expect(cues.map((c) => c.text)).toEqual([
      'こんにちは皆さん',
      '今日はいい天気',
    ]);
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(2);
    expect(cues[1].start).toBe(2);
    expect(cues[1].end).toBe(4);
  });

  // [정상] ja 무공백 보존: 인라인 태그 제거 시 공백 삽입 금지
  it('should preserve no-space text when removing inline tags from ja auto captions', () => {
    const cues = parseVttCues(ROLLING_JA_VTT);
    expect(cues[1].text).toBe('今日はいい天気');
    expect(cues[1].text).not.toMatch(/\s/);
  });

  // [경계] 텍스트 없는 큐 스킵
  it('should skip cues with empty text when blocks contain timing but no content', () => {
    const cues = parseVttCues(EMPTY_CUE_VTT);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Real text');
  });

  // [경계] 타이밍 블록 없음 → 빈 배열
  it('should return empty array when vtt has no timing blocks', () => {
    expect(parseVttCues('WEBVTT\n\nKind: captions\n')).toEqual([]);
  });

  // [예외] malformed 블록은 스킵하고 throw하지 않음
  it('should skip malformed blocks without throwing when timing line is corrupt', () => {
    const cues = parseVttCues(MALFORMED_VTT);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toEqual({ start: 5, end: 6, text: 'Good cue' });
  });
});
