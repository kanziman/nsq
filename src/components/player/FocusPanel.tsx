'use client';

import { Button } from '@/components/ui/button';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';
import { formatTime } from '@/lib/utils/time';
import type { Segment } from '@/lib/types';

interface FocusPanelProps {
  segment: Segment | null;
  onReplay: () => void;
}

export default function FocusPanel({
  segment,
  onReplay,
}: FocusPanelProps): React.ReactElement {
  if (!segment) {
    return (
      <div className="rounded-md border border-hairline p-8 text-center text-muted">
        재생할 세그먼트를 선택하세요.
      </div>
    );
  }

  const sp = SPEAKER_COLORS[segment.speaker];
  return (
    <div className="rounded-md border border-hairline p-8">
      <div className="mb-4 flex items-center gap-3">
        <span className={`text-sm font-medium ${sp.textClass}`}>{sp.name}</span>
        <span className="font-mono text-xs text-muted-soft">
          {formatTime(segment.start)}
        </span>
      </div>
      <p className="font-serif text-2xl leading-relaxed">{segment.text}</p>
      <div className="mt-6">
        <Button
          variant="secondary"
          size="sm"
          aria-label="다시 듣기"
          onClick={onReplay}
        >
          🔁 다시 듣기
        </Button>
      </div>
    </div>
  );
}
