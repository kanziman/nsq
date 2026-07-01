'use client';

import { useShadowingPlayer } from '@/hooks/useShadowingPlayer';
import AudioControls from './AudioControls';
import ScriptView from './ScriptView';
import SpeakerFilter from './SpeakerFilter';
import { SPEAKER_COLORS, type SpeakerKey } from '@/lib/constants/speakers';
import type { Episode, Segment } from '@/lib/types';

const ALL_SPEAKERS = Object.keys(SPEAKER_COLORS) as SpeakerKey[];

export interface ShadowingPlayerProps {
  episode: Episode;
  segments: Segment[];
}

export function ShadowingPlayer({
  episode,
  segments,
}: ShadowingPlayerProps): React.ReactElement {
  const {
    isPlaying,
    currentSegmentIndex,
    currentTime,
    selection,
    isLooping,
    repeatCount,
    playbackRate,
    enabledSpeakers,
    isSpeakerFilterActive,
    filterNotice,
    toggle,
    seekTo,
    next,
    prev,
    goToSegment,
    selectSegment,
    extendSelectionTo,
    toggleLoop,
    setPlaybackRate,
    toggleSpeaker,
    dismissFilterNotice,
  } = useShadowingPlayer({
    episodeId: episode.id,
    segments,
  });

  const dimmedSpeakers = isSpeakerFilterActive
    ? ALL_SPEAKERS.filter((s) => !enabledSpeakers.includes(s))
    : [];

  return (
    <div className="space-y-6">
      {/* 상단 dark 플레이어 영역 */}
      <section className="sticky top-4 z-10 rounded-lg bg-surface-dark p-6 text-on-dark">
        <h2 className="font-serif text-xl">{episode.title}</h2>
        <div className="mt-4">
          <AudioControls
            isPlaying={isPlaying}
            onToggle={toggle}
            currentTime={currentTime}
            duration={episode.duration}
            onSeek={seekTo}
            onPrev={prev}
            onNext={next}
            isLooping={isLooping}
            onToggleLoop={toggleLoop}
            repeatCount={repeatCount}
            canLoop={selection !== null}
            playbackRate={playbackRate}
            onSetPlaybackRate={setPlaybackRate}
          />
        </div>
        <div className="mt-3">
          <SpeakerFilter
            enabledSpeakers={enabledSpeakers}
            onToggleSpeaker={toggleSpeaker}
          />
        </div>
        {filterNotice ? (
          <div
            role="alert"
            className="mt-2 flex items-center gap-2 text-xs text-on-dark-soft"
          >
            <span>{filterNotice}</span>
            <button
              type="button"
              aria-label="안내 닫기"
              className="underline"
              onClick={dismissFilterNotice}
            >
              닫기
            </button>
          </div>
        ) : null}
      </section>

      {/* 하단 cream 스크립트 영역 */}
      <ScriptView
        segments={segments}
        currentSegmentIndex={currentSegmentIndex}
        selection={selection}
        dimmedSpeakers={dimmedSpeakers}
        onSegmentClick={(index, shiftKey) => {
          if (shiftKey) {
            extendSelectionTo(index);
          } else {
            selectSegment(index);
            goToSegment(index);
          }
        }}
      />
    </div>
  );
}
