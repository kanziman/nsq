/**
 * YouTube URL에서 videoId를 추출한다.
 * 지원 포맷: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID 등
 * @returns 추출된 videoId, 추출 불가 시 null (throw 하지 않음 → 호출부가 400으로 변환)
 */
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);

export function extractVideoId(url: string): string | null {
  if (typeof url !== 'string' || url.trim() === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return VIDEO_ID.test(id) ? id : null;
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const v = parsed.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) return v;

    const match = parsed.pathname.match(
      /^\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/,
    );
    if (match) return match[1];
  }

  return null;
}
