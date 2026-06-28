/**
 * 최장 증가 부분수열(strict). 입력 배열에서 LIS를 이루는 인덱스 목록 반환.
 * O(n^2) DP + 부모 포인터(동률 시 앞쪽 인덱스 우선).
 */
export function longestIncreasingSubsequence(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];

  const len = new Array<number>(n).fill(1);
  const prev = new Array<number>(n).fill(-1);
  let best = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (values[j] < values[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
    if (len[i] > len[best]) best = i;
  }

  const indices: number[] = [];
  for (let i = best; i !== -1; i = prev[i]) indices.push(i);
  return indices.reverse();
}
