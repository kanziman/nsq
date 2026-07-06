import { describe, it, expect } from 'vitest';
import { parseVtt } from './parse';

describe('parseVtt', () => {
  it('should produce word tokens with monotonic times distributed across each cue', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
one two

00:00:02.000 --> 00:00:04.000
three four`;
    const tokens = parseVtt(vtt);
    expect(tokens.map((t) => t.word)).toEqual(['one', 'two', 'three', 'four']);
    expect(tokens[0]).toEqual({ word: 'one', start: 0, end: 1 });
    expect(tokens[1]).toEqual({ word: 'two', start: 1, end: 2 });
    expect(tokens[2]).toEqual({ word: 'three', start: 2, end: 3 });
    expect(tokens[3]).toEqual({ word: 'four', start: 3, end: 4 });
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i].start).toBeGreaterThanOrEqual(tokens[i - 1].start);
      expect(tokens[i].start).toBeLessThan(tokens[i].end);
    }
  });

  it('should dedupe YouTube rolling auto-captions and capture each cue leading word (AC1)', () => {
    const vtt = `WEBVTT
Kind: captions

00:00:00.080 --> 00:00:01.910
do<00:00:00.240><c> I</c><00:00:00.560><c> seem</c>

00:00:01.910 --> 00:00:01.920
do I seem

00:00:01.920 --> 00:00:04.870
do I seem<00:00:02.000><c> like</c>`;
    const tokens = parseVtt(vtt);
    // 선두 단어 "do"(첫 큐 시작 0.08)까지 복구 + 인라인 단어 유지, 발화 단어당 1회.
    // cue3의 선두 "do I seem"은 다중 단어라 미캡처(중복 방지).
    expect(tokens.map((t) => t.word)).toEqual(['do', 'I', 'seem', 'like']);
    expect(tokens[0].start).toBeCloseTo(0.08); // 큐 시작 시각
    expect(tokens[1].start).toBeCloseTo(0.24);
    expect(tokens[2].start).toBeCloseTo(0.56);
    expect(tokens[3].start).toBeCloseTo(2.0);
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i].start).toBeGreaterThan(tokens[i - 1].start);
      expect(tokens[i].end).toBeGreaterThan(tokens[i].start);
    }
  });

  it('should not duplicate a leading word carried over into a later plain line (AC2)', () => {
    const vtt = `WEBVTT
Kind: captions

00:00:05.000 --> 00:00:06.000
hello<00:00:05.200><c> world</c>

00:00:06.000 --> 00:00:06.010
hello world

00:00:06.010 --> 00:00:07.000
hello world<00:00:06.100><c> again</c>`;
    const tokens = parseVtt(vtt);
    // "hello" 선두 단어는 첫 큐에서 1회만. 캐리 라인/다중 단어 선두는 미캡처.
    expect(tokens.map((t) => t.word)).toEqual(['hello', 'world', 'again']);
    expect(tokens.filter((t) => t.word === 'hello')).toHaveLength(1);
    expect(tokens[0].start).toBeCloseTo(5.0);
  });

  it('[경계] should keep the inline word when a cue start collides with an inline timestamp (AC2)', () => {
    const vtt = `WEBVTT
Kind: captions

00:00:05.000 --> 00:00:06.000
alpha<00:00:05.500><c> beta</c>

00:00:05.500 --> 00:00:06.500
gamma<00:00:05.800><c> delta</c>`;
    const tokens = parseVtt(vtt);
    // 두 번째 큐 시작(5.5)이 beta의 인라인 시각(5.5)과 충돌 → 인라인 beta가 보존되고
    // 선두 gamma는 그 슬롯을 덮어쓰지 않는다(유실 방지).
    const at55 = tokens.find((t) => Math.abs(t.start - 5.5) < 1e-6);
    expect(at55?.word).toBe('beta');
    expect(tokens.map((t) => t.word)).toEqual(['alpha', 'beta', 'delta']);
  });

  it('[경계] should skip a cue whose active line starts with a tag (empty leading)', () => {
    const vtt = `WEBVTT
Kind: captions

00:00:01.000 --> 00:00:02.000
<00:00:01.200><c>word</c>`;
    const tokens = parseVtt(vtt);
    // 선두 텍스트가 비어 있으면 빈 토큰을 만들지 않는다.
    expect(tokens.map((t) => t.word)).toEqual(['word']);
  });

  it('[경계] standard manual VTT (no inline timings) should be unaffected by leading-word logic (AC3)', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
hello there`;
    const tokens = parseVtt(vtt);
    // 표준 경로(균등분배) 그대로: 큐를 단어 수로 균등 분배.
    expect(tokens.map((t) => t.word)).toEqual(['hello', 'there']);
    expect(tokens[0].start).toBeCloseTo(0);
    expect(tokens[1].start).toBeCloseTo(1);
  });
});
