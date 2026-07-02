/**
 * 확정 앵커 + 토큰 타임 → 문장 경계 시간(선형 보간) → Segment[], matchRate.
 */
import { Segment, Sentence } from '@/lib/types';

export interface AnchorPoint {
  transcriptIndex: number;
  time: number; // 초(vtt 토큰 시작 시간)
}

// 세그먼트 최소 길이(start<end 보장).
const MIN_DURATION = 0.001;

// 앵커 사이 선형 보간, 바깥은 최근접 앵커로 클램프.
export function interpolateTime(anchors: AnchorPoint[], index: number): number {
  if (anchors.length === 0) return 0;
  if (index <= anchors[0].transcriptIndex) return anchors[0].time;
  const last = anchors[anchors.length - 1];
  if (index >= last.transcriptIndex) return last.time;

  for (let i = 0; i < anchors.length - 1; i++) {
    const lo = anchors[i];
    const hi = anchors[i + 1];
    if (index >= lo.transcriptIndex && index <= hi.transcriptIndex) {
      const span = hi.transcriptIndex - lo.transcriptIndex;
      if (span === 0) return lo.time;
      return (
        lo.time + ((hi.time - lo.time) * (index - lo.transcriptIndex)) / span
      );
    }
  }
  return last.time;
}

export interface AlignInput {
  sentences: Sentence[];
  wordToSentence: number[]; // 대본 단어별 소속 문장 인덱스
  anchorPoints: AnchorPoint[]; // 확정·단조 증가
  candidateCount: number;
  anchoredCount: number;
}

export function buildAlignment(input: AlignInput): {
  segments: Segment[];
  matchRate: number;
} {
  const { sentences, wordToSentence, anchorPoints } = input;
  const totalWords = wordToSentence.length;

  // 첫 앵커가 대본 시작(index 0)보다 뒤에 있으면, 앞쪽 문장들이 모두 첫 앵커 시각으로
  // 클램프되어 겹친다(예: 콜드오픈 5문장이 전부 11.28초). 합성 시작 앵커(0, 0)를 앞에 붙여
  // 첫 앵커까지 선형 분포시킨다.
  const anchors =
    anchorPoints.length > 0 && anchorPoints[0].transcriptIndex > 0
      ? [{ transcriptIndex: 0, time: 0 }, ...anchorPoints]
      : anchorPoints;

  const segments: Segment[] = [];
  let prevEnd = 0;
  for (let k = 0; k < sentences.length; k++) {
    const firstWord = wordToSentence.indexOf(k);
    // 다음 문장 첫 단어 = 현재 문장 경계(end). 없으면 전체 단어 수.
    const nextWord = wordToSentence.indexOf(k + 1);
    const boundary = nextWord === -1 ? totalWords : nextWord;

    const rawStart =
      firstWord === -1 ? prevEnd : interpolateTime(anchors, firstWord);
    const rawEnd = interpolateTime(anchors, boundary);

    const start = Math.max(rawStart, prevEnd);
    const end = Math.max(rawEnd, start + MIN_DURATION);

    segments.push({
      id: `seg-${k}`,
      start,
      end,
      speaker: sentences[k].speaker,
      text: sentences[k].text,
    });
    prevEnd = end;
  }

  const matchRate =
    input.candidateCount > 0 ? input.anchoredCount / input.candidateCount : 0;
  return { segments, matchRate };
}
