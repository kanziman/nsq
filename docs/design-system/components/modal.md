# Component - Modal & Popup

`Modal` 및 `Popup` 컴포넌트는 사용자의 현재 흐름을 방해하지 않으면서 부가적인 정보(예: 단어 사전 검색 결과)를 보여주거나 핵심 의사결정을 유도할 때 사용하는 레이어 요소입니다.

---

## 1. Specifications (기본 규격)

- **둥글기 (Border Radius)**: `12px` (`--radius-lg`)
- **배경색 (Background)**: `--canvas` (`#faf9f5`)
- **테두리 (Border)**: `1px border-hairline` (`#e6dfd8`)
- **그림자 (Shadow)**: `shadow-md` 또는 `shadow-lg` (둥근 카드 요소 중 예외적으로 깊이감을 제공하기 위해 그림자 사용)
- **최대 너비 (Max Width)**:
  - _사전 팝업 (DictionaryPopup)_: `max-w-sm` (`384px`)
  - _일반 안내 모달_: `max-w-md` (`448px`)

---

## 2. Component Types (컴포넌트 유형)

### A. Dictionary Inline Popup (간이 사전 팝업)

스크립트 리더에서 영어 단어 클릭 시 마우스 커서 또는 클릭된 단어 주변에 동적으로 노출되는 레이어입니다.

- **위치 지정**: 절대 좌표 (`absolute` 또는 `fixed` z-index 50)
- **안여백 (Padding)**: `24px` (`--spacing-lg` / `p-6`) - 정보를 요약하여 좁은 공간에 알차게 보여주기 위해 패딩을 다소 축소
- **레이아웃 구성**:
  - Header: 단어와 발음 기호(또는 TTS 스피커 아이콘)
  - Content: 품사별 뜻 정의와 예문 (가독성을 위해 스페이싱 `sm` 적용)
- **Tailwind 클래스**: `absolute z-50 max-w-sm bg-canvas border border-hairline shadow-md rounded-lg p-6`

### B. Standard Confirmation Modal (표준 확인 모달)

에피소드 삭제 확인 등 전체 화면의 흐름을 제어하는 오버레이 형태의 모달입니다.

- **위치 지정**: 화면 정중앙 (`fixed inset-0 flex items-center justify-center z-50`)
- **오버레이 배경**: `bg-surface-dark/40 backdrop-blur-[2px]` (플레이어의 다크 톤을 활용해 몰입감 및 배경 차단 효과 유도)
- **안여백 (Padding)**: `32px` (`--spacing-xl` / `p-8`)
- **상호작용 버튼 배치**: 우측 하단 배치 (`flex justify-end gap-3`)
  - 취소: `Secondary Outline` 버튼
  - 확인/삭제: `Primary Coral` 또는 `Destructive Danger` 버튼

---

## 3. Interaction & Animation (인터랙션 및 애니메이션)

1.  **Click Outside (외부 클릭 시 닫기)**:
    - 사용자가 모달 외부 영역을 클릭할 경우 자연스럽게 모달이 닫혀야 합니다.
2.  **Transition 효과**:
    - 스무스한 등장감을 위해 진입 시 `duration-200 ease-out scale-95 opacity-0` 상태에서 `scale-100 opacity-100`으로의 트랜지션 애니메이션을 입히는 것을 권장합니다.
