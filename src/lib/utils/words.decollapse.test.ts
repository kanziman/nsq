/**
 * #142: computeWordStartsAligned — 선두 무타임스탬프 단어 붕괴 제거.
 *
 * 유튜브 롤링 자동자막은 선두 단어에 개별 타임스탬프가 없어, 첫 표면 앵커 시각이
 * 세그먼트 start와 같으면 선두 단어들이 전부 wordStarts=start로 붕괴한다.
 * currentWordIndexFromStarts는 동률 시각에서 마지막 인덱스를 반환하므로, 세그먼트
 * 진입(t≈start)에서 첫 단어가 아니라 붕괴 런의 꼬리가 강조된다(예: sent-2의 「たら」).
 * 이 테스트들은 붕괴가 제거되어 진입 시 index 0이 강조됨을 강제한다.
 */
import { describe, it, expect } from 'vitest';
import { computeWordStartsAligned, currentWordIndexFromStarts } from './words';

// 선두 붕괴 유발 최소 케이스: 첫 앵커(A)의 시각 == start(10), 이후 구별 앵커(B@14).
// officialWords 0..3(w0,w1,w2,A)이 10에 묶이고 B가 14 — 현재 구현은 [10,10,10,10,14].
const words = ['w0', 'w1', 'w2', 'A', 'B'];
const toks = [
  { word: 'A', start: 10 },
  { word: 'B', start: 14 },
];

describe('computeWordStartsAligned (#142 leading de-collapse)', () => {
  it('should highlight index 0 at segment start when leading words collapse to start', () => {
    const ws = computeWordStartsAligned(words, 10, 20, toks);
    expect(currentWordIndexFromStarts(ws, 10)).toBe(0);
  });

  it('should spread the collapsed leading run strictly increasing below the next distinct anchor', () => {
    const ws = computeWordStartsAligned(words, 10, 20, toks);
    expect(ws[0]).toBe(10);
    for (let i = 1; i < 4; i++) {
      expect(ws[i]).toBeGreaterThan(ws[i - 1]);
      expect(ws[i]).toBeLessThan(14);
    }
  });

  it('should make each leading word individually reachable as the current word', () => {
    const ws = computeWordStartsAligned(words, 10, 20, toks);
    expect(currentWordIndexFromStarts(ws, ws[1])).toBe(1);
    expect(currentWordIndexFromStarts(ws, ws[2])).toBe(2);
  });

  it('should highlight index 0 at start when every word collapses to start (single anchor at start)', () => {
    // C가 마지막 단어인데 앵커 시각이 start(5) → 전량 붕괴, 이후 구별 앵커 없음.
    const w = ['a', 'b', 'C'];
    const t = [{ word: 'C', start: 5 }];
    const ws = computeWordStartsAligned(w, 5, 11, t);
    expect(ws[0]).toBe(5);
    expect(ws[1]).toBeGreaterThan(5);
    expect(ws[2]).toBeGreaterThan(ws[1]);
    expect(ws[2]).toBeLessThan(11);
    expect(currentWordIndexFromStarts(ws, 5)).toBe(0);
  });

  // AC3: 재생 진행 시 강조 인덱스가 뒤로 뛰지 않고 단조 증가(문서 정상#4).
  it('should advance the current index monotonically without jumping backward as t increases', () => {
    const ws = computeWordStartsAligned(words, 10, 20, toks);
    let prev = -Infinity;
    for (let t = 10; t <= 15; t += 0.25) {
      const idx = currentWordIndexFromStarts(ws, t);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });

  // AC2 경계: 붕괴 + 후속 앵커/꼬리까지 포함한 전체 배열이 단조 비감소이고 마지막<end(문서 경계#3).
  it('should keep the whole array monotonically non-decreasing within [start, end) with last < end', () => {
    const w = ['w0', 'w1', 'w2', 'A', 'B', 'z']; // z: 마지막 앵커(B) 이후 꼬리 단어.
    const ws = computeWordStartsAligned(w, 10, 20, toks);
    for (let i = 1; i < ws.length; i++) {
      expect(ws[i]).toBeGreaterThanOrEqual(ws[i - 1]);
    }
    expect(ws[ws.length - 1]).toBeLessThan(20);
  });

  // 경계: officialWords 길이 1이면 재분배 대상이 없어 [start] 그대로(문서 경계#4).
  it('should return [start] unchanged when officialWords has length 1', () => {
    const ws = computeWordStartsAligned(['only'], 5, 11, [
      { word: 'only', start: 5 },
    ]);
    expect(ws).toEqual([5]);
  });
});
