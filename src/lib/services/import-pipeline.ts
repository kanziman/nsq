import { RetryStep } from '../types';

/**
 * 임포트 파이프라인 오케스트레이터.
 * Issue 1에서는 호출 계약만 존재하는 no-op 스텁. 실제 단계 구현은 Issue 2.
 *
 * TDD Red 단계 스텁: 구현은 후속 Green 단계에서 작성한다.
 */
export async function runImportPipeline(
  videoId: string,
  urls: { youtubeUrl: string; transcriptUrl: string; retryStep?: RetryStep },
): Promise<void> {
  throw new Error('Not implemented');
}
