/**
 * 조밀 앵커 도출(Hunt–Szymanski LCS).
 *
 * 기존 findAnchorCandidates는 "양쪽에서 정확히 1회" 등장하는 전역 고유 단어만 앵커로 삼아,
 * 반복 어휘가 많은 구간(예: anger 주제의 angry/temper)에서 앵커가 희소해지고 선형 보간이
 * 크게 드리프트한다. 여기서는 반복 단어까지 후보로 넣고 LCS(최장 공통 부분수열)로 전역
 * 단조성을 만족하는 조밀한 앵커 쌍을 뽑아 보간 정밀도를 높인다.
 *
 * 매칭 폭발("the" 등 초고빈도 단어가 수천 위치와 매칭)을 막기 위해 어느 한쪽에서라도
 * maxFreq를 초과하는 단어는 후보에서 제외한다.
 */

export interface AnchorPair {
  transcriptIndex: number;
  vttIndex: number;
}

// 이 값을 초과하는 빈도의 단어는 후보에서 제외(매칭 폭발 방지).
const DEFAULT_MAX_FREQ = 8;

/**
 * 정규화된 vtt/transcript 단어열에서 LCS 기반 조밀 앵커 쌍을 반환한다.
 * transcriptIndex·vttIndex 모두 순단조 증가한다(보간에 바로 사용 가능).
 */
export function findDenseAnchors(
  vttWords: string[],
  transcriptWords: string[],
  maxFreq: number = DEFAULT_MAX_FREQ,
): AnchorPair[] {
  // word → 오름차순 vtt 인덱스 목록.
  const vttPositions = new Map<string, number[]>();
  for (let j = 0; j < vttWords.length; j++) {
    const w = vttWords[j];
    if (!w) continue;
    const arr = vttPositions.get(w);
    if (arr) arr.push(j);
    else vttPositions.set(w, [j]);
  }
  // 대본 빈도(한쪽만 흔해도 제외하기 위함).
  const tCounts = new Map<string, number>();
  for (const w of transcriptWords) {
    if (w) tCounts.set(w, (tCounts.get(w) ?? 0) + 1);
  }

  // Hunt–Szymanski: 대본을 순서대로 훑으며 각 단어의 vtt 매칭을 vtt 내림차순으로 나열한다.
  // 같은 transcriptIndex의 후보가 내림차순이라, 순증가 LIS는 그중 최대 1개만 채택한다.
  const seqTi: number[] = [];
  const seqVi: number[] = [];
  for (let i = 0; i < transcriptWords.length; i++) {
    const w = transcriptWords[i];
    if (!w) continue;
    const positions = vttPositions.get(w);
    if (!positions || positions.length > maxFreq) continue;
    if ((tCounts.get(w) ?? 0) > maxFreq) continue;
    for (let k = positions.length - 1; k >= 0; k--) {
      seqTi.push(i);
      seqVi.push(positions[k]);
    }
  }

  const picked = lisIndices(seqVi);
  return picked.map((idx) => ({
    transcriptIndex: seqTi[idx],
    vttIndex: seqVi[idx],
  }));
}

// 순증가(strict) LIS를 patience sorting + 부모 포인터로 O(n log n)에 계산.
// 입력 배열에서 LIS를 이루는 인덱스 목록을 반환한다.
function lisIndices(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const tails: number[] = []; // 길이 k+1 증가수열의 최소 꼬리값을 갖는 values 인덱스.
  const prev = new Array<number>(n).fill(-1);

  for (let i = 0; i < n; i++) {
    const x = values[i];
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (values[tails[mid]] < x) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    if (lo === tails.length) tails.push(i);
    else tails[lo] = i;
  }

  const result: number[] = [];
  let k = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (k !== -1) {
    result.push(k);
    k = prev[k];
  }
  return result.reverse();
}
