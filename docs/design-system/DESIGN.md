---
version: alpha
name: Claude-design-analysis
description: A warm-canvas editorial interface for Anthropic's Claude product. The system anchors on a tinted cream canvas with serif display headlines, warm coral CTAs, and dark navy product surfaces. Brand voltage comes from the cream/coral pairing.
---

# Design System - Overview & Principles

NSQ Shadowing 웹 애플리케이션의 디자인 시스템은 **따뜻한 에디토리얼 테마(warm-canvas)**를 핵심 기조로 삼고 있습니다. 대다수의 AI 제품들이 사용하는 차가운 블루/블랙 테마를 탈피하여, 아날로그 인쇄 잡지와 같은 서정적이고 가독성 높은 인터페이스를 지향합니다.

이 문서는 시스템 전반을 지배하는 핵심 디자인 철학과 각 세부 시스템의 아키텍처를 소개하는 **최상위 상위레벨 가이드**입니다.

---

## 1. Core Design Principles (핵심 디자인 원칙)

### 🌿 Warmth & Humanity (인간적인 따뜻함)

AI의 기계적인 인상을 걷어내고 인간적인 온기를 전하기 위해, 순수한 흰색(#ffffff)과 무채색 회색의 사용을 전면 통제합니다. 은은하게 물들여진 따뜻한 크림톤 캔버스(`canvas`)와 클래식한 세리프 서체의 조화로 사용자가 학습을 진행하는 동안 지면 책을 읽는 듯한 인지적 편안함을 선사합니다.

### 🔳 Contrast & Pacing (면 분할의 리듬감)

입체적인 그림자(elevation shadow)를 통한 깊이감 연출을 최소화하고, 대신 **라이트(크림) 서피스와 다크(네이비) 서피스의 극적인 블록 대비**를 통해 화면의 호흡과 영역을 전환합니다.

- **Light canvas zone**: 높은 텍스트 가독성을 요하는 스크립트 리더, 기사 단락 영역.
- **Dark navy zone**: 몰입감 있는 조작이 필요한 오디오 재생 컨트롤 및 코드 윈도우 영역.

### 📖 Editorial Typography (지면 가독성)

크기가 큰 표제어에는 세리프(Serif) 서체의 Regular(400) 두께와 음수 자간(negative letter spacing)을 필수 적용하여 견고하고 밀도 높은 심미성을 확보합니다. 반면 본문은 휴머니스트 산세리프(Sans) 서체의 충분한 줄높이(line-height 1.55)를 보장하여 장시간 쉐도잉 학습 시 눈의 피로를 최소화합니다.

---

## 2. Design System Architecture (시스템 구조)

각 영역별 구체적이고 정량적인 수치는 분리된 세부 문서를 참조하여 개발을 진행합니다.

- **[Colors Guide (색상 시스템)](file:///Users/zorba/projects/nsq/docs/design-system/colors.md)**
  - 기본 크림-코랄 팔레트 헥사코드 및 시맨틱 맵핑(Background, Primary, Border 등) 규격
  - 화자(Speaker) 고유 색상 및 오디오 웨이브폼/채팅 도메인 특화 컬러 정의
- **[Typography Guide (글꼴 시스템)](file:///Users/zorba/projects/nsq/docs/design-system/typography.md)**
  - Cormorant Garamond, Inter, JetBrains Mono 폰트 패밀리 구성
  - `display-xl`부터 `code`까지의 14단계 사이즈/줄높이/자간 스케일 계층 구조
- **[Spacing & Grid Guide (여백 및 그리드)](file:///Users/zorba/projects/nsq/docs/design-system/spacing.md)**
  - 4px 단위의 간격 스케일 (`xxs` ~ `section`)
  - 12컬럼 비대칭 레이아웃 구성 및 에디토리얼 여백 철학
- **[Component Library (재사용 컴포넌트 패턴)](file:///Users/zorba/projects/nsq/docs/design-system/components)**
  - 둥글기(Border Radius) 매핑 및 5대 핵심 컴포넌트 규격
  - **[Button 명세](file:///Users/zorba/projects/nsq/docs/design-system/components/button.md)** / **[Card 명세](file:///Users/zorba/projects/nsq/docs/design-system/components/card.md)** / **[Input 명세](file:///Users/zorba/projects/nsq/docs/design-system/components/input.md)** / **[Badge 명세](file:///Users/zorba/projects/nsq/docs/design-system/components/badge.md)** / **[Modal 명세](file:///Users/zorba/projects/nsq/docs/design-system/components/modal.md)**

---

## 3. General Do's & Don'ts (권장 및 금지 사항)

### Do (권장 사항)

- **크림 캔버스를 기본 floor로 사용**: 모든 화면의 근원적인 배경은 항상 크림 캔버스여야 합니다.
- **디스플레이 타이틀에 음수 자간 적용**: 세리프 헤드라인 사용 시 글자 크기에 맞는 음수 자간(`letter-spacing` `-0.3px` ~ `-1.5px`)을 반드시 적용합니다.
- **시그니처 코랄의 제한적 배치**: 코랄 컬러는 주요 CTA 순간이나 특정 강조 배지에만 엄격히 격리해 배치하여 시각적 voltage를 보존합니다.

### Don't (금지 사항)

- **순수 흰색(#ffffff) 또는 차가운 회색 배경 사용 금지**: 브랜드 아이덴티티인 warm-canvas 톤이 훼손됩니다.
- **세리프 타이틀 굵게(Bold) 처리 금지**: 세리프 서체의 굵기를 700 이상으로 굵게 지정하면 에디토리얼의 고전적인 분위기가 훼손됩니다.
- **연속된 동일 서피스 밴드 사용 금지**: 크림 캔버스 밴드 뒤에 곧바로 동일한 크림 캔버스 카드를 중복 배치하기보다, 다크 또는 소프트 크림 카드를 통해 스페이스에 페이싱 리듬을 부여합니다.
