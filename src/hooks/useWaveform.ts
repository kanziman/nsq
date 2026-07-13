import { useState, useEffect } from 'react';
import type { Segment } from '@/lib/types';

// 에피소드 오디오 URL 단위 캐시
const bufferCache = new Map<string, AudioBuffer>();

export function useWaveform(
  audioUrl: string | undefined,
  segment: Segment | undefined,
) {
  const [waveform, setWaveform] = useState<number[]>([]);
  const [decodedBuffer, setDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1단계: audioUrl이 변경되면 백그라운드에서 즉시 오디오 fetch 및 디코딩 시작 (Preload)
  useEffect(() => {
    if (!audioUrl) {
      setDecodedBuffer(null);
      setWaveform([]);
      return;
    }

    let isCancelled = false;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('AudioContext not supported in this environment');
      return;
    }

    const url = audioUrl;
    const cached = bufferCache.get(url);
    if (cached) {
      setDecodedBuffer(cached);
      return;
    }

    const audioContext = new AudioContextClass();
    setIsLoading(true);

    async function loadAndDecode() {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        bufferCache.set(url, buffer);

        if (!isCancelled) {
          setDecodedBuffer(buffer);
        }
      } catch (e) {
        console.warn('Failed to decode audio data for waveform', e);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
        if (audioContext.state !== 'closed') {
          void audioContext.close();
        }
      }
    }

    void loadAndDecode();

    return () => {
      isCancelled = true;
      if (audioContext.state !== 'closed') {
        void audioContext.close();
      }
    };
  }, [audioUrl]);

  // 2단계: decodedBuffer와 segment가 모두 준비되면 즉시 해당 세그먼트 구간의 파형 슬라이스
  useEffect(() => {
    if (!decodedBuffer || !segment) {
      setWaveform([]);
      return;
    }

    // 세그먼트 시간 범위
    const start = segment.audioStart ?? segment.start;
    const end = segment.end;

    // 해당 범위의 샘플 데이터 추출
    const channelData = decodedBuffer.getChannelData(0);
    const sampleRate = decodedBuffer.sampleRate;
    const startIndex = Math.floor(start * sampleRate);
    const endIndex = Math.floor(end * sampleRate);

    // 100개의 바(bar)로 표현한다고 가정
    const numBars = 100;
    const step = Math.floor((endIndex - startIndex) / numBars);
    const bars: number[] = [];

    for (let i = 0; i < numBars; i++) {
      const blockStart = startIndex + i * step;
      let sum = 0;
      for (let j = 0; j < step; j++) {
        const idx = blockStart + j;
        if (idx < channelData.length) {
          sum += Math.abs(channelData[idx]);
        }
      }
      bars.push(sum / step);
    }

    // 정규화
    const max = Math.max(...bars, 0.001);
    const normalized = bars.map((v) => v / max);

    setWaveform(normalized);
  }, [decodedBuffer, segment]);

  return { waveform, isLoading };
}
