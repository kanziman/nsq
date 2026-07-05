import { describe, it, expect } from 'vitest';
import { findDenseAnchors } from './dense';

describe('findDenseAnchors', () => {
  it('[정상] should anchor repeated words that the unique-only strategy skips', () => {
    // "angry"가 양쪽에서 2회 등장 → 고유 단어 전략에선 앵커 불가지만, LCS는 둘 다 잡는다.
    const vtt = ['i', 'am', 'angry', 'x', 'y', 'so', 'angry'];
    const tr = ['i', 'am', 'angry', 'a', 'b', 'so', 'angry'];
    const pairs = findDenseAnchors(vtt, tr);
    const words = pairs.map((p) => tr[p.transcriptIndex]);
    expect(words.filter((w) => w === 'angry')).toHaveLength(2);
  });

  it('[정상] should return pairs strictly increasing in both indices', () => {
    const vtt = ['a', 'b', 'c', 'b', 'd', 'e'];
    const tr = ['a', 'z', 'b', 'c', 'd', 'e'];
    const pairs = findDenseAnchors(vtt, tr);
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].transcriptIndex).toBeGreaterThan(
        pairs[i - 1].transcriptIndex,
      );
      expect(pairs[i].vttIndex).toBeGreaterThan(pairs[i - 1].vttIndex);
    }
  });

  it('[정상] should map each pair to the same word on both sides', () => {
    const vtt = ['one', 'two', 'three', 'four'];
    const tr = ['one', 'x', 'three', 'four'];
    const pairs = findDenseAnchors(vtt, tr);
    for (const p of pairs) {
      expect(vtt[p.vttIndex]).toBe(tr[p.transcriptIndex]);
    }
    expect(pairs.map((p) => vtt[p.vttIndex])).toEqual(['one', 'three', 'four']);
  });

  it('[경계] should exclude words exceeding maxFreq to avoid match explosion', () => {
    // "the"가 vtt에 5회 → maxFreq=2면 제외되어 앵커에 포함되지 않는다.
    const vtt = ['the', 'the', 'cat', 'the', 'the', 'the'];
    const tr = ['the', 'cat', 'the'];
    const pairs = findDenseAnchors(vtt, tr, 2);
    const words = pairs.map((p) => tr[p.transcriptIndex]);
    expect(words).not.toContain('the');
    expect(words).toContain('cat');
  });

  it('[경계] should return [] when there are no common words', () => {
    expect(findDenseAnchors(['a', 'b'], ['c', 'd'])).toEqual([]);
  });

  it('[경계] should ignore empty (normalized-out) tokens', () => {
    const vtt = ['', 'hello', '', 'world'];
    const tr = ['hello', '', 'world'];
    const pairs = findDenseAnchors(vtt, tr);
    expect(pairs.map((p) => tr[p.transcriptIndex])).toEqual(['hello', 'world']);
  });
});
