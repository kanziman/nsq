/**
 * 에피소드 오디오의 스트리밍 URL을 조립한다 (#158, R2 하이브리드 배포).
 *
 * 로컬·프로덕션 모두 R2 공개 URL을 사용한다. base가 비어 있으면(로컬 미설정)
 * 경고 후 루트 상대 경로를 반환한다 — 재생은 불가하나 빌드·타입은 안전하다.
 *
 * @param episodeId - 유튜브 videoId
 * @param baseUrl   - R2 공개 base URL (기본: process.env.NEXT_PUBLIC_R2_BASE_URL)
 * @returns 오디오 파일 URL
 */
export function buildAudioUrl(
  episodeId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_R2_BASE_URL ?? '',
): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');

  if (normalizedBase === '') {
    console.warn(
      '[buildAudioUrl] NEXT_PUBLIC_R2_BASE_URL이 설정되지 않아 오디오를 재생할 수 없습니다. ' +
        '.env.local에 R2 base URL을 설정하세요.',
    );
    return `/${episodeId}/audio.mp3`;
  }

  return `${normalizedBase}/${episodeId}/audio.mp3`;
}
