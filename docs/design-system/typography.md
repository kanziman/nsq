# Design System - Typography

NSQ Shadowing 웹 애플리케이션의 타이포그래피는 **잡지나 신문과 같은 에디토리얼(Editorial)** voice를 띱니다. 디스플레이 헤드라인용 세리프(Serif) 서체와 모던하고 가독성이 뛰어난 본문용 산세리프(Sans) 서체의 조화를 통해 인문학적이고 정돈된 분위기를 자아냅니다.

---

## 1. Font Family (서체 정의)

| Type                | Target Fonts                                   | Fallback Stack                                                                       | Use Case                                       |
| :------------------ | :--------------------------------------------- | :----------------------------------------------------------------------------------- | :--------------------------------------------- |
| **Display (Serif)** | **Cormorant Garamond** (Tiempos Headline 대체) | `Noto Serif KR, Noto Serif JP, Garamond, "Hiragino Mincho ProN", serif`              | h1, h2, h3, 에피소드 제목, 히어로 헤드라인     |
| **Body (Sans)**     | **Pretendard** (Inter 대체, #148)              | `"Hiragino Sans", "Noto Sans JP", "Yu Gothic", Meiryo, -apple-system, …, sans-serif` | 본문 러닝 텍스트, 네비게이션, 버튼, 입력 폼    |
| **Code (Mono)**     | **JetBrains Mono**                             | `ui-monospace, monospace`                                                            | 단어 발음 타임코드, 설정 변수, 코드 하이라이트 |

폰트 스택은 `src/app/globals.css`의 `@theme` 블록(`--font-sans` / `--font-serif` / `--font-mono`)이
**단일 진실 공급원**입니다. 컴포넌트나 `tailwind.config.ts`에서 폴백을 중복 정의하지 마세요.

### 1-1. Pretendard 셀프호스트 (#148)

- **동적 서브셋**으로 셀프호스트합니다: `public/fonts/pretendard/` 에 `unicode-range`로 분할된
  woff2 92개를 벤더링하고, `src/app/fonts/pretendard.css`가 `@font-face`를 선언합니다.
  브라우저는 **실제로 쓰이는 청크만** 내려받습니다(초기 약 35KB 수준).
- **외부 CDN(jsdelivr 등)에 의존하지 않습니다.** 오프라인·엄격한 CSP 환경에서도 안정적으로 로드됩니다.

### 1-2. ⚠️ 일본어와 한자 폴백

Pretendard는 **Latin + Hangul + 가나(184/192자)** 를 덮지만 **한자(U+4E00–9FFF)는 0자**입니다.
따라서 일본어 문장에서 **가나는 Pretendard, 한자는 JP 폴백 서체**(Hiragino Sans → Noto Sans JP →
Yu Gothic → Meiryo)로 그려지며, **한 문장 안에서 서체가 섞이는 것은 의도된 동작**입니다.
두부(tofu)는 발생하지 않습니다. JP 폴백을 스택에서 제거하면 한자가 전부 깨지므로 절대 지우지 마세요.

---

## 2. Type Hierarchy & Scales (폰트 계층 스케일)

| Token               | Size              | Weight | Line Height | Letter Spacing | Main Use Case                        |
| :------------------ | :---------------- | :----- | :---------- | :------------- | :----------------------------------- |
| `display-xl`        | `64px` (4rem)     | `400`  | `1.05`      | `-1.5px`       | 메인 웰컴 홈 헤드라인                |
| `display-lg`        | `48px` (3rem)     | `400`  | `1.1`       | `-1px`         | 섹션 대표 타이틀                     |
| `display-md`        | `36px` (2.25rem)  | `400`  | `1.15`      | `-0.5px`       | 서브 섹션 타이틀                     |
| `display-sm`        | `28px` (1.75rem)  | `400`  | `1.2`       | `-0.3px`       | 카드 내부 헤드라인, 팝업 제목        |
| `title-lg`          | `22px` (1.375rem) | `500`  | `1.3`       | `0`            | 중요 타이틀 라벨                     |
| `title-md`          | `18px` (1.125rem) | `500`  | `1.4`       | `0`            | 기능 카드 타이틀, 단락 요약문        |
| `title-sm`          | `16px` (1rem)     | `500`  | `1.4`       | `0`            | 세그먼트 화자 라벨, 리스트 제목      |
| `body-md`           | `16px` (1rem)     | `400`  | `1.55`      | `0`            | 스크립트 영어 원문, 일반 단락 텍스트 |
| `body-sm`           | `14px` (0.875rem) | `400`  | `1.55`      | `0`            | 번역 텍스트, 부가 설명문             |
| `caption`           | `13px` (0.812rem) | `500`  | `1.4`       | `0`            | 팝업 사전 내용, 미세 캡션            |
| `caption-uppercase` | `12px` (0.75rem)  | `500`  | `1.4`       | `1.5px`        | "NEW" 배지 태그, 소분류 카테고리     |
| `code`              | `14px` (0.875rem) | `400`  | `1.6`       | `0`            | 코드 윈도우 내용, 타임코드 표시      |
| `button`            | `14px` (0.875rem) | `500`  | `1.0`       | `0`            | 일반 버튼 텍스트                     |
| `nav-link`          | `14px` (0.875rem) | `500`  | `1.4`       | `0`            | 네비게이션 및 메뉴 링크              |

---

## 3. Editorial Typography Principles (에디토리얼 서체 원칙)

1.  **Bold(굵게) 디스플레이의 지양**:
    - `display-xl`부터 `display-sm`까지의 세리프 디스플레이 서체는 절대로 bold(굵기 700 이상) 처리를 하지 않습니다. Regular `400` 혹은 `500` 굵기를 유지해야 클래식하고 품격 있는 지면 인쇄물 느낌을 낼 수 있습니다.
2.  **음수 자간(Negative Letter Spacing) 필수화**:
    - 디스플레이 계열 폰트는 글자 크기가 커질수록 반드시 음수 자간(letter-spacing `-0.3px` ~ `-1.5px`)을 설정합니다. 자간 조정이 누락될 경우 세리프 서체의 응집력이 깨져 브랜드 디자인을 해치게 됩니다.
3.  **가독성을 위한 줄높이(Line Height)**:
    - 본문용 `body-md` 및 `body-sm` 서체는 읽기 편하도록 `1.55`배의 충분한 줄높이를 보장합니다. 스크립트를 줄단위로 쉐도잉할 때 시각적 피로감을 크게 낮추어 줍니다.
