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
