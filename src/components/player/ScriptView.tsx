'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { Segment } from '@/lib/types';
import { SPEAKER_COLORS, type SpeakerKey } from '@/lib/constants/speakers';
import { formatTime } from '@/lib/utils/time';

interface ScriptViewProps {
  segments: Segment[];
  currentSegmentIndex?: number;
  selection?: { start: number; end: number } | null;
  onSegmentClick?: (index: number, shiftKey: boolean) => void;
  dimmedSpeakers?: SpeakerKey[];
}

function ScriptView({
  segments,
  currentSegmentIndex,
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
        return (
          <div
            key={seg.id}
            ref={active ? activeRef : undefined}
            data-active={active || undefined}
            data-selected={selected || undefined}
            data-dimmed={dimmed || undefined}
            onClick={
              onSegmentClick ? (e) => onSegmentClick(i, e.shiftKey) : undefined
            }
            className={[
              'rounded-md border p-4 transition-colors',
              active
                ? `${sp.bgClass} ${sp.borderClass}`
                : 'border-hairline bg-transparent',
              selected ? 'ring-2 ring-primary/40' : '',
              dimmed ? 'opacity-40' : '',
              onSegmentClick ? 'cursor-pointer hover:bg-surface-card' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="mb-1 flex items-center gap-3">
              <span className={`text-sm font-medium ${sp.textClass}`}>
                {sp.name}
              </span>
              <span className="font-mono text-xs text-muted-soft">
                {formatTime(seg.start)}
              </span>
            </div>
            <p className="text-body leading-relaxed">{seg.text}</p>
            {seg.translation
              ? (() => {
                  const blurred = !(revealAll || revealed.has(i));
                  return (
                    <p
                      data-translation
                      data-blurred={blurred || undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRevealed(i);
                      }}
                      className={[
                        'mt-1 cursor-pointer text-sm text-muted transition',
                        blurred ? 'blur-sm hover:blur-none' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {seg.translation}
                    </p>
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
