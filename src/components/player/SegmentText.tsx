import { Fragment, useMemo } from 'react';
import type { LanguageCode, Segment } from '@/lib/types';
import {
  splitWords,
  findCurrentWordIndex,
  currentWordIndexFromStarts,
} from '@/lib/utils/words';
import {
  tokenizeJa,
  naverJaDictUrl,
  composeRuby,
  type ComposedWord,
} from '@/lib/utils/tokenize';
import { RubyText } from './RubyText';

interface SegmentTextProps {
  segment: Segment;
  /** true이고 currentTime이 주어지면 공식 텍스트의 현재 단어를 강조한다. */
  highlightWords?: boolean;
  currentTime?: number;
  className?: string;
  /** 에피소드 언어(#127). 'ja'면 Intl.Segmenter 토큰 렌더 + 단어 사전 링크. 기본 'en'. */
  language?: LanguageCode;
  /** 후리가나 표시(#128). false면 segment.ruby를 무시한다. 기본 true. */
  showRuby?: boolean;
}

// ja 단어 토큰 스팬. 클릭 시 네이버 일본어사전 새 탭(세그먼트 클릭 탐색과 분리).
// 루비 조각(#128)은 스팬 내부에서 <ruby><rt>로 렌더된다.
function JaWordSpan({
  word,
  current,
}: {
  word: ComposedWord;
  current: boolean;
}): React.ReactElement {
  return (
    <span
      data-word
      data-current-word={current || undefined}
      className={[
        current ? 'rounded bg-primary/15 text-primary' : '',
        'cursor-pointer hover:text-primary hover:underline decoration-dotted underline-offset-4',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        window.open(naverJaDictUrl(word.word), '_blank', 'noopener,noreferrer');
      }}
    >
      <RubyText pieces={word.pieces} />
    </span>
  );
}

/**
 * 세그먼트 텍스트 렌더러. 항상 공식 대본 텍스트(segment.text)를 표시하며, 강조 대상이고
 * currentTime이 있으면 텍스트를 단어로 분해해 [start, end) 균등 분포로 현재 단어를 강조한다.
 * (VTT 자동 캡션 단어는 대본과 불일치하므로 표시에 쓰지 않는다.)
 * ja는 Intl.Segmenter 토큰으로 분해해 공백 삽입 없이 렌더하고, 단어 토큰은 사전 링크가 된다.
 */
export function SegmentText({
  segment,
  highlightWords,
  currentTime,
  className,
  language = 'en',
  showRuby = true,
}: SegmentTextProps): React.ReactElement {
  // ja 토큰 분해·루비 병합은 세그먼트 단위 메모(재생 틱마다 재분해 금지 — spec-fixed §8).
  const composed = useMemo(
    () =>
      language === 'ja'
        ? composeRuby(
            tokenizeJa(segment.text),
            showRuby ? segment.ruby : undefined,
            segment.text,
          )
        : null,
    [language, segment.text, segment.ruby, showRuby],
  );

  if (composed) {
    // 단어 서수 목록(하이라이트는 단어 수 기준 균등분할 — B9, wordStarts 없음 전제).
    const wordOrdinalByIndex = new Map<number, number>();
    composed.forEach((w, i) => {
      if (w.isWord) wordOrdinalByIndex.set(i, wordOrdinalByIndex.size);
    });
    const currentOrdinal =
      highlightWords && currentTime != null && wordOrdinalByIndex.size > 0
        ? findCurrentWordIndex(
            wordOrdinalByIndex.size,
            segment.start,
            segment.end,
            currentTime,
          )
        : -1;

    return (
      <p className={className}>
        {composed.map((word, i) =>
          word.isWord ? (
            <JaWordSpan
              key={i}
              word={word}
              current={wordOrdinalByIndex.get(i) === currentOrdinal}
            />
          ) : (
            <Fragment key={i}>
              <RubyText pieces={word.pieces} />
            </Fragment>
          ),
        )}
      </p>
    );
  }

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
