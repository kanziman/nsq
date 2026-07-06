export const SPEAKER_COLORS = {
  DUCKWORTH: {
    name: 'Angela',
    color: '#5db8a6',
    textClass: 'text-accent-teal',
    bgClass: 'bg-accent-teal/10',
    borderClass: 'border-accent-teal/20',
  },
  DUBNER: {
    name: 'Steven',
    color: '#cc785c',
    textClass: 'text-primary',
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/20',
  },
  BOTH: {
    name: 'Both',
    color: '#e8a55a',
    textClass: 'text-accent-amber',
    bgClass: 'bg-accent-amber/10',
    borderClass: 'border-accent-amber/20',
  },
  NARRATOR: {
    name: 'Narrator',
    color: '#6c6a64',
    textClass: 'text-muted',
    bgClass: 'bg-muted/10',
    borderClass: 'border-muted/20',
  },
} as const;

export type SpeakerKey = keyof typeof SPEAKER_COLORS;

export interface SpeakerStyle {
  name: string;
  color: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

// 알려지지 않은 화자(다른 팟캐스트)에 결정적으로 배정할 색 팔레트.
// 새 하드코딩 색을 만들지 않도록 기존 SPEAKER_COLORS 스타일을 재사용한다.
const FALLBACK_PALETTE: Omit<SpeakerStyle, 'name'>[] = Object.values(
  SPEAKER_COLORS,
).map(({ name: _name, ...style }) => style);

// 화자 키를 안정적으로 팔레트 인덱스에 매핑하기 위한 결정적 해시.
function hashSpeakerKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * 화자 키 → 표시 스타일. 알려진 화자(NSQ)는 고정 매핑을 쓰고,
 * 그 외 임의 화자는 키를 이름으로 쓰며 팔레트에서 결정적으로 색을 배정한다.
 * (멀티 팟캐스트: segment.speaker가 임의 문자열이어도 안전하게 색을 얻는다.)
 */
export function resolveSpeaker(key: string): SpeakerStyle {
  if (Object.prototype.hasOwnProperty.call(SPEAKER_COLORS, key)) {
    return SPEAKER_COLORS[key as SpeakerKey];
  }
  const palette =
    FALLBACK_PALETTE[hashSpeakerKey(key) % FALLBACK_PALETTE.length];
  return { name: key, ...palette };
}
