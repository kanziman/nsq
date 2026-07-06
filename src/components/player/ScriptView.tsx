'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { Segment } from '@/lib/types';
import { SPEAKER_COLORS, type SpeakerKey } from '@/lib/constants/speakers';
import { formatTime } from '@/lib/utils/time';
import { SegmentText } from './SegmentText';
import { Languages } from 'lucide-react';

interface ScriptViewProps {
  segments: Segment[];
  currentSegmentIndex?: number;
  currentTime?: number;
  selection?: { start: number; end: number } | null;
  onSegmentClick?: (index: number, shiftKey: boolean) => void;
  dimmedSpeakers?: SpeakerKey[];
}

function ScriptView({
  segments,
  currentSegmentIndex,
  currentTime,
  selection,
  onSegmentClick,
  dimmedSpeakers,
}: ScriptViewProps): React.ReactElement {
  const activeRef = useRef<HTMLDivElement | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const hasTranslation = segments.some((s) => s.translation);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentSegmentIndex]);

  const toggleRevealed = (i: number): void => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {hasTranslation ? (
        <button
          type="button"
          aria-label="번역 전체 토글"
          aria-pressed={revealAll}
          onClick={() => {
            // 전체 토글은 개별 reveal 상태를 초기화하여 일괄 표시/숨김을 보장 (AC3)
            setRevealed(new Set());
            setRevealAll((v) => !v);
          }}
          className="text-xs text-muted underline"
        >
          번역 {revealAll ? '숨기기' : '보기'}
        </button>
      ) : null}
      {segments.map((seg, i) => {
        const sp = SPEAKER_COLORS[seg.speaker];
        const active = i === currentSegmentIndex;
        const selected =
          !!selection && i >= selection.start && i <= selection.end;
        const dimmed = !!dimmedSpeakers?.includes(seg.speaker);

        const opacityClass = dimmed
          ? 'opacity-40'
          : active
            ? 'opacity-100'
            : 'opacity-45 hover:opacity-100';

        const bgBorderClass = active
          ? `${sp.bgClass} ${sp.borderClass}`
          : 'border-hairline bg-transparent hover:bg-surface-soft/40 hover:border-hairline-strong';

        return (
          <div
            key={seg.id}
            ref={active ? activeRef : null}
            data-active={active || undefined}
            data-selected={selected || undefined}
            data-dimmed={dimmed || undefined}
            onClick={
              onSegmentClick ? (e) => onSegmentClick(i, e.shiftKey) : undefined
            }
            className={[
              'rounded-[--radius-md] border p-[16px] transition-all duration-300',
              bgBorderClass,
              opacityClass,
              selected ? 'ring-2 ring-primary/40' : '',
              onSegmentClick ? 'cursor-pointer' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="mb-[4px] flex items-center gap-[12px]">
              <span
                className={`text-[12px] font-medium px-[12px] py-[4px] rounded-full ${sp.bgClass} ${sp.textClass}`}
              >
                {sp.name}
              </span>
              <span
                className={`font-mono text-xs transition-colors duration-300 ${active ? sp.textClass + ' opacity-80' : 'text-muted-soft'}`}
              >
                {formatTime(seg.start)}
              </span>
            </div>
            <SegmentText
              segment={seg}
              highlightWords={active}
              currentTime={currentTime}
              className="text-[16px] text-body leading-[1.55]"
            />
            {seg.translation
              ? (() => {
                  const blurred = !(revealAll || revealed.has(i));
                  return (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRevealed(i);
                      }}
                      className="mt-[6px] flex items-start gap-1.5 cursor-pointer group/translation"
                    >
                      {blurred && (
                        <Languages
                          className="h-3.5 w-3.5 text-muted-soft/60 mt-[3px] flex-shrink-0 group-hover/translation:text-primary transition-colors"
                          strokeWidth={1.5}
                        />
                      )}
                      <p
                        data-translation
                        data-blurred={blurred || undefined}
                        className={[
                          'text-sm leading-[1.55] text-muted-soft transition-all duration-300',
                          blurred
                            ? 'blur-sm hover:blur-none group-hover/translation:blur-none text-muted-soft/40'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {seg.translation}
                      </p>
                    </div>
                  );
                })()
              : null}
          </div>
        );
      })}
    </div>
  );
}

export default memo(ScriptView);
