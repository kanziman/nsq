import fs from 'fs';
import path from 'path';

const filePath = process.argv[2];

if (!filePath) {
  process.exit(0);
}

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
            `Hardcoded HEX color found: "${color}". Use colors.md tokens instead.`,
          );
        });
      }

      // RGB / HSL check
      if (line.match(/rgb\([^)]+\)/gi)) {
        warnings.push(
          `Hardcoded RGB color found. Use colors.md tokens instead.`,
        );
      }
      if (line.match(/hsl\([^)]+\)/gi)) {
        warnings.push(
          `Hardcoded HSL color found. Use colors.md tokens instead.`,
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
