# Component - Input

`Input` 컴포넌트는 사용자의 텍스트 입력을 수집하는 기본 폼 요소입니다. 에디토리얼 테마의 따뜻한 캔버스 배경과 조화를 이루도록 은은한 배경색과 세밀한 활성/비활성 포커스 피드백을 탑재하고 있습니다.

---

## 1. Specifications (기본 규격)

- **높이 (Height)**: `40px`
- **둥글기 (Border Radius)**: `8px` (`--radius-md`)
- **배경색 (Background)**: `--canvas` (`#faf9f5`)
- **글자색 (Text)**: `--ink` (`#141413`)
- **테두리 (Border)**: `1px border-hairline` (`#e6dfd8`)

---

## 2. Interactive States (상태 피드백)

### A. Default (대기 상태)

- 아무런 링이나 강조가 없는 기본 상태입니다.
- _Placeholder_: `--muted-soft` (`#8e8b82`) 색상의 텍스트
- **Tailwind 클래스**: `bg-canvas border border-hairline text-ink placeholder:text-muted-soft`

### B. Focus (입력 활성 상태)

- 사용자가 인풋 필드를 클릭/탭하여 입력 포커스가 들어온 상태입니다.
- _Style_: 테두리가 사라지거나 굵어지는 대신, 시그니처 코랄 컬러의 미세한 아웃라인 링(`ring-1 ring-primary`)이 활성화됩니다.
- **Tailwind 클래스**: `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary`

### C. Disabled (비활성 상태)

- 입력이 불가능하게 잠긴 상태입니다.
- _Style_: 불투명도가 낮아지고 마우스 커서가 차단 상태로 변경됩니다.
- **Tailwind 클래스**: `disabled:cursor-not-allowed disabled:opacity-50`

---

## 3. Recommended Spacings (레이블 및 간격 규칙)

- **Label Layout (폼 레이블 오프셋)**: 인풋 창 상단 또는 좌측에 텍스트 레이블을 배치할 때, 간격은 항상 `--spacing-xs` (`8px`) 또는 `--spacing-sm` (`12px`)를 유지하여 정보의 소속감을 드러내 줍니다.
