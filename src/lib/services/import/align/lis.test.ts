import { describe, it, expect } from 'vitest';
import { longestIncreasingSubsequence } from './lis';

describe('longestIncreasingSubsequence', () => {
  it('should return indices of the longest strictly increasing subsequence', () => {
    // [3,1,2,4] → LIS [1,2,4] at indices [1,2,3]
    expect(longestIncreasingSubsequence([3, 1, 2, 4])).toEqual([1, 2, 3]);
  });

  it('should return all indices when already strictly increasing', () => {
    expect(longestIncreasingSubsequence([10, 20, 30])).toEqual([0, 1, 2]);
  });

  it('should treat equal values as non-increasing (strict)', () => {
    // [5,5,5] → any single element; longest length 1 → first index
    expect(longestIncreasingSubsequence([5, 5, 5])).toEqual([0]);
  });

  it('should return empty for empty input', () => {
    expect(longestIncreasingSubsequence([])).toEqual([]);
  });
});
