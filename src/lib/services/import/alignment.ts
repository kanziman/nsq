/**
 * 임포트 파이프라인의 alignment(자막↔대본 정합) 단계 모듈.
 * subtitle.en.vtt + transcript.txt → 코어 조립 → segments.json 기록, matchRate 반환.
 */
import fs from 'fs/promises';
import path from 'path';
import { Sentence } from '@/lib/types';
import { parseVtt } from '@/lib/utils/vtt-parser';
import { normalizeWord, findAnchorCandidates } from './align/anchor';
import { longestIncreasingSubsequence } from './align/lis';
import { findDenseAnchors } from './align/dense';
import { buildAlignment, AnchorPoint } from './align/interpolate';

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

async function readFileOrThrow(
  filePath: string,
  label: string,
): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`alignment: missing ${label} (${filePath})`);
  }
}

export async function alignTranscript(
  videoId: string,
): Promise<{ matchRate: number }> {
  const dir = path.join(EPISODES_DIR, videoId);
  const vttRaw = await readFileOrThrow(
    path.join(dir, 'subtitle.en.vtt'),
    'subtitle.en.vtt',
  );
  const transcriptRaw = await readFileOrThrow(
    path.join(dir, 'transcript.txt'),
    'transcript.txt',
  );

  // 대본: JSONL → Sentence[], 단어 평탄화(정규화) + 단어별 문장 인덱스.
  const sentences: Sentence[] = transcriptRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Sentence);

  const transcriptWords: string[] = [];
  const wordToSentence: number[] = [];
  sentences.forEach((sentence, si) => {
    for (const raw of sentence.text.split(/\s+/).filter(Boolean)) {
      transcriptWords.push(normalizeWord(raw));
      wordToSentence.push(si);
    }
  });

  // 자막 토큰 → 정규화 단어.
  const vttTokens = parseVtt(vttRaw);
  const vttWords = vttTokens.map((token) => normalizeWord(token.word));

  // 품질 지표(matchRate)는 기존 고유 단어 앵커 기준을 유지한다(0.85 게이트 안정성).
  const candidates = findAnchorCandidates(vttWords, transcriptWords);
  const lisIndices = longestIncreasingSubsequence(
    candidates.map((c) => c.vttIndex),
  );
  const confirmed = lisIndices.map((i) => candidates[i]);

  // 보간용 앵커는 반복 단어까지 포함한 LCS 조밀 앵커를 사용해 드리프트를 줄인다.
  // (LCS는 고유 단어 앵커를 부분집합으로 포함하므로 전역 정합과 모순되지 않는다.)
  const densePairs = findDenseAnchors(vttWords, transcriptWords);
  const anchorPoints: AnchorPoint[] = densePairs.map((p) => ({
    transcriptIndex: p.transcriptIndex,
    time: vttTokens[p.vttIndex].start,
  }));

  const { segments, matchRate } = buildAlignment({
    sentences,
    wordToSentence,
    anchorPoints,
    candidateCount: candidates.length,
    anchoredCount: confirmed.length,
  });

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'segments.json'),
    JSON.stringify(segments, null, 2),
    'utf-8',
  );

  return { matchRate };
}
