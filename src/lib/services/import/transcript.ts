/**
 * 임포트 파이프라인의 transcript(Freakonomics 스크래핑) 단계 모듈.
 * transcriptUrl → transcript.txt 산출.
 *
 * 내부 구현(스크래핑·파싱)은 별도 태스크. 현재는 계약 스텁.
 */
export async function fetchTranscript(
  videoId: string,
  transcriptUrl: string,
): Promise<void> {
  throw new Error('Not implemented');
}
