// @vitest-environment jsdom
/**
 * #128: SegmentText 루비(<ruby><rt>) 렌더 — 단어 하이라이트·사전 클릭과 공존.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SegmentText } from './SegmentText';
import type { RubyToken, Segment } from '@/lib/types';

const TEXT = '今日はいい天気ですね。';
// join === TEXT (검증 통과 픽스처)
const RUBY: RubyToken[] = [
  { text: '今日', rt: 'きょう' },
  { text: 'はいい' },
  { text: '天気', rt: 'てんき' },
  { text: 'ですね。' },
];

function jaSeg(ruby?: RubyToken[]): Segment {
  return {
    id: 'cue-1',
    start: 0,
    end: 4,
    speaker: 'SPEAKER',
    text: TEXT,
    ruby,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SegmentText (ruby)', () => {
  // [정상] AC1: 한자 조각 위 rt, 가나 조각엔 rt 없음
  it('should render rt over kanji pieces and none over kana when ruby present', () => {
    const { container } = render(
      <SegmentText segment={jaSeg(RUBY)} language="ja" />,
    );
    const rts = [...container.querySelectorAll('rt')].map(
      (el) => el.textContent,
    );
    expect(rts).toEqual(['きょう', 'てんき']);
    // 원문 텍스트는 루비 포함 전체가 보존된다(ruby 요소의 base 텍스트).
    expect(container.querySelectorAll('ruby')).toHaveLength(2);
    // 가나 구간은 ruby 요소 밖 평문
    expect(container.querySelector('p')?.textContent).toContain('はいい');
  });

  // [정상] AC2: showRuby=false → 루비 무시(원문만)
  it('should ignore ruby when showRuby is false', () => {
    const { container } = render(
      <SegmentText segment={jaSeg(RUBY)} language="ja" showRuby={false} />,
    );
    expect(container.querySelectorAll('rt')).toHaveLength(0);
    expect(container.querySelector('p')?.textContent).toBe(TEXT);
  });

  // [정상] 공존: 루비가 있어도 하이라이트 1개·사전 클릭 동작 유지
  it('should keep word highlight and dictionary click working with ruby present', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <SegmentText
        segment={jaSeg(RUBY)}
        language="ja"
        highlightWords
        currentTime={2}
      />,
    );
    expect(container.querySelectorAll('[data-current-word]')).toHaveLength(1);
    const word = container.querySelector('[data-word]') as HTMLElement;
    fireEvent.click(word);
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toContain('ja.dict.naver.com');
  });

  // [경계] AC3: join 불일치 루비 → 크래시 없이 원문 폴백(rt 없음)
  it('should fall back to plain text without crashing when ruby join mismatches', () => {
    const invalid: RubyToken[] = [{ text: '今日', rt: 'きょう' }];
    const { container } = render(
      <SegmentText segment={jaSeg(invalid)} language="ja" />,
    );
    expect(container.querySelectorAll('rt')).toHaveLength(0);
    expect(container.querySelector('p')?.textContent).toBe(TEXT);
  });
});
