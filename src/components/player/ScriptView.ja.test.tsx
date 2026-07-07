// @vitest-environment jsdom
/**
 * #124 AC2: 자막 전용(ja) 큐 세그먼트 — 단일 화자 'SPEAKER', wordStarts/audioStart 부재,
 * 무공백 텍스트 조합을 기존 표시 계층이 크래시 없이 소화하는지 직접 검증.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ScriptView from './ScriptView';
import { SegmentText } from './SegmentText';
import { SUBTITLE_ONLY_SPEAKER } from '@/lib/services/import/cue-segments';
import type { Segment } from '@/lib/types';

const JA_SEGMENTS: Segment[] = [
  {
    id: 'cue-1',
    start: 0,
    end: 2,
    speaker: SUBTITLE_ONLY_SPEAKER,
    text: 'こんにちは皆さん',
  },
  {
    id: 'cue-2',
    start: 2,
    end: 4,
    speaker: SUBTITLE_ONLY_SPEAKER,
    text: '今日はいい天気',
  },
];

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe('ScriptView (subtitle-only ja cue segments)', () => {
  // [정상] 미등록 화자 'SPEAKER' + 무공백 ja 텍스트를 크래시 없이 렌더
  it("should render cue segments with speaker 'SPEAKER' and no-space ja text without crashing", () => {
    expect(() => render(<ScriptView segments={JA_SEGMENTS} />)).not.toThrow();
    expect(screen.getByText('こんにちは皆さん')).toBeInTheDocument();
    expect(screen.getByText('今日はいい天気')).toBeInTheDocument();
  });
});

describe('SegmentText (ja fallback, no wordStarts)', () => {
  // [경계] wordStarts 부재 + 무공백 텍스트 → 단일 토큰 균등분할 폴백(세그먼트 전체 강조)
  it('should fall back to a single highlighted token when text has no spaces and no wordStarts', () => {
    const { container } = render(
      <SegmentText segment={JA_SEGMENTS[0]} highlightWords currentTime={1} />,
    );
    const current = container.querySelectorAll('[data-current-word]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('こんにちは皆さん');
  });
});
