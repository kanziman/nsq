import { Fragment } from 'react';
import type { Segment } from '@/lib/types';
import { findCurrentWordIndex } from '@/lib/utils/words';

interface SegmentTextProps {
  segment: Segment;
  /** true이고 words가 있으면 현재 단어를 개별 강조한다. */
  highlightWords?: boolean;
  currentTime?: number;
  className?: string;
}

/**
 * 세그먼트 텍스트 렌더러. words 타이밍이 있고 강조 대상이면 단어별 span으로 그려
 * 현재 단어를 강조하고, 아니면 plain text로 폴백한다.
 */
export function SegmentText({
  segment,
  highlightWords,
  currentTime,
  className,
}: SegmentTextProps): React.ReactElement {
  const words = segment.words;
  if (!highlightWords || !words || words.length === 0) {
    return <p className={className}>{segment.text}</p>;
  }

  const currentIdx = findCurrentWordIndex(words, currentTime ?? -1);
  return (
    <p className={className}>
      {words.map((w, j) => {
        const current = j === currentIdx;
        return (
          <Fragment key={`${w.start}-${j}`}>
            <span
              data-current-word={current || undefined}
              className={current ? 'rounded bg-primary/15 text-primary' : ''}
            >
              {w.word}
            </span>
            {j < words.length - 1 ? ' ' : ''}
          </Fragment>
        );
      })}
    </p>
  );
}
