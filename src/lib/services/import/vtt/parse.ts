/**
 * WebVTT 텍스트 → 단어 토큰(VttToken). 큐 구간을 단어 수로 균등 분배.
 */
import { VttToken } from '@/lib/types';

// 큐 타이밍 라인: HH:MM:SS.mmm 또는 MM:SS.mmm (쉼표 소수점도 허용).
const TIMING =
  /(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{1,2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{1,2}:\d{2}[.,]\d{3})/;

// 타임스탬프 문자열 → 초.
function toSeconds(ts: string): number {
  return ts
    .replace(',', '.')
    .split(':')
    .map(Number)
    .reduce((acc, p) => acc * 60 + p, 0);
}

export function parseVtt(vtt: string): VttToken[] {
  const tokens: VttToken[] = [];

  for (const block of vtt.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const timingLine = lines.find((l) => TIMING.test(l));
    if (!timingLine) continue;

    const match = TIMING.exec(timingLine);
    if (!match) continue;
    const start = toSeconds(match[1]);
    const end = toSeconds(match[2]);

    // 타이밍 라인 이후가 큐 텍스트. 인라인 태그(<...>)는 제거.
    const text = lines
      .slice(lines.indexOf(timingLine) + 1)
      .join(' ')
      .replace(/<[^>]*>/g, ' ');
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const duration = end - start;
    words.forEach((word, i) => {
      tokens.push({
        word,
        start: start + (duration * i) / words.length,
        end: start + (duration * (i + 1)) / words.length,
      });
    });
  }

  return tokens;
}
