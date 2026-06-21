---
name: design-system
description: 디자인 시스템 규격 및 가이드라인에 따른 UI 코드 작성을 지원합니다. 사용자가 UI 컴포넌트나 레이아웃(.tsx, .jsx, .css, tailwind)을 작성, 수정, 또는 검토하고자 할 때 반드시 이 스킬을 활성화하여 docs/design-system/ 아래의 모든 디자인 명세를 엄격히 준수하십시오.
---

# Design System Skill

이 스킬은 프로젝트 내에서 UI 관련 작업(컴포넌트 작성, 스타일 적용, Tailwind 클래스 지정 등)을 수행할 때 일관된 디자인 시스템 표준을 보장하기 위한 지침을 담고 있습니다.

## 핵심 요구사항 (Core Guidelines)

1.  **세부 디자인 가이드 문서 참조**:
    - UI 구현 및 스타일링을 수행하기 전에 반드시 [docs/design-system/DESIGN.md](file:///Users/zorba/projects/nsq/docs/design-system/DESIGN.md)와 그 하위 명세서들을 숙지하고 적용해야 합니다.
    - [colors.md](file:///Users/zorba/projects/nsq/docs/design-system/colors.md): 색상 매핑 및 도메인별(오디오, 채팅, 화자) 전용 색상 규격
    - [typography.md](file:///Users/zorba/projects/nsq/docs/design-system/typography.md): 디스플레이 세리프 및 본문 산세리프 폰트 스케일, 줄높이, 자간 원칙
    - [spacing.md](file:///Users/zorba/projects/nsq/docs/design-system/spacing.md): 4px 단위 간격 스케일 및 12컬럼 비대칭 그리드 레이아웃
    - [components/](file:///Users/zorba/projects/nsq/docs/design-system/components): [button.md](file:///Users/zorba/projects/nsq/docs/design-system/components/button.md), [card.md](file:///Users/zorba/projects/nsq/docs/design-system/components/card.md), [input.md](file:///Users/zorba/projects/nsq/docs/design-system/components/input.md), [badge.md](file:///Users/zorba/projects/nsq/docs/design-system/components/badge.md), [modal.md](file:///Users/zorba/projects/nsq/docs/design-system/components/modal.md) 재사용 규격

2.  **하드코딩 금지 (No Hardcoding Values)**:
    - **색상**: 헥사코드(예: `#cc785c`, `#181715`)나 Tailwind 기본 색상(예: `bg-red-500`, `text-blue-600`)을 코드에 직접 하드코딩해서 사용하지 마십시오. 반드시 `colors.md`에 매핑된 CSS Custom Properties 변수나 시맨틱 Tailwind 클래스(`bg-primary`, `bg-canvas`, `text-ink` 등)를 이용해야 합니다.
    - **간격**: `h-[42px]`나 `p-5`와 같이 디자인 스케일을 벗어나는 임의의 간격을 스타일로 사용하지 마십시오. 반드시 `spacing.md`에 명시된 4px 단위 스케일(`xxs`, `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `section` 매핑 변수)을 따라야 합니다.

3.  **컴포넌트 패턴 재사용**:
    - 새로운 UI 버튼, 카드, 입력 필드 등을 독자적으로 구현하기 전에 [components/](file:///Users/zorba/projects/nsq/docs/design-system/components)에 규정된 공통 컴포넌트들의 variants(예: 버튼의 `primary`, `secondaryOnDark`, 카드의 `feature`, `productMockup`)를 최우선적으로 호출하여 재사용해야 합니다.
