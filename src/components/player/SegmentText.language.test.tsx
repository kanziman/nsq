// @vitest-environment jsdom
/**
 * #127: SegmentText ja 토큰 렌더·현재 단어 하이라이트·사전 링크.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SegmentText } from './SegmentText';
import ScriptView from './ScriptView';
import FocusPanel from './FocusPanel';
import type { Segment } from '@/lib/types';

const JA_SEG: Segment = {
  id: 'cue-1',
  start: 0,
  end: 4,
  speaker: 'SPEAKER',
  text: '今日はいい天気ですね。',
};

const EN_SEG: Segment = {
  id: 's1',
  start: 0,
  end: 2,
  speaker: 'DUBNER',
  text: 'Hello there friend',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SegmentText (language ja)', () => {
  // [정상] 공백 삽입 없이 원문 그대로 토큰 렌더
  it("should render ja tokens without inserting spaces when language is 'ja'", () => {
    const { container } = render(
      <SegmentText segment={JA_SEG} language="ja" />,
    );
    expect(container.querySelector('p')?.textContent).toBe(JA_SEG.text);
    // 클릭 가능한 단어 토큰이 2개 이상 존재
    expect(container.querySelectorAll('[data-word]').length).toBeGreaterThan(1);
  });

  // [정상] 재생 진행 시 현재 단어 토큰만 강조
  it('should highlight exactly one current word token when active and currentTime advances', () => {
    const { container } = render(
      <SegmentText
        segment={JA_SEG}
        language="ja"
        highlightWords
        currentTime={2}
      />,
    );
    const current = container.querySelectorAll('[data-current-word]');
    expect(current).toHaveLength(1);
    // 문장 전체가 아닌 부분 토큰이어야 한다
    expect(current[0].textContent!.length).toBeLessThan(JA_SEG.text.length);
  });

  // [정상] 단어 클릭 → 네이버 일본어사전 새 탭
  it('should open naver ja dictionary in a new tab when a word token is clicked', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <SegmentText segment={JA_SEG} language="ja" />,
    );
    const word = container.querySelector('[data-word]') as HTMLElement;
    fireEvent.click(word);
    expect(open).toHaveBeenCalledTimes(1);
    const [url, target] = open.mock.calls[0];
    expect(String(url)).toContain('ja.dict.naver.com');
    expect(String(url)).toContain(encodeURIComponent(word.textContent ?? ''));
    expect(target).toBe('_blank');
  });

  // [정상] 단어 클릭이 세그먼트 클릭(탐색)으로 전파되지 않음
  it('should stop click propagation so segment click is not triggered', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const onOuter = vi.fn();
    const { container } = render(
      <div onClick={onOuter}>
        <SegmentText segment={JA_SEG} language="ja" />
      </div>,
    );
    fireEvent.click(container.querySelector('[data-word]') as HTMLElement);
    expect(onOuter).not.toHaveBeenCalled();
  });

  // [경계] currentTime 없어도 단어는 클릭 가능(하이라이트만 없음)
  it('should keep word tokens clickable without highlight when currentTime is undefined', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <SegmentText segment={JA_SEG} language="ja" highlightWords />,
    );
    expect(container.querySelector('[data-current-word]')).toBeNull();
    fireEvent.click(container.querySelector('[data-word]') as HTMLElement);
    expect(open).toHaveBeenCalledTimes(1);
  });

  // [정상] 재생 틱 진행에 따라 하이라이트 토큰이 순차 전진(단조 증가)
  it('should advance the highlighted token monotonically as currentTime progresses', () => {
    const { container, rerender } = render(
      <SegmentText
        segment={JA_SEG}
        language="ja"
        highlightWords
        currentTime={0}
      />,
    );
    const wordTexts = [...container.querySelectorAll('[data-word]')].map(
      (el) => el.textContent,
    );
    const seen: number[] = [];
    for (const t of [0, 1, 2, 3.9]) {
      rerender(
        <SegmentText
          segment={JA_SEG}
          language="ja"
          highlightWords
          currentTime={t}
        />,
      );
      const current = container.querySelectorAll('[data-current-word]');
      expect(current).toHaveLength(1);
      seen.push(wordTexts.indexOf(current[0].textContent));
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
    expect(seen[seen.length - 1]).toBeGreaterThan(seen[0]);
  });

  // [경계] 단어 토큰이 0개(구두점뿐)여도 크래시 없이 렌더
  it('should render without crashing when ja text has no word tokens', () => {
    const punctOnly: Segment = { ...JA_SEG, text: '。、！' };
    const { container } = render(
      <SegmentText
        segment={punctOnly}
        language="ja"
        highlightWords
        currentTime={1}
      />,
    );
    expect(container.querySelector('p')?.textContent).toBe('。、！');
    expect(container.querySelector('[data-current-word]')).toBeNull();
  });

  // [정상] en은 기존 공백 분해·비클릭 동작 유지(회귀)
  it('should keep whitespace-based en behavior unchanged', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <SegmentText segment={EN_SEG} highlightWords currentTime={1} />,
    );
    expect(container.querySelectorAll('[data-word]')).toHaveLength(0);
    const current = container.querySelectorAll('[data-current-word]');
    expect(current).toHaveLength(1);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('ScriptView (language forward)', () => {
  // [정상] ScriptView가 language를 SegmentText로 전달해 ja 단어 클릭이 동작
  it('should forward language to SegmentText so ja words are clickable', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <ScriptView segments={[JA_SEG]} language="ja" />,
    );
    fireEvent.click(container.querySelector('[data-word]') as HTMLElement);
    expect(open).toHaveBeenCalledTimes(1);
  });

  // [정상] 단어 클릭은 세그먼트 클릭(onSegmentClick 탐색/선택)으로 새지 않는다
  it('should not trigger onSegmentClick when a ja word is clicked in ScriptView', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onSegmentClick = vi.fn();
    const { container } = render(
      <ScriptView
        segments={[JA_SEG]}
        language="ja"
        onSegmentClick={onSegmentClick}
      />,
    );
    fireEvent.click(container.querySelector('[data-word]') as HTMLElement);
    expect(open).toHaveBeenCalledTimes(1);
    expect(onSegmentClick).not.toHaveBeenCalled();
  });
});

describe('FocusPanel (language forward)', () => {
  // [정상] 집중 모드 경로에서도 ja 단어 클릭 → 사전 새 탭
  it('should render clickable ja word tokens in focus mode', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <FocusPanel
        segment={JA_SEG}
        onReplay={() => {}}
        currentTime={1}
        language="ja"
      />,
    );
    const word = container.querySelector('[data-word]') as HTMLElement;
    expect(word).not.toBeNull();
    fireEvent.click(word);
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toContain('ja.dict.naver.com');
  });
});
