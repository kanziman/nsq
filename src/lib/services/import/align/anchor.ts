/**
 * 정규화 + 희소 공통 단어(양쪽 1회씩) 앵커 후보 도출.
 */

/** 소문자 + 영숫자 외 문자 제거. */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface AnchorCandidate {
  word: string;
  vttIndex: number; // vtt 토큰 인덱스
  transcriptIndex: number; // 대본 단어 인덱스
}

// 비어있지 않은 단어의 등장 횟수 맵.
function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    if (!word) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

// 입력은 정규화된 단어 배열(빈 문자열은 후보 제외). transcriptIndex 오름차순 반환.
export function findAnchorCandidates(
  vttWords: string[],
  transcriptWords: string[],
): AnchorCandidate[] {
  const vttCounts = countWords(vttWords);
  const transcriptCounts = countWords(transcriptWords);

  const candidates: AnchorCandidate[] = [];
  for (let ti = 0; ti < transcriptWords.length; ti++) {
    const word = transcriptWords[ti];
    if (!word) continue;
    if (transcriptCounts.get(word) === 1 && vttCounts.get(word) === 1) {
      candidates.push({
        word,
        vttIndex: vttWords.indexOf(word),
        transcriptIndex: ti,
      });
    }
  }
  return candidates;
}
