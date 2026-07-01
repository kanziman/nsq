'use client';

import { useEffect, useRef, useState } from 'react';
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
  const blobUrlRef = useRef<string | null>(null);
  blobUrlRef.current = blobUrl;

  // 언마운트 시 메모리에 보관 중인 녹음물을 해제한다 (영속화 없음, AC2).
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

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
      <SegmentText
        segment={segment}
        highlightWords
        currentTime={currentTime}
        className="font-serif text-2xl leading-relaxed"
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label="다시 듣기"
          onClick={onReplay}
        >
          🔁 다시 듣기
        </Button>

        {isRecording ? (
          <Button
            variant="primary"
            size="sm"
            aria-label="정지"
            onClick={handleStop}
          >
            ⏹ 정지
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            aria-label="녹음"
            disabled={!supported}
            onClick={handleStart}
          >
            🎙 녹음
          </Button>
        )}

        {blobUrl ? (
          <audio aria-label="녹음 들어보기" src={blobUrl} controls />
        ) : null}
      </div>

      {!supported ? (
        <p className="mt-2 text-xs text-muted">
          이 브라우저에서는 녹음이 지원되지 않습니다.
        </p>
      ) : null}
      {recError ? (
        <p role="alert" className="mt-2 text-xs text-muted">
          {recError}
        </p>
      ) : null}
    </div>
  );
}
