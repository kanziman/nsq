import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = process.argv[2];

if (!filePath) {
  process.exit(0);
}

// -------------------------------------------------------------
// globals.css @theme의 --color-* 토큰을 유효 색상 토큰으로 수집
// (존재하지 않는 Tailwind 색상 유틸 = surface-base 같은 오타/미정의 토큰 검출용)
// -------------------------------------------------------------
function loadThemeColorTokens() {
  const validColorTokens = new Set([
    'transparent',
    'current',
    'inherit',
    'white',
    'black',
    'none',
  ]);
  const colorRoots = new Set();
  try {
    const themeCssPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../src/app/globals.css',
    );
    const themeContent = fs.readFileSync(themeCssPath, 'utf-8');
    const re = /--color-([a-z0-9-]+)\s*:/gi;
    let m;
    while ((m = re.exec(themeContent)) !== null) {
      const token = m[1].toLowerCase();
      validColorTokens.add(token);
      colorRoots.add(token.split('-')[0]);
    }
  } catch {
    // globals.css를 못 읽으면 토큰 검사를 건너뛴다 (colorRoots 비어있음).
  }
  return { validColorTokens, colorRoots };
}

const { validColorTokens, colorRoots } = loadThemeColorTokens();

// 색상을 받는 Tailwind 유틸 프리픽스 (사이즈/간격 유틸과 겹치는 경우는
// "프로젝트 색상 패밀리 루트"로 한 번 더 걸러 오탐을 방지한다.)
const COLOR_UTIL_RE =
  /^(?:[\w-]+:)*(bg|text|border(?:-[trblxyse])?|ring|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|placeholder|shadow)-(.+)$/;

// 검사 대상 확장자 필터링
const ext = path.extname(filePath);
if (!['.tsx', '.ts', '.jsx', '.js', '.css'].includes(ext)) {
  process.exit(0);
}

try {
  if (!fs.existsSync(filePath)) {
    process.exit(0);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const warnings = [];

  // 허용되는 Spacing 픽셀 스케일 (docs/design-system/spacing.md 기반)
  const ALLOWED_SPACING_PX = [4, 8, 12, 16, 24, 32, 48, 96];

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 주석 줄 스킵
    if (
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*')
    ) {
      return;
    }

    // 1. 하드코딩 색상값 검사 (#xxxxxx, rgb(...), hsl(...))
    // 단, CSS 파일의 CSS Custom Property 정의부나 @theme 선언부는 예외 허용
    let checkColor = true;
    if (
      ext === '.css' &&
      (line.includes('--') || line.includes('@theme') || line.includes(':root'))
    ) {
      checkColor = false;
    }

    if (checkColor) {
      // Hex color check (e.g. #cc785c, exclude symbol references or markdown headings in comments)
      const hexMatch = line.match(
        /#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
      );
      if (hexMatch) {
        hexMatch.forEach((color) => {
          warnings.push(
            `Hardcoded HEX color found: "${color}". 색상은 반드시 CSS 변수로만 사용해야 합니다 (하드코딩 금지).`,
          );
        });
      }

      // RGB / HSL check
      if (line.match(/rgb\([^)]+\)/gi)) {
        warnings.push(
          `Hardcoded RGB color found. 색상은 반드시 CSS 변수로만 사용해야 합니다 (하드코딩 금지).`,
        );
      }
      if (line.match(/hsl\([^)]+\)/gi)) {
        warnings.push(
          `Hardcoded HSL color found. 색상은 반드시 CSS 변수로만 사용해야 합니다 (하드코딩 금지).`,
        );
      }
    }

    // 2. 임의의 spacing 값 검사 (e.g. Tailwind p-[15px], w-[30px], or inline style padding: '15px')
    const spacingMatch = line.match(
      /(?:p|m|w|h|gap|space|top|bottom|left|right|translate|inset)-[\[]([^\]]+)[\]]/g,
    );
    if (spacingMatch) {
      spacingMatch.forEach((match) => {
        const valMatch = match.match(/-[\[]([^\]]+)[\]]/);
        if (valMatch) {
          const val = valMatch[1];
          // px 단위 검사 (예: 15px)
          if (val.endsWith('px')) {
            const num = parseInt(val.replace('px', ''), 10);
            if (!ALLOWED_SPACING_PX.includes(num)) {
              warnings.push(
                `Arbitrary spacing value found: "${match}". Spacing must be one of [${ALLOWED_SPACING_PX.join(', ')}] px (see spacing.md).`,
              );
            }
          } else if (!isNaN(Number(val))) {
            const num = Number(val);
            if (!ALLOWED_SPACING_PX.includes(num)) {
              warnings.push(
                `Arbitrary spacing value found: "${match}". Spacing must be one of [${ALLOWED_SPACING_PX.join(', ')}] px (see spacing.md).`,
              );
            }
          }
        }
      });
    }

    // inline style spacing check (e.g. padding: '15px' or margin: 10)
    const inlineStyleMatch = line.match(
      /(?:padding|margin|gap|width|height|top|bottom|left|right)\s*:\s*['"`]?(\d+)(px)?['"`]?/gi,
    );
    if (inlineStyleMatch) {
      inlineStyleMatch.forEach((match) => {
        const numMatch = match.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          // 0이나 100% 같은 값 제외를 위해 0 초과 스케일만 검사
          if (num > 0 && !ALLOWED_SPACING_PX.includes(num)) {
            warnings.push(
              `Hardcoded inline style spacing found: "${match}". Spacing must be one of [${ALLOWED_SPACING_PX.join(', ')}] px.`,
            );
          }
        }
      });
    }

    // 3. 미정의 색상 토큰 검사 (globals.css @theme에 없는 색상 유틸)
    if (colorRoots.size > 0) {
      const candidates = line.match(/[a-zA-Z][\w:/.[\]-]*/g) || [];
      candidates.forEach((cls) => {
        const mm = cls.match(COLOR_UTIL_RE);
        if (!mm) return;
        let token = mm[2];
        // 임의값(bg-[...]) / 변수 참조는 검사 제외
        if (token.startsWith('[')) return;
        // 투명도 수정자 제거 (예: surface-card/60 → surface-card)
        token = token.split('/')[0];
        const root = token.split('-')[0];
        // 프로젝트 색상 패밀리에 속한 유틸만 검사 → 사이즈/간격 유틸 오탐 방지
        if (!colorRoots.has(root)) return;
        if (!validColorTokens.has(token)) {
          warnings.push(
            `Undefined color token: "${cls}". '${token}'은(는) globals.css @theme에 정의되지 않은 색상 토큰입니다 (오타/미정의 토큰 확인).`,
          );
        }
      });
    }
  });

  if (warnings.length > 0) {
    console.error(`\n⚠️  [Design System Violation] in ${filePath}:`);
    warnings.forEach((warn) => console.error(`   - ${warn}`));
    console.error(`Please fix these to conform to the design system rules.\n`);
  }
} catch (error) {
  // Silent fail to prevent CLI crash
}

process.exit(0);
