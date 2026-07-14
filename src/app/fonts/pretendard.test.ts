import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * 이슈 #148 — 전역 폰트 Pretendard 전환의 회귀 가드.
 *
 * 스택 문자열을 눈으로 검증하기 어렵고, 과거에 (1) CDN 의존, (2) next/font가
 * --font-sans를 덮어써 Pretendard가 죽는 문제가 반복됐다. 소스를 직접 읽어 검증한다.
 */

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const globals = readFileSync(root('../globals.css'), 'utf-8');
const fontCss = readFileSync(root('./pretendard.css'), 'utf-8');

/** @theme 블록에서 CSS 변수 하나의 값을 뽑아낸다. */
function themeVar(name: string): string {
  const theme = globals.slice(globals.indexOf('@theme'));
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(theme);
  if (!m) throw new Error(`--${name} not found in @theme`);
  return m[1].replace(/\s+/g, ' ').trim();
}

describe('#148 Pretendard 전역 폰트', () => {
  // AC1: 앱 전역 기본 폰트가 Pretendard (CSS 변수 경유)
  it('AC1: --font-sans의 첫 서체가 Pretendard다', () => {
    const sans = themeVar('font-sans');
    const first = sans.split(',')[0].trim();
    expect(first).toBe("'Pretendard Variable'");
  });

  it('AC1: Latin이 Pretendard보다 먼저 잡히는 서체(Inter 등)가 앞에 없다', () => {
    const sans = themeVar('font-sans');
    // Inter를 앞에 두면 Latin 본문이 영영 Pretendard로 안 그려진다.
    expect(sans).not.toMatch(/inter/i);
  });

  // 세리프 자리는 전부 한글이라 Noto Serif KR이 그리고, 이 폰트가 가나·한자까지 덮는다.
  // JP 세리프를 다시 실으면 한 글자도 렌더하지 않으면서 preload만 잡아먹는다.
  it('도달 불가능한 JP 세리프를 싣지 않는다', () => {
    const layout = readFileSync(root('../layout.tsx'), 'utf-8');
    expect(layout).not.toContain('Noto_Serif_JP');
    expect(themeVar('font-serif')).not.toContain('--font-serif-jp');
  });

  // AC2: 일본어가 폴백으로 정상 렌더 (Pretendard에 한자가 0자이므로 필수)
  it('AC2: 한자를 덮는 JP 폴백이 스택에 있다', () => {
    const sans = themeVar('font-sans');
    const jpFallbacks = [
      'Hiragino Sans',
      'Noto Sans JP',
      'Yu Gothic',
      'Meiryo',
    ];
    const present = jpFallbacks.filter((f) => sans.includes(f));
    expect(present.length).toBeGreaterThan(0);
  });

  it('AC2: JP 폴백이 generic sans-serif보다 앞에 온다', () => {
    const sans = themeVar('font-sans');
    expect(sans.indexOf('Hiragino Sans')).toBeLessThan(
      sans.indexOf('sans-serif'),
    );
  });

  // AC3: 셀프호스트 — 오프라인·CSP에서 안정 로드
  it('AC3: globals.css에 외부 CDN @import가 없다', () => {
    expect(globals).not.toMatch(/@import\s+url\(\s*['"]?https?:/i);
    expect(globals).not.toContain('jsdelivr');
  });

  it('AC3: @font-face가 셀프호스트 경로만 참조한다', () => {
    const urls = [...fontCss.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(
      (m) => m[1],
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.startsWith('/fonts/pretendard/')).toBe(true);
    }
  });

  it('AC3: 참조된 woff2가 public에 실제로 존재한다', () => {
    const urls = [...fontCss.matchAll(/url\(\s*'([^']+)'\s*\)/g)].map(
      (m) => m[1],
    );
    const missing = urls.filter(
      (u) => !existsSync(root(`../../../public${u}`)),
    );
    expect(missing).toEqual([]);
  });

  it('AC3: unicode-range 동적 서브셋이라 필요한 청크만 내려받는다', () => {
    const faces = fontCss.match(/@font-face/g) ?? [];
    const ranges = fontCss.match(/unicode-range:/g) ?? [];
    expect(faces.length).toBe(ranges.length);
    expect(faces.length).toBeGreaterThan(1);
  });
});
