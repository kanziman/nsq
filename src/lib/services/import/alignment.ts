/**
 * 임포트 파이프라인의 alignment(자막↔대본 정합) 단계 모듈.
 * subtitle.en.vtt + transcript.txt → segments.json 산출, matchRate 반환.
 *
 * 내부 구현(정합 알고리즘)은 별도 태스크. 현재는 계약 스텁.
 */
export async function alignTranscript(
  videoId: string,
): Promise<{ matchRate: number }> {
  throw new Error('Not implemented');
}
