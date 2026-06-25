export interface Segment {
  id: string;
  start: number; // 초 단위 시작 시간
  end: number; // 초 단위 종료 시간
  speaker: 'DUCKWORTH' | 'DUBNER' | 'BOTH' | 'NARRATOR';
  text: string;
  translation?: string;
  words?: {
    word: string;
    start: number;
    end: number;
  }[];
}

export interface EpisodeMeta {
  id: string; // YouTube Video ID
  title: string;
  duration: number; // 재생시간(초)
  youtubeUrl: string;
  transcriptUrl?: string;
  thumbnailUrl?: string;
  addedAt: string;
}

export type RetryStep = 'all' | 'transcript' | 'subtitles';

export interface ImportRequestBody {
  youtubeUrl: string; // 필수
  transcriptUrl: string; // 필수
  retryStep?: RetryStep; // 선택 (Issue 1에서는 409 분기 우회에만 사용)
}

export interface ImportState {
  videoId: string;
  status:
    | 'idle'
    | 'downloading'
    | 'processing_subtitles'
    | 'processing_transcript'
    | 'aligning'
    | 'translating'
    | 'completed'
    | 'failed';
  progress: number; // 0 ~ 100
  currentStep: string;
  error?: string;
  updatedAt: string;
}

export interface Episode extends EpisodeMeta {
  importState?: ImportState;
}

// Patience-diff 정합을 위한 부가 타입 정의
export interface VttToken {
  word: string;
  start: number;
  end: number;
}

export interface Sentence {
  text: string;
  speaker: 'DUCKWORTH' | 'DUBNER' | 'BOTH' | 'NARRATOR';
}
