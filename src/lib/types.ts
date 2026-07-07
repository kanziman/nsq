/** 에피소드 콘텐츠 언어. 부재 시 'en' 간주(기존 에피소드 하위호환). */
export type LanguageCode = 'en' | 'ja';

export interface Segment {
  id: string;
  start: number; // 초 단위 시작 시간
  end: number; // 초 단위 종료 시간
  // 화자 키. NSQ는 DUCKWORTH/DUBNER/BOTH/NARRATOR이지만, 멀티 팟캐스트 지원을 위해
  // 임의 문자열을 허용한다(표시 색·이름은 resolveSpeaker가 처리).
  speaker: string;
  text: string;
  translation?: string;
  /** 공식 단어별 시작 시각(초). 있으면 단어 강조에 사용, 없으면 균등분할 폴백. */
  wordStarts?: number[];
  /** 실제 첫 발화 단어 시각(초). 직접 클릭/이동 탐색 대상(경계 대신). 없으면 start 폴백. */
  audioStart?: number;
}

export interface EpisodeMeta {
  id: string; // YouTube Video ID
  title: string;
  duration: number; // 재생시간(초)
  youtubeUrl: string;
  transcriptUrl?: string;
  thumbnailUrl?: string;
  addedAt: string;
  language?: LanguageCode;
}

export type RetryStep =
  | 'all'
  | 'transcript'
  | 'subtitles'
  | 'sentences'
  | 'translation';

export interface ImportRequestBody {
  youtubeUrl: string; // 필수
  transcriptUrl?: string; // 선택 — 부재 시 자막 전용(subtitle-only) 모드
  language?: LanguageCode; // 선택, 기본 'en'
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
    | 'building_sentences'
    | 'translating'
    | 'completed'
    | 'failed';
  progress: number; // 0 ~ 100
  currentStep: string;
  error?: string;
  matchRate?: number; // alignment 산출 품질(0~1). completed·저matchRate failed에만 존재.
  youtubeUrl?: string; // 재시도 재접수용. 접수(POST) 시 기록, 모든 상태 쓰기에서 보존.
  transcriptUrl?: string; // 재시도 재접수용.
  language?: LanguageCode; // 재시도 재접수용. 모든 상태 쓰기에서 보존.
  updatedAt: string;
}

export interface Episode extends EpisodeMeta {
  importState?: ImportState;
}

/** VTT 큐(문장 이전의 표시 단위). 자막 전용 모드의 세그먼트 원천. */
export interface VttCue {
  start: number; // 초
  end: number; // 초
  text: string;
}

// Patience-diff 정합을 위한 부가 타입 정의
export interface VttToken {
  word: string;
  start: number;
  end: number;
}

export interface Sentence {
  text: string;
  speaker: string;
}
