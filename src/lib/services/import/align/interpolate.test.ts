import { describe, it, expect } from 'vitest';
import {
  interpolateTime,
  buildAlignment,
  type AnchorPoint,
} from './interpolate';
import type { Sentence } from '@/lib/types';

describe('interpolateTime', () => {
  const anchors: AnchorPoint[] = [
    { transcriptIndex: 0, time: 0 },
    { transcriptIndex: 10, time: 20 },
  ];

  it('should linearly interpolate time between two anchors', () => {
    expect(interpolateTime(anchors, 5)).toBe(10);
    expect(interpolateTime(anchors, 2)).toBe(4);
  });

  it('should clamp to nearest anchor time outside the anchor range', () => {
    expect(interpolateTime(anchors, -3)).toBe(0);
    expect(interpolateTime(anchors, 99)).toBe(20);
  });
});

describe('buildAlignment', () => {
  const sentences: Sentence[] = [
    { speaker: 'DUCKWORTH', text: 'a b c' },
    { speaker: 'DUBNER', text: 'd e' },
  ];
  const wordToSentence = [0, 0, 0, 1, 1];
  const anchorPoints: AnchorPoint[] = [
    { transcriptIndex: 0, time: 0 },
    { transcriptIndex: 3, time: 6 },
    { transcriptIndex: 4, time: 8 },
  ];

  it('should produce Segment[] with id/start/end/speaker/text and matchRate in [0,1]', () => {
    const { segments, matchRate } = buildAlignment({
      sentences,
      wordToSentence,
      anchorPoints,
      candidateCount: 3,
      anchoredCount: 3,
    });
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ speaker: 'DUCKWORTH', text: 'a b c' });
    expect(segments[1]).toMatchObject({ speaker: 'DUBNER', text: 'd e' });
    for (const s of segments) {
      expect(typeof s.id).toBe('string');
      expect(s.start).toBeLessThan(s.end);
    }
    expect(matchRate).toBe(1);
    expect(matchRate).toBeGreaterThanOrEqual(0);
    expect(matchRate).toBeLessThanOrEqual(1);
  });

  it('should enforce start<end and monotonically increasing segment times', () => {
    const { segments } = buildAlignment({
      sentences,
      wordToSentence,
      anchorPoints,
      candidateCount: 3,
      anchoredCount: 3,
    });
    for (let i = 0; i < segments.length; i++) {
      expect(segments[i].start).toBeLessThan(segments[i].end);
      if (i > 0) {
        expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].end);
      }
    }
  });

  it('should return matchRate 0 when there are no candidates', () => {
    const { matchRate } = buildAlignment({
      sentences,
      wordToSentence,
      anchorPoints: [],
      candidateCount: 0,
      anchoredCount: 0,
    });
    expect(matchRate).toBe(0);
  });
});
