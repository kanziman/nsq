import { describe, it, expect } from 'vitest';
import { normalizeWord, findAnchorCandidates } from './anchor';

describe('normalizeWord', () => {
  it('should lowercase and strip punctuation', () => {
    expect(normalizeWord('Salmon.')).toBe('salmon');
    expect(normalizeWord('"Hello,"')).toBe('hello');
    expect(normalizeWord('U.S.A!')).toBe('usa');
    expect(normalizeWord('...')).toBe('');
  });
});

describe('findAnchorCandidates', () => {
  it('should return only words occurring exactly once on both sides', () => {
    const vtt = ['the', 'grizzly', 'bear', 'the'];
    const tr = ['a', 'grizzly', 'bear', 'a'];
    expect(findAnchorCandidates(vtt, tr)).toEqual([
      { word: 'grizzly', vttIndex: 1, transcriptIndex: 1 },
      { word: 'bear', vttIndex: 2, transcriptIndex: 2 },
    ]);
  });

  it('should exclude words appearing multiple times on either side', () => {
    const vtt = ['x', 'unique', 'x'];
    const tr = ['unique', 'y', 'y'];
    expect(findAnchorCandidates(vtt, tr)).toEqual([
      { word: 'unique', vttIndex: 1, transcriptIndex: 0 },
    ]);
  });

  it('should ignore empty (punctuation-only) normalized words', () => {
    const vtt = ['', 'only', ''];
    const tr = ['only', '', ''];
    expect(findAnchorCandidates(vtt, tr)).toEqual([
      { word: 'only', vttIndex: 1, transcriptIndex: 0 },
    ]);
  });
});
