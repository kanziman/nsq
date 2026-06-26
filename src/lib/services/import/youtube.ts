/**
 * 임포트 파이프라인의 YouTube(yt-dlp) 단계 모듈.
 * download → audio.mp3, subtitle → subtitle.en.vtt 산출.
 *
 * 내부 구현(yt-dlp 호출)은 별도 태스크. 현재는 계약 스텁.
 */
export async function downloadAudio(
  videoId: string,
  youtubeUrl: string,
): Promise<void> {
  throw new Error('Not implemented');
}

export async function fetchSubtitle(
  videoId: string,
  youtubeUrl: string,
): Promise<void> {
  throw new Error('Not implemented');
}
