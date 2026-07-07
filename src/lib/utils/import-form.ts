/**
 * 임포트 폼 클라이언트 검증.
 */
import type { LanguageCode } from '@/lib/types';

// 공백 제외 비어있지 않고 http(s) 형태인지.
function isHttpUrl(value: string): boolean {
  const v = value.trim();
  return v !== '' && /^https?:\/\//i.test(v);
}

/**
 * 제출 가능 여부 (#124: 대본 URL 선택화 + 언어 규칙).
 * - youtubeUrl: http(s) 필수.
 * - en: 대본이 비어있거나(자막 전용) http(s)여야 한다.
 * - ja: 대본 정합 미지원 — 대본이 비어있어야 한다(폼에서 입력 자체를 숨김).
 */
export function isSubmittable(
  youtubeUrl: string,
  transcriptUrl: string,
  language: LanguageCode = 'en',
): boolean {
  if (!isHttpUrl(youtubeUrl)) return false;
  const transcript = transcriptUrl.trim();
  if (language === 'ja') return transcript === '';
  return transcript === '' || isHttpUrl(transcript);
}
