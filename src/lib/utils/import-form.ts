/**
 * 임포트 폼 클라이언트 검증.
 */

// 공백 제외 비어있지 않고 http(s) 형태인지.
function isHttpUrl(value: string): boolean {
  const v = value.trim();
  return v !== '' && /^https?:\/\//i.test(v);
}

export function isSubmittable(
  youtubeUrl: string,
  transcriptUrl: string,
): boolean {
  return isHttpUrl(youtubeUrl) && isHttpUrl(transcriptUrl);
}
