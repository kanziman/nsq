# Design System - Colors

NSQ Shadowing 웹 애플리케이션의 색상 체계는 **따뜻한 에디토리얼 테마(warm-canvas)**를 기조로 하여, 차갑고 기업적인 느낌을 주는 일반적인 AI 도구들과 차별화됩니다.

---

## 1. Core Palette (기본 색상)

| Name                      | Hex Code  | Description                                                |
| :------------------------ | :-------- | :--------------------------------------------------------- |
| **Canvas**                | `#faf9f5` | 전체 페이지의 기본 바탕색 (순수 흰색이 아닌 따뜻한 크림톤) |
| **Primary (Coral)**       | `#cc785c` | 시그니처 코랄 컬러. 주요 CTA 및 강조 요소에 사용           |
| **Primary Active**        | `#a9583e` | 코랄 버튼의 Hover/Pressed 상태 색상                        |
| **Secondary**             | `#efe9de` | 연한 크림 채우기 색상. 카드 및 보조 영역에 사용            |
| **Surface Dark**          | `#181715` | 오디오 플레이어, 코드 윈도우 등 어두운 크롬 영역의 바탕색  |
| **Surface Dark Elevated** | `#252320` | 다크 영역 내부의 카드 및 돌출 컴포넌트 색상                |
| **Surface Dark Soft**     | `#1f1e1b` | 다크 영역 내부의 코드 블록 배경 등 가장 어두운 보조 색상   |
| **Ink**                   | `#141413` | 모든 헤드라인 및 일반 텍스트의 기본 검정(off-black) 색상   |
| **Hairline**              | `#e6dfd8` | 크림 서피스용 1px 테두리 및 구분선 색상                    |

---

## 2. Semantic Mapping (의미별 매핑)

시맨틱 토큰은 CSS Custom Properties 및 Tailwind 설정을 통해 일관되게 바인딩됩니다.

### Primary

- `--primary`: `#cc785c` (Primary Coral)
- `--primary-foreground`: `#ffffff` (On Primary)

### Secondary & Surface

- `--background`: `var(--canvas)` (`#faf9f5`)
- `--foreground`: `var(--ink)` (`#141413`)
- `--card`: `var(--surface-card)` (`#efe9de`)
- `--card-foreground`: `var(--ink)` (`#141413`)
- `--popover`: `var(--surface-card)` (`#efe9de`)
- `--popover-foreground`: `var(--ink)` (`#141413`)
- `--accent`: `var(--surface-soft)` (`#f5f0e8`)
- `--accent-foreground`: `var(--ink)` (`#141413`)

### Border & Input

- `--border`: `var(--hairline)` (`#e6dfd8`)
- `--input`: `var(--hairline)` (`#e6dfd8`)
- `--ring`: `var(--primary)` (`#cc785c`)

### State Colors (상태 및 피드백)

- `--success`: `#5db872` (완료 상태, 통과)
- `--warning`: `#d4a017` (경고, 주의)
- `--danger` / `--destructive`: `#c64545` (실패, 삭제, 에러)

---

## 3. Domain Specific Colors (도메인 특화 색상)

### A. 화자별 고유 색상 (Speaker Colors)

각 팟캐스트 발화 문장 및 화자 이름 표시용 색상입니다.

- **DUCKWORTH (Angela)**: `#5db8a6` (Accent Teal)
- **DUBNER (Steven)**: `#cc785c` (Primary Coral)
- **BOTH (Angela & Steven)**: `#e8a55a` (Accent Amber)
- **NARRATOR (성우/내레이션)**: `#6c6a64` (Muted Grey)

### B. 오디오 플레이어 & 웨이브폼

- `--color-waveform-active`: `var(--primary)` (#cc785c) - 오디오 재생이 완료된 부분의 파형 색상
- `--color-waveform-inactive`: `var(--surface-dark-elevated)` (#252320) - 아직 재생되지 않은 부분의 파형 색상
- `--color-slider-track`: `var(--surface-dark-soft)` (#1f1e1b) - 타임라인 배경 색상

### C. AI 튜터 채팅 (Tutor Chat)

- `--color-chat-user-bg`: `var(--surface-soft)` (#f5f0e8) - 사용자 말풍선 배경
- `--color-chat-tutor-bg`: `var(--canvas)` (#faf9f5) - AI 튜터 말풍선 배경 (테두리 `border-hairline` 노출)
