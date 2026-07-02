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

// YouTube 자동자막의 인라인 단어 타임스탬프: <00:00:00.240><c> word</c>
const INLINE_WORD = /<(\d{1,2}:\d{2}:\d{2}[.,]\d{3})><c>\s*([^<]+?)<\/c>/g;

function hasInlineWordTimings(vtt: string): boolean {
  return /<\d{1,2}:\d{2}:\d{2}[.,]\d{3}><c>/.test(vtt);
}

/**
 * YouTube 자동자막(롤링) 처리: 인라인 <ts><c>word</c> 쌍을 타임스탬프로 dedupe한다.
 * 롤링 스냅샷/이월로 같은 단어가 여러 번 나와도 원 타임스탬프를 재사용하므로,
 * 타임스탬프 기준 중복 제거 시 발화 단어당 1회로 정규화된다.
 */
function parseYoutubeAutoCaptions(vtt: string): VttToken[] {
  const byTime = new Map<number, string>();
  const re = new RegExp(INLINE_WORD.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(vtt)) !== null) {
    const t = toSeconds(m[1]);
    const word = m[2].trim();
    if (word && !byTime.has(t)) byTime.set(t, word);
  }
  const entries = [...byTime.entries()].sort((a, b) => a[0] - b[0]);
  return entries.map(([start, word], i) => ({
    word,
    start,
    end: i + 1 < entries.length ? entries[i + 1][0] : start + 0.5,
  }));
}

export function parseVtt(vtt: string): VttToken[] {
  // YouTube 자동자막이면 인라인 타임스탬프로 정확·중복제거 파싱.
  if (hasInlineWordTimings(vtt)) return parseYoutubeAutoCaptions(vtt);

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
