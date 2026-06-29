'use client';

import { memo } from 'react';
import type { Segment } from '@/lib/types';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';
import { formatTime } from '@/lib/utils/time';

interface ScriptViewProps {
  segments: Segment[];
  currentSegmentIndex?: number;
  onSegmentClick?: (index: number) => void;
}

function ScriptView({
  segments,
  currentSegmentIndex,
  onSegmentClick,
}: ScriptViewProps): React.ReactElement {
  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        const sp = SPEAKER_COLORS[seg.speaker];
        const active = i === currentSegmentIndex;
        return (
          <div
            key={seg.id}
            data-active={active || undefined}
            onClick={onSegmentClick ? () => onSegmentClick(i) : undefined}
            className={[
              'rounded-md border p-4 transition-colors',
              active
                ? `${sp.bgClass} ${sp.borderClass}`
                : 'border-hairline bg-transparent',
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
