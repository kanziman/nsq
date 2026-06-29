'use client';

import { useShadowingPlayer } from '@/hooks/useShadowingPlayer';
import AudioControls from './AudioControls';
import ScriptView from './ScriptView';
import type { Episode, Segment } from '@/lib/types';

export interface ShadowingPlayerProps {
  episode: Episode;
  segments: Segment[];
}

export function ShadowingPlayer({
  episode,
  segments,
}: ShadowingPlayerProps): React.ReactElement {
  const { isPlaying, currentSegmentIndex, toggle } = useShadowingPlayer({
    episodeId: episode.id,
    segments,
  });

  return (
    <div className="space-y-6">
      {/* 상단 dark 플레이어 영역 */}
      <section className="sticky top-4 z-10 rounded-lg bg-surface-dark p-6 text-on-dark">
        <h2 className="font-serif text-xl">{episode.title}</h2>
        <div className="mt-4 flex items-center justify-center">
          <AudioControls isPlaying={isPlaying} onToggle={toggle} />
        </div>
      </section>

      {/* 하단 cream 스크립트 영역 */}
      <ScriptView
        segments={segments}
        currentSegmentIndex={currentSegmentIndex}
      />
    </div>
  );
}
