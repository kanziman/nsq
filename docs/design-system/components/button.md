# Component - Button

`Button` 컴포넌트는 사용자의 상호작용을 유도하는 가장 핵심적인 요소입니다. 에디토리얼 테마에 맞추어 그림자가 없는 플랫한 색상 블록과 가는 테두리(`border-hairline`)를 특징으로 합니다.

---

## 1. Specifications (기본 규격)

- **높이 (Height)**: `40px` (기본 사이즈)
- **둥글기 (Border Radius)**: `8px` (`--radius-md`)
- **서체 (Typography)**: `Inter` (sans-serif), 14px (`body-sm`/`button`), 굵기 500 (`font-medium`)
- **줄높이 (Line Height)**: `1`

---

## 2. Style Variants (스타일 변형)

### A. Primary Coral (주요 행동 버튼)

- **배경색**: `--primary` (`#cc785c`)
- **글자색**: `--on-primary` (`#ffffff`)
- **상태 피드백**:
  - _Hover/Active_: `bg-primary-active` (`#a9583e`)
  - _Disabled_: `bg-primary-disabled` (`#e6dfd8`), 글자색 `text-muted`
- **Tailwind 클래스**: `bg-primary text-primary-foreground hover:bg-primary-active active:bg-primary-active disabled:bg-primary-disabled disabled:text-muted`

### B. Secondary Outline (보조 행동 버튼)

- **배경색**: `--canvas` (`#faf9f5`)
- **글자색**: `--ink` (`#141413`)
- **테두리**: `1px border-hairline` (`#e6dfd8`)
- **상태 피드백**:
  - _Hover/Active_: `bg-secondary` (`#efe9de`)
- **Tailwind 클래스**: `bg-canvas text-ink border border-hairline hover:bg-secondary active:bg-secondary`

### C. Secondary On Dark (다크 서피스용 보조 버튼)

- **배경색**: `--surface-dark-elevated` (`#252320`)
- **글자색**: `--on-dark` (`#faf9f5`)
- **상태 피드백**:
  - _Hover/Active_: `opacity-90`
- **Tailwind 클래스**: `bg-surface-dark-elevated text-on-dark hover:opacity-90`

### D. Text Link (텍스트 형태 버튼)

- **배경색**: 투명 (`bg-transparent`)
- **글자색**: `--ink` (`#141413`)
- **상태 피드백**:
  - _Hover/Active_: `underline underline-offset-4`
- **Tailwind 클래스**: `bg-transparent text-ink hover:underline underline-offset-4`

### E. Icon Circular (원형 아이콘 버튼)

- **배경색**: `--canvas` (`#faf9f5`)
- **글자색**: `--ink` (`#141413`)
- **테두리**: `1px border-hairline` (`#e6dfd8`)
- **둥글기**: `rounded-full` (원형)
- **크기**: 가로 `36px` $\times$ 세로 `36px`
- **Tailwind 클래스**: `w-9 h-9 flex items-center justify-center bg-canvas text-ink border border-hairline rounded-full p-0`

---

## 3. Size Scales (크기 스케일)

| Size Token  | Height                 | Padding (Left/Right) | Font Size |
| :---------- | :--------------------- | :------------------- | :-------- |
| **sm**      | `36px`                 | `12px` (`px-3`)      | 12px      |
| **default** | `40px`                 | `20px` (`px-5`)      | 14px      |
| **lg**      | `44px`                 | `32px` (`px-8`)      | 16px      |
| **icon**    | `36px` $\times$ `36px` | `0`                  | -         |
