# Component - Badge

`Badge` 컴포넌트는 메타데이터, 학습 진행 상태, 혹은 화자(Speaker)의 이름 정보를 짧게 요약하여 강조하는 인라인 칩 형태의 요소입니다.

---

## 1. Specifications (기본 규격)

- **둥글기 (Border Radius)**: `9999px` (`--radius-pill`) - 완전한 알약(Pill) 모양
- **안여백 (Padding)**: 상하 `4px` $\times$ 좌우 `12px` (`px-3 py-1`)
- **서체 (Typography)**: `Inter` (sans-serif), 13px (`caption`) 또는 12px (`caption-uppercase`)
- **줄높이 (Line Height)**: `1.4`

---

## 2. Style Variants (스타일 변형)

### A. Pill Badge (기본 크림 배지)

- **배경색**: `--surface-card` (`#efe9de`) - 은은하고 따뜻한 크림 배경
- **글자색**: `--ink` (`#141413`)
- **서체 스타일**: 13px (`caption`), `font-medium`
- **Tailwind 클래스**: `bg-surface-card text-ink text-xs font-medium`
- **주 사용처**: 일반 카테고리 태그, 북마크 태그, 비강조 상태 정보

### B. Coral Badge (코랄 강조 배지)

- **배경색**: `--primary` (`#cc785c`) - 시그니처 코랄 배경
- **글자색**: `--on-primary` (`#ffffff`)
- **서체 스타일**: 12px (`caption-uppercase`), `font-semibold`, 대문자(`uppercase`), 넓은 자간(`tracking-wider` - `1.5px`) 적용
- **Tailwind 클래스**: `bg-primary text-primary-foreground text-[12px] font-semibold uppercase tracking-wider`
- **주 사용처**: "NEW" 태그, "Focus Mode" 등 활성화된 핵심 상태 표시

---

## 3. Speaker Badge Extension (화자 배지 응용)

세그먼트 정합 화면이나 대화창에서 화자를 구분하기 위해 아래와 같이 화자별 배경/텍스트 클래스 조합을 활용해 배지를 커스텀 적용할 수 있습니다.

- **Duckworth 배지**: `bg-accent-teal/10 text-accent-teal` (Teal 배경 10% + Teal 글자색)
- **Dubner 배지**: `bg-primary/10 text-primary` (Coral 배경 10% + Coral 글자색)
- **Both 배지**: `bg-accent-amber/10 text-accent-amber` (Amber 배경 10% + Amber 글자색)
