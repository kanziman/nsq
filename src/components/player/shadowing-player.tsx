'use client';

import { useState } from 'react';
import { useShadowingPlayer } from '@/hooks/useShadowingPlayer';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Button } from '@/components/ui/button';
import AudioControls from './AudioControls';
import ScriptView from './ScriptView';
import FocusPanel from './FocusPanel';
import SpeakerFilter from './SpeakerFilter';
import { TutorChat } from '@/components/tutor/TutorChat';
import { PLAYBACK_RATE_PRESETS } from '@/lib/utils/audio';
import type { Episode, Segment } from '@/lib/types';
import { Languages, Sparkles } from 'lucide-react';

/** 현재 속도에서 프리셋 인덱스 기준 ±1 스텝한 속도를 반환한다. */
function stepPlaybackRate(current: number, dir: 1 | -1): number {
  const base = PLAYBACK_RATE_PRESETS.indexOf(
    current as (typeof PLAYBACK_RATE_PRESETS)[number],
  );
  const from = base === -1 ? PLAYBACK_RATE_PRESETS.indexOf(1) : base;
  const nextIdx = Math.min(
    PLAYBACK_RATE_PRESETS.length - 1,
    Math.max(0, from + dir),
  );
  return PLAYBACK_RATE_PRESETS[nextIdx];
}

export interface ShadowingPlayerProps {
  episode: Episode;
  segments: Segment[];
}

export function ShadowingPlayer({
  episode,
  segments,
}: ShadowingPlayerProps): React.ReactElement {
  const [revealAll, setRevealAll] = useState(false);
  const {
    isPlaying,
    currentSegmentIndex,
    currentTime,
    selection,
    isLooping,
    repeatCount,
    playbackRate,
    enabledSpeakers,
    presentSpeakers,
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
    mode,
    toggleMode,
  } = useShadowingPlayer({
    episodeId: episode.id,
    segments,
  });

  const dimmedSpeakers = isSpeakerFilterActive
    ? presentSpeakers.filter((s) => !enabledSpeakers.includes(s))
    : [];

  useKeyboardShortcuts({
    onTogglePlay: toggle,
    onPrev: prev,
    onNext: next,
    onToggleLoop: toggleLoop,
    onSpeedUp: () => setPlaybackRate(stepPlaybackRate(playbackRate, 1)),
    onSpeedDown: () => setPlaybackRate(stepPlaybackRate(playbackRate, -1)),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] lg:gap-[32px]">
      {/* 좌측: 플레이어 + 스크립트 */}
      <div className="lg:col-span-7 space-y-6">
        {/* 상단 dark 플레이어 영역 */}
      <section className="sticky top-4 z-10 rounded-xl bg-surface-dark p-[32px] text-on-dark">
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
        <div className="mt-[12px] flex items-center justify-between gap-[8px]">
          <div className="flex items-center gap-[8px]">
            <SpeakerFilter
              speakers={presentSpeakers}
              enabledSpeakers={enabledSpeakers}
              onToggleSpeaker={toggleSpeaker}
            />
            <Button
              variant="secondaryOnDark"
              size="sm"
              aria-label={mode === 'focus' ? '전체 모드' : '집중 모드'}
              aria-pressed={mode === 'focus'}
              onClick={toggleMode}
            >
              {mode === 'focus' ? '전체 모드' : '집중 모드'}
            </Button>
          </div>
          <Button
            variant="secondaryOnDark"
            size="sm"
            onClick={() => setRevealAll((v) => !v)}
            aria-label={revealAll ? '번역 숨기기' : '번역 보기'}
            className="flex items-center gap-1.5"
          >
            <Languages className="h-4 w-4" strokeWidth={1.5} />
            {revealAll ? '번역 숨기기' : '번역 보기'}
          </Button>
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

      {/* 하단 cream 영역: 모드에 따라 리스트 또는 집중 패널 */}
      {mode === 'focus' ? (
        <FocusPanel
          segment={segments[currentSegmentIndex] ?? null}
          onReplay={() => goToSegment(currentSegmentIndex)}
          currentTime={currentTime}
        />
      ) : (
        <ScriptView
          segments={segments}
          currentSegmentIndex={currentSegmentIndex}
          currentTime={currentTime}
          selection={selection}
          dimmedSpeakers={dimmedSpeakers}
          revealAll={revealAll}
          onSegmentClick={(index, shiftKey) => {
            if (shiftKey) {
              extendSelectionTo(index);
            } else {
              selectSegment(index);
              goToSegment(index);
            }
          }}
        />
      )}
      </div>

      {/* 우측 AI 튜터 패널 */}
      <aside className="lg:col-span-5 rounded-xl border border-hairline bg-surface-card p-[32px] h-[calc(100vh-64px)] sticky top-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-serif text-xl text-ink tracking-[-0.3px]">
            AI Tutor
          </h2>
        </div>
        <TutorChat 
          context={segments[currentSegmentIndex]} 
          speakers={presentSpeakers}
          className="flex-1 overflow-hidden flex flex-col" 
        />
      </aside>
    </div>
  );
}
