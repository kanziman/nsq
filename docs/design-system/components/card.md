# Component - Card

`Card` 컴포넌트는 정보를 그룹화하여 시각적 구획을 나누는 기본 컨테이너입니다. 에디토리얼 테마의 페이싱 리듬을 주기 위해 입체적인 그림자를 최소화하고, 배경색 대조와 미세 테두리(`border-hairline`)를 주로 사용합니다.

---

## 1. Specifications (기본 규격)

- **둥글기 (Border Radius)**: `12px` (`--radius-lg`)
- **그림자 (Shadow)**: 없음 (`shadow-none`)
- **안여백 (Padding)**: 기본 `32px` (`--spacing-xl` / `p-8`)
  - 코드 윈도우 및 소형 정보 카드는 `24px` (`--spacing-lg` / `p-6`) 적용

---

## 2. Style Variants (스타일 변형)

### A. Default Card (기본 카드)

- **배경색**: `--background` (`#faf9f5`)
- **글자색**: `--foreground` (`#141413`)
- **테두리**: `1px border-hairline` (`#e6dfd8`)
- **Tailwind 클래스**: `bg-card text-card-foreground border border-hairline`

### B. Feature Card (연한 크림 카드)

- **배경색**: `--surface-card` (`#efe9de`) - 일반 캔버스보다 한 단계 어두운 따뜻한 크림 채우기
- **글자색**: `--ink` (`#141413`)
- **테두리**: `1px border-hairline` (`#e6dfd8`)
- **Tailwind 클래스**: `bg-surface-card text-ink border border-hairline`
- **주 사용처**: 에피소드 카드 그리드, 학습 결과 리포트, 스크립트 리더 패널

### C. Product Mockup Card (다크 네이비 카드)

- **배경색**: `--surface-dark` (`#181715`) - 몰입감 있는 다크 존 연출
- **글자색**: `--on-dark` (`#faf9f5`)
- **테두리**: 없음
- **Tailwind 클래스**: `bg-surface-dark text-on-dark`
- **주 사용처**: 쉐도잉 오디오 플레이어 패널

### D. Code Window Card (코드 윈도우 프레임)

- **배경색**: `--surface-dark` (`#181715`)
- **글자색**: `--on-dark` (`#faf9f5`)
- **테두리**: `1px border-surface-dark-elevated` (`#252320`)
- **내부 코드 영역 배경**: `--surface-dark-soft` (`#1f1e1b`)로 추가 구획 분할
- **Tailwind 클래스**: `bg-surface-dark text-on-dark border border-surface-dark-elevated`
- **주 사용처**: 개발 모드 디버깅, 혹은 특정 텍스트 원문/설정 코딩 뷰어
