import { Fragment } from 'react';
import type { Segment } from '@/lib/types';
import {
  splitWords,
  findCurrentWordIndex,
  currentWordIndexFromStarts,
} from '@/lib/utils/words';

interface SegmentTextProps {
  segment: Segment;
  /** true이고 currentTime이 주어지면 공식 텍스트의 현재 단어를 강조한다. */
  highlightWords?: boolean;
  currentTime?: number;
  className?: string;
}

/**
 * 세그먼트 텍스트 렌더러. 항상 공식 대본 텍스트(segment.text)를 표시하며, 강조 대상이고
 * currentTime이 있으면 텍스트를 단어로 분해해 [start, end) 균등 분포로 현재 단어를 강조한다.
 * (VTT 자동 캡션 단어는 대본과 불일치하므로 표시에 쓰지 않는다.)
 */
export function SegmentText({
  segment,
  highlightWords,
  currentTime,
  className,
}: SegmentTextProps): React.ReactElement {
  const words = splitWords(segment.text);
  if (!highlightWords || currentTime == null || words.length === 0) {
    return <p className={className}>{segment.text}</p>;
  }

  // wordStarts(실제 VTT 발화 시각)가 있으면 그것으로, 없으면 균등분할로 현재 단어 판정.
  const currentIdx =
    segment.wordStarts && segment.wordStarts.length === words.length
      ? currentWordIndexFromStarts(segment.wordStarts, currentTime)
      : findCurrentWordIndex(
          words.length,
          segment.start,
          segment.end,
          currentTime,
        );
  return (
    <p className={className}>
      {words.map((w, j) => {
        const current = j === currentIdx;
        return (
          <Fragment key={j}>
            <span
              data-current-word={current || undefined}
              className={current ? 'rounded bg-primary/15 text-primary' : ''}
            >
              {w}
            </span>
            {j < words.length - 1 ? ' ' : ''}
          </Fragment>
        );
      })}
    </p>
  );
}
