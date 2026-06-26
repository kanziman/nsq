# Design System - Spacing & Grid

NSQ Shadowing 웹 애플리케이션의 레이아웃은 여백의 미를 강조하는 **에디토리얼 매거진 레이아웃**을 따릅니다. 정보 밀도를 지나치게 높이기보다, 충분한 여백을 제공하여 텍스트 가독성을 최우선으로 확보합니다.

---

## 1. Spacing Scale (간격 스케일)

모든 컴포넌트의 안여백(padding), 바깥여백(margin), 간격(gap)은 **4px 기본 단위를 기준**으로 설계되었습니다.

| Token     | CSS Variable             | Value (px) | Tailwind Equivalent     | Main Use Case                        |
| :-------- | :----------------------- | :--------- | :---------------------- | :----------------------------------- |
| `xxs`     | `var(--spacing-xxs)`     | `4px`      | `1` / `1.2` (`0.25rem`) | 배지 내부 패딩, 작은 인접 간격       |
| `xs`      | `var(--spacing-xs)`      | `8px`      | `2` (`0.5rem`)          | 태그 간 간격, 글자-아이콘 갭         |
| `sm`      | `var(--spacing-sm)`      | `12px`     | `3` (`0.75rem`)         | 미니 컴포넌트 여백, 세그먼트 간격    |
| `md`      | `var(--spacing-md)`      | `16px`     | `4` (`1rem`)            | 리스트 아이템 간격, 폼 레이블 오프셋 |
| `lg`      | `var(--spacing-lg)`      | `24px`     | `6` (`1.5rem`)          | 코드 블록/슬라이더 내부 패딩         |
| `xl`      | `var(--spacing-xl)`      | `32px`     | `8` (`2rem`)            | 일반 카드 컴포넌트 내부 패딩         |
| `xxl`     | `var(--spacing-xxl)`     | `48px`     | `12` (`3rem`)           | 다크 플레이어 내부, CTA 밴드 패딩    |
| `section` | `var(--spacing-section)` | `96px`     | `24` (`6rem`)           | 메인 섹션 간격, pre-footer 상단 마진 |

---

## 2. Grid & Container System (그리드 & 컨테이너)

화면 배치는 정보의 중요도에 맞춰 대칭 또는 비대칭 그리드를 형성합니다.

- **Max Content Width (최대 너비)**: `1200px` (웹 화면 중앙 정렬)
  - Tailwind 적용: `max-w-6xl mx-auto px-4 md:px-8`
- **12-Column Grid (12컬럼 시스템)**:
  - 기본 레이아웃 배치 시 12컬럼 그리드를 적극 사용합니다.
  - 예: 에피소드 상세 학습 페이지 ➔ **비대칭 2열 배치** (좌측 쉐도잉 리더: 7/12 컬럼 ➔ `lg:col-span-7` 또는 `lg:col-span-8` | 우측 AI 튜터 채팅: 5/12 컬럼 ➔ `lg:col-span-5` 또는 `lg:col-span-4`).
- **Responsive Grid Cards (반응형 카드 배치)**:
  - 에피소드 목록 그리드:
    - 데스크톱: 3-up (`grid-cols-3` / `lg:col-span-4`)
    - 태블릿: 2-up (`grid-cols-2` / `md:col-span-6`)
    - 모바일: 1-up (`grid-cols-1` / `col-span-12`)

---

## 3. Whitespace Philosophy (여백 배치 철학)

1.  **여백을 통한 pacing(페이스 조절)**:
    - 웹 애플리케이션의 각 섹션 밴드 간격은 항상 `section` (`96px`)을 적용하여, 정보가 다닥다닥 붙어 답답하게 느껴지는 현상을 완전히 방지합니다.
2.  **넉넉한 카드 내부 여백**:
    - 콘텐츠 카드 컴포넌트(`Card`)는 내부 안여백으로 최소 `xl` (`32px`)을 적용하여 텍스트의 상하좌우 호흡 간격을 유지합니다.
3.  **오디오 웨이브폼 및 플레이어 공간 분리**:
    - 플레이어 제어부와 오디오 진행바 사이의 세로 여백은 `xxl` (`48px`) 이상을 보장하여 조작 시 손가락/마우스 동선이 겹치지 않게 합니다.
