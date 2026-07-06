import { describe, it, expect } from 'vitest';
import { SPEAKER_COLORS, resolveSpeaker } from './speakers';

describe('resolveSpeaker', () => {
  it('[정상] 알려진 NSQ 화자는 고정 매핑을 반환', () => {
    expect(resolveSpeaker('DUCKWORTH')).toEqual(SPEAKER_COLORS.DUCKWORTH);
    expect(resolveSpeaker('DUBNER').name).toBe('Steven');
  });

  it('[정상] 알려지지 않은 화자는 키를 이름으로 쓰고 팔레트 스타일을 붙인다', () => {
    const style = resolveSpeaker('HOST_A');
    expect(style.name).toBe('HOST_A');
    expect(typeof style.textClass).toBe('string');
    expect(style.textClass).toMatch(/^text-/);
    expect(style.bgClass).toMatch(/^bg-/);
    expect(style.borderClass).toMatch(/^border-/);
  });

  it('[정상] 같은 키는 항상 같은 색을 배정(결정적)', () => {
    expect(resolveSpeaker('GUEST_B')).toEqual(resolveSpeaker('GUEST_B'));
  });
});
