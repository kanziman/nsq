import { useState, useEffect } from 'react';
import type { Segment } from '@/lib/types';

// 에피소드 오디오 URL 단위 캐시
const bufferCache = new Map<string, AudioBuffer>();

export function useWaveform(
  audioUrl: string | undefined,
  segment: Segment | undefined,
) {
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!audioUrl || !segment) {
      setWaveform([]);
      return;
    }

    let isCancelled = false;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('AudioContext not supported in this environment');
      setWaveform([]);
      return;
    }
    const audioContext = new AudioContextClass();

    async function loadAndDecode() {
      if (!audioUrl || !segment) return;
      setIsLoading(true);
      try {
        let buffer = bufferCache.get(audioUrl);
        if (!buffer) {
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          buffer = await audioContext.decodeAudioData(arrayBuffer);
          bufferCache.set(audioUrl, buffer);
        }

        if (isCancelled) return;

        // 세그먼트 시간 범위
        const start = segment.audioStart ?? segment.start;
        const end = segment.end;

        // 해당 범위의 샘플 데이터 추출
        const channelData = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
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

        if (!isCancelled) {
          setWaveform(normalized);
        }
      } catch (e) {
        console.warn('Failed to decode audio data for waveform', e);
        if (!isCancelled) setWaveform([]);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void loadAndDecode();

    return () => {
      isCancelled = true;
      if (audioContext.state !== 'closed') {
        void audioContext.close();
      }
    };
  }, [audioUrl, segment]);

  return { waveform, isLoading };
}
