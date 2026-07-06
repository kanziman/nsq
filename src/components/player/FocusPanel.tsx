'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Square, Mic, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';
import { formatTime } from '@/lib/utils/time';
import {
  isRecordingSupported,
  startRecording,
  type Recorder,
} from '@/lib/utils/recorder';
import { SegmentText } from './SegmentText';
import type { Segment } from '@/lib/types';

interface FocusPanelProps {
  segment: Segment | null;
  onReplay: () => void;
  currentTime?: number;
}

export default function FocusPanel({
  segment,
  onReplay,
  currentTime,
}: FocusPanelProps): React.ReactElement {
  const supported = isRecordingSupported();
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  // 커스텀 녹음 오디오 재생기 상태
  const [isRecordPlaying, setIsRecordPlaying] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordAudioRef = useRef<HTMLAudioElement | null>(null);

  const blobUrlRef = useRef<string | null>(null);
  blobUrlRef.current = blobUrl;

  // 언마운트 시 메모리에 보관 중인 녹음물을 해제한다.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // 새로운 녹음 완료 시 재생 상태 초기화
  useEffect(() => {
    setIsRecordPlaying(false);
    setRecordTime(0);
    setRecordDuration(0);
  }, [blobUrl]);

  const isRecording = recorder !== null;

  const handleStart = async (): Promise<void> => {
    try {
      const r = await startRecording();
      setRecorder(r);
      setRecError(null);
    } catch {
      setRecError('마이크 권한이 필요합니다.');
    }
  };

  const handleStop = async (): Promise<void> => {
    if (!recorder) return;
    const blob = await recorder.stop();
    setRecorder(null);
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  };

  const toggleRecordPlay = () => {
    if (!recordAudioRef.current) return;
    if (isRecordPlaying) {
      recordAudioRef.current.pause();
      setIsRecordPlaying(false);
    } else {
      recordAudioRef.current.play();
      setIsRecordPlaying(true);
    }
  };

  if (!segment) {
    return (
      <div className="rounded-xl border border-hairline p-[32px] text-center text-muted bg-canvas">
        재생할 세그먼트를 선택하세요.
      </div>
    );
  }

  const sp = SPEAKER_COLORS[segment.speaker];
  return (
    <div className="rounded-xl border border-hairline p-[32px] bg-canvas">
      <div className="mb-[16px] flex items-center gap-[12px]">
        <span
          className={`text-[12px] font-medium px-[12px] py-[4px] rounded-full ${sp.bgClass} ${sp.textClass}`}
        >
          {sp.name}
        </span>
        <span className="font-mono text-xs text-muted-soft">
          {formatTime(segment.start)}
        </span>
      </div>
      <SegmentText
        segment={segment}
        highlightWords
        currentTime={currentTime}
        className="font-sans text-2xl leading-relaxed tracking-[-0.3px]"
      />

      <div className="mt-[24px] flex flex-wrap items-center gap-[12px]">
        <Button
          variant="secondary"
          size="sm"
          aria-label="다시 듣기"
          onClick={onReplay}
          className="flex items-center gap-[8px]"
        >
          <RotateCcw className="h-4 w-4 text-ink" strokeWidth={1.5} />
          <span>다시 듣기</span>
        </Button>

        {isRecording ? (
          <Button
            variant="primary"
            size="sm"
            aria-label="정지"
            onClick={handleStop}
            className="flex items-center gap-[8px]"
          >
            <Square className="h-4 w-4" strokeWidth={1.5} />
            <span>정지</span>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            aria-label="녹음"
            disabled={!supported}
            onClick={handleStart}
            className="flex items-center gap-[8px]"
          >
            <Mic className="h-4 w-4 text-ink" strokeWidth={1.5} />
            <span>녹음</span>
          </Button>
        )}

        {/* 커스텀 오디오 재생 컨트롤러 (디자인 시스템 부합) */}
        {blobUrl ? (
          <div className="flex items-center gap-[8px] rounded-md border border-hairline bg-surface-soft px-[12px] py-[4px] h-9">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-6 w-6 rounded-full bg-canvas border-hairline p-0 flex items-center justify-center"
              aria-label={isRecordPlaying ? '녹음 재생 일시정지' : '녹음 재생'}
              onClick={toggleRecordPlay}
            >
              {isRecordPlaying ? (
                <Pause className="h-3.5 w-3.5 text-ink" strokeWidth={1.5} />
              ) : (
                <Play className="h-3.5 w-3.5 text-ink" strokeWidth={1.5} />
              )}
            </Button>
            <span className="font-mono text-xs text-muted-soft">
              {formatTime(recordTime)} / {formatTime(recordDuration)}
            </span>
            <audio
              ref={recordAudioRef}
              src={blobUrl}
              className="hidden"
              onTimeUpdate={() =>
                setRecordTime(recordAudioRef.current?.currentTime || 0)
              }
              onLoadedMetadata={() =>
                setRecordDuration(recordAudioRef.current?.duration || 0)
              }
              onEnded={() => setIsRecordPlaying(false)}
            />
          </div>
        ) : null}
      </div>

      {!supported ? (
        <p className="mt-xs text-xs text-muted leading-[1.55]">
          이 브라우저에서는 녹음이 지원되지 않습니다.
        </p>
      ) : null}
      {recError ? (
        <p role="alert" className="mt-xs text-xs text-muted leading-[1.55]">
          {recError}
        </p>
      ) : null}
    </div>
  );
}
