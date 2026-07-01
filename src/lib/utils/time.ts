/**
 * 초 → "mm:ss" (3600초 이상이면 "h:mm:ss"). 음수·NaN·Infinity → "00:00".
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * "HH:MM:SS.mmm" | "MM:SS.mmm" (쉼표 소수점 허용) → 초(number).
 * 형식 불일치 시 throw.
 */
export function parseVttTimecode(timecode: string): number {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(
    timecode.trim(),
  );
  if (!m) {
    throw new Error(`Invalid VTT timecode: ${timecode}`);
  }
  const [, hh, mm, ss, ms] = m;
  const hours = hh ? Number(hh) : 0;
  return (
    hours * 3600 +
    Number(mm) * 60 +
    Number(ss) +
    Number(ms.padEnd(3, '0')) / 1000
  );
}
