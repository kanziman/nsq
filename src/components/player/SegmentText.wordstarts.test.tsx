// @vitest-environment jsdom
/**
 * #137: SegmentText ja 하이라이트가 균등분할 대신 segment.wordStarts(실측 발화 시각)를
 * 우선 사용하는지 검증한다. wordStarts 부재/길이 불일치 시 균등분할 폴백(B9) 유지.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SegmentText } from './SegmentText';
import { tokenizeJa } from '@/lib/utils/tokenize';
import type { Segment } from '@/lib/types';

const JA_TEXT = 'シェアするプラットフォーム風';
const JA_SEG: Segment = {
  id: 'sent-2',
  start: 0,
  end: 10,
  speaker: 'SPEAKER',
  text: JA_TEXT,
};

function wordCount(text: string): number {
  return tokenizeJa(text).filter((t) => t.isWord).length;
}

// 현재 강조된 [data-word] 토큰의 인덱스(단어 토큰 목록 기준). 없으면 -1.
function currentWordIndex(container: HTMLElement): number {
  const words = [...container.querySelectorAll('[data-word]')];
  return words.findIndex((el) => el.hasAttribute('data-current-word'));
}

afterEach(cleanup);

describe('SegmentText (#137 ja wordStarts highlight)', () => {
  it('should highlight ja word by wordStarts (actual utterance time), not uniform split', () => {
    const n = wordCount(JA_TEXT);
    // 모든 단어를 앞쪽(0.1초 간격)에 몰아 배치 → 작은 t에서도 마지막 단어가 이미 강조.
    const wordStarts = Array.from({ length: n }, (_, i) => i * 0.1);
    const t = (n - 1) * 0.1 + 0.01; // 마지막 단어 시작 직후(≈ 0.x초, 세그먼트 초반)
    const { container } = render(
      <SegmentText
        segment={{ ...JA_SEG, wordStarts }}
        language="ja"
        highlightWords
        currentTime={t}
      />,
    );
    // 실측 기준이면 마지막 단어가 강조된다.
    expect(currentWordIndex(container)).toBe(n - 1);
  });

  it('should differ from uniform split at the same currentTime (proves wordStarts drives it)', () => {
    const n = wordCount(JA_TEXT);
    const wordStarts = Array.from({ length: n }, (_, i) => i * 0.1);
    const t = (n - 1) * 0.1 + 0.01;
    // 균등분할(폴백)이면 dur=10에서 t≈0.x초는 첫 단어(index 0) 근처.
    const uniform = render(
      <SegmentText
        segment={JA_SEG}
        language="ja"
        highlightWords
        currentTime={t}
      />,
    );
    const uniformIdx = currentWordIndex(uniform.container);
    cleanup();
    const withStarts = render(
      <SegmentText
        segment={{ ...JA_SEG, wordStarts }}
        language="ja"
        highlightWords
        currentTime={t}
      />,
    );
    const startsIdx = currentWordIndex(withStarts.container);
    expect(startsIdx).toBeGreaterThan(uniformIdx);
  });

  it('should fall back to uniform-split ja highlight when wordStarts is absent', () => {
    const { container } = render(
      <SegmentText
        segment={JA_SEG}
        language="ja"
        highlightWords
        currentTime={0.1}
      />,
    );
    // 세그먼트 초반이므로 첫 단어가 강조(균등분할).
    expect(currentWordIndex(container)).toBe(0);
  });

  it('should fall back to uniform-split when wordStarts length !== ja word-token count', () => {
    const n = wordCount(JA_TEXT);
    // 길이가 토큰 수와 다른(작은) wordStarts → 신뢰 불가 → 균등분할 폴백.
    const badStarts = Array.from({ length: n - 1 }, (_, i) => i * 0.1);
    const { container } = render(
      <SegmentText
        segment={{ ...JA_SEG, wordStarts: badStarts }}
        language="ja"
        highlightWords
        currentTime={0.1}
      />,
    );
    expect(currentWordIndex(container)).toBe(0);
  });
});
