/**
 * 세그먼트 텍스트의 단어 단위 강조를 위한 유틸.
 *
 * 자막(VTT) 자동 캡션은 공식 대본과 단어가 일치하지 않으므로(누락/치환) 화면 텍스트로
 * 쓰지 않는다. 대신 공식 대본 텍스트를 단어로 분해하고, 세그먼트 [start, end) 구간에
 * 균등 분포시켜 현재 시간에 해당하는 단어를 근사 강조한다.
 */

// 0 division 방지용 최소 구간 길이.
const MIN_DURATION = 0.001;

/** 공백 기준 단어 분해(빈 토큰 제거). */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * 세그먼트 [start, end) 구간에 wordCount개 단어를 균등 분포시켜, 현재 시간 t의 단어
 * 인덱스를 반환한다. start 이전이면 -1, end 이후이거나 구간을 벗어나면 마지막 단어로 클램프.
 */
export function findCurrentWordIndex(
  wordCount: number,
  start: number,
  end: number,
  t: number,
): number {
  if (wordCount <= 0 || t < start) return -1;
  const dur = Math.max(end - start, MIN_DURATION);
  const idx = Math.floor(((t - start) / dur) * wordCount);
  return Math.min(wordCount - 1, Math.max(0, idx));
}

/**
 * 세그먼트 [start,end) 구간의 VTT 토큰 시각(오름차순)을 공식 단어 수에 비례 매핑해
 * 각 공식 단어의 시작 시각 배열을 만든다. 토큰이 없으면 균등분할로 폴백한다.
 */
export function computeWordStarts(
  wordCount: number,
  start: number,
  end: number,
  tokenTimes: number[],
): number[] {
  if (wordCount <= 0) return [];
  const m = tokenTimes.length;
  // 구간 내 토큰이 없으면 균등분할로 폴백.
  if (m === 0) {
    const dur = Math.max(end - start, MIN_DURATION);
    return Array.from(
      { length: wordCount },
      (_, i) => start + (dur * i) / wordCount,
    );
  }
  // 공식 단어 i를 토큰 시각에 비례 매핑(실제 발화 리듬 반영).
  const starts = Array.from({ length: wordCount }, (_, i) => {
    const j = Math.min(m - 1, Math.floor((i * m) / wordCount));
    return tokenTimes[j];
  });
  // 첫 단어는 세그먼트 시작부터 강조되게 앵커링한다. VTT가 큐 선두 단어를 누락하면
  // 첫 토큰이 실제 첫 단어보다 늦어 [start, firstToken) 구간에 첫 단어가 강조 안 되는
  // 사각(dead zone)이 생긴다. tokenTimes[j] >= start이므로 단조성은 유지된다.
  starts[0] = start;
  return starts;
}

/**
 * 명시적 시작 시각 배열에서 현재 시간 t의 단어 인덱스. starts[i] <= t 인 마지막 i,
 * 첫 시작 이전이거나 비어 있으면 -1.
 */
export function currentWordIndexFromStarts(
  starts: number[],
  t: number,
): number {
  let idx = -1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= t) idx = i;
    else break;
  }
  return idx;
}

/**
 * 대본 단어와 VTT 토큰의 표면형 최장 공통 부분수열(LCS DP)을 구해, 정확 일치 토큰을
 * 앵커 `(wordIdx, time)`로 오름차순 추출한다. 반복 공통 토큰(の·は)도 in-order로 일관 매칭.
 */
function findSurfaceAnchors(
  officialWords: string[],
  vttTokens: { word: string; start: number }[],
): { wordIdx: number; time: number }[] {
  const n = officialWords.length;
  const m = vttTokens.length;
  const anchors: { wordIdx: number; time: number }[] = [];
  if (n === 0 || m === 0) return anchors;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        officialWords[i] === vttTokens[j].word
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (officialWords[i] === vttTokens[j].word) {
      anchors.push({ wordIdx: i, time: vttTokens[j].start });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return anchors;
}

/**
 * (#139) 대본 단어와 VTT 토큰의 표면형을 앵커로 정렬해 각 대본 단어의 시작 시각을 만든다.
 * LCS(경량 DP)로 정확 일치 토큰을 앵커로 잡고, 앵커 사이/전/후 단어는 인접 앵커(및 경계
 * start/end) 사이 인덱스 비례로 선형 보간한다. 앵커가 하나도 없으면 위치-비례(computeWordStarts)
 * 폴백. 자동자막(ASR) 오인식·토큰 개수 발산에 강건하다. word[0]은 세그먼트 시작에 앵커한다.
 */
export function computeWordStartsAligned(
  officialWords: string[],
  start: number,
  end: number,
  vttTokens: { word: string; start: number }[],
): number[] {
  const n = officialWords.length;
  if (n === 0) return [];

  const anchors = findSurfaceAnchors(officialWords, vttTokens);

  // 앵커가 없으면 위치-비례로 폴백(기존 계약).
  if (anchors.length === 0) {
    return computeWordStarts(
      n,
      start,
      end,
      vttTokens.map((t) => t.start),
    );
  }

  const starts = new Array<number>(n);
  // [loIdx, hiIdx] 구간을 [loTime, hiTime]으로 인덱스 비례 채운다(양 끝 포함).
  const fill = (
    loIdx: number,
    hiIdx: number,
    loTime: number,
    hiTime: number,
  ) => {
    const span = hiIdx - loIdx;
    for (let k = loIdx; k <= hiIdx; k++) {
      starts[k] =
        span === 0 ? loTime : loTime + ((hiTime - loTime) * (k - loIdx)) / span;
    }
  };

  // 첫 앵커 전: start → 첫 앵커.
  fill(0, anchors[0].wordIdx, start, anchors[0].time);
  // 앵커 사이.
  for (let a = 0; a < anchors.length - 1; a++) {
    fill(
      anchors[a].wordIdx,
      anchors[a + 1].wordIdx,
      anchors[a].time,
      anchors[a + 1].time,
    );
  }
  // 마지막 앵커 후: 가상 종점 end(인덱스 n)까지 비례. 마지막 단어가 end에 닿지 않게 한다.
  const last = anchors[anchors.length - 1];
  const tailSpan = n - last.wordIdx;
  for (let k = last.wordIdx; k < n; k++) {
    starts[k] =
      tailSpan === 0
        ? last.time
        : last.time + ((end - last.time) * (k - last.wordIdx)) / tailSpan;
  }

  // 첫 단어는 세그먼트 시작에 앵커(첫 강조 사각 제거 — 기존 계약 유지).
  starts[0] = start;
  return starts;
}
