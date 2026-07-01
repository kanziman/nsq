'use client';

import { memo, useEffect, useRef } from 'react';
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

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentSegmentIndex]);

  return (
    <div className="space-y-3">
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
          </div>
        );
      })}
    </div>
  );
}

export default memo(ScriptView);
