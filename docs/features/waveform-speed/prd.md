# PRD: 오디오 파형 시각화 + 세밀한 속도 조절 + 네비게이션 + CJK 폰트

## 개요

쉐도잉 플레이어의 학습 UX를 개선하는 4가지 기능을 하나의 피처로 묶어 구현한다.

1. **세그먼트 파형 시각화** — 현재 재생 문장의 오디오 파형을 바(bar) 형태로 시각화
2. **세밀한 속도 조절** — 프리셋 버튼 → 슬라이더+±버튼 (0.05 단위)
3. **에피소드 보드 복귀 버튼** — 제목 좌측 ← 버튼
4. **CJK Serif 폰트 폴백** — 일본어 에피소드 제목의 serif 폰트 개선

---

## 사용자 스토리

### US1: 파형으로 발화 구간 파악

> 학습자로서, 현재 문장의 파형을 보고 발화 패턴(강세·쉼)을 시각적으로 파악하여 쉐도잉 정확도를 높이고 싶다.

### US2: 세밀한 속도 조절

> 학습자로서, 0.05 단위로 속도를 세밀하게 조절하여 내 수준에 맞는 최적 속도로 쉐도잉하고 싶다.

### US3: 에피소드 목록 복귀

> 학습자로서, 플레이어에서 에피소드 목록으로 한 번에 돌아갈 수 있는 버튼이 필요하다.

### US4: 일본어 제목 가독성

> 학습자로서, 일본어 에피소드 제목이 디자인 시스템의 serif 스타일에 맞게 보이길 원한다.

---

## 기술 결정 (ADR) — 3가지 아키텍처 시나리오 비교

### 비교 기준표

| 기준                    | A안: Canvas 파형 + 독립 훅                                                                                     | B안: SVG 파형 + 통합 훅                                                                | C안: DOM(div) 파형 + 유틸 분리                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **1. 데이터 구조**      | `useWaveform` 훅이 `AudioBuffer` → `Float32Array` bars 반환. 별도 `WaveformCanvas` 컴포넌트가 Canvas 2D로 렌더 | `useWaveform` 훅이 bars 반환. `WaveformSVG`가 `<rect>` 엘리먼트로 렌더                 | `computeWaveformBars()` 순수 함수가 bars 반환. `<div>` 바를 React로 렌더                         |
| **2. API 레이어 변경**  | 없음 (클라이언트 전용)                                                                                         | 없음                                                                                   | 없음                                                                                             |
| **3. 상태관리 변경**    | `useShadowingPlayer`에 `audioBuffer` 상태 추가. `useWaveform(audioBuffer, segment)` 별도 훅                    | `useShadowingPlayer`에 `audioBuffer` + `bars` 상태 통합                                | `useShadowingPlayer`에 `audioBuffer` 상태 추가. bars 계산은 컴포넌트 `useMemo`                   |
| **4. 핵심 동작**        | AudioContext로 1회 디코딩 → 세그먼트 전환 시 구간 샘플 추출 → Canvas requestAnimationFrame 렌더                | 동일한 디코딩·추출 → SVG rect로 React 리렌더                                           | 동일한 디코딩·추출 → div로 React 리렌더                                                          |
| **5. 컴포넌트 구조**    | `useWaveform.ts` (훅) + `WaveformCanvas.tsx` (Canvas) + `SpeedSlider.tsx` + `BackButton.tsx`                   | `useWaveform.ts` (훅) + `WaveformSVG.tsx` (SVG) + `SpeedSlider.tsx` + `BackButton.tsx` | `waveform-utils.ts` (순수 함수) + `Waveform.tsx` (div 바) + `SpeedSlider.tsx` + `BackButton.tsx` |
| **6. 기존 패턴 일관성** | Canvas는 프로젝트 내 미사용. 새로운 렌더링 패턴 도입                                                           | SVG도 프로젝트 내 미사용이나 JSX 친화적                                                | ✅ 프로젝트의 React + Tailwind CSS div 패턴과 완전 일치                                          |
| **7. 테스트 용이성**    | Canvas는 jsdom에서 모킹 필요. 시각 테스트 어려움                                                               | SVG는 DOM 쿼리로 테스트 가능                                                           | ✅ div는 DOM 쿼리 + 기존 vitest/RTL 패턴 그대로 사용                                             |

### 추가 고려사항

| 항목               | A안 (Canvas)                                | B안 (SVG)                 | C안 (DOM/div)                   |
| ------------------ | ------------------------------------------- | ------------------------- | ------------------------------- |
| 바 100개 기준 성능 | ✅ 최적 (GPU 가속)                          | ⚠️ 양호 (DOM 노드 100개)  | ⚠️ 양호 (DOM 노드 100개)        |
| 반응형 리사이즈    | ResizeObserver + Canvas 재그리기            | ✅ viewBox 자동 스케일    | ResizeObserver + 바 개수 재계산 |
| 접근성(a11y)       | ⚠️ Canvas는 스크린리더 불가. aria 보조 필요 | ✅ SVG role="img" + title | ✅ div role="img" + aria-label  |
| 클릭 상호작용      | Canvas 좌표 계산 필요                       | ✅ rect onClick 가능      | ✅ div onClick 가능             |
| 번들 사이즈        | 최소                                        | 최소                      | 최소                            |

---

> **[GATE 2] ✅ C안(DOM/div 파형 + 유틸 분리) 선택 확정**

### ADR (Architecture Decision Record)

#### Context

쉐도잉 플레이어에 세그먼트 단위 파형을 추가하되, 기존 프로젝트의 React + Tailwind CSS 패턴과 일관성을 유지하면서 테스트 용이성을 확보해야 한다.

#### Decision — C안: DOM(div) 파형 + 순수 유틸 분리

- 파형 바를 `<div>`로 렌더링하며 Tailwind CSS로 스타일링한다.
- `computeWaveformBars(audioBuffer, start, end, barCount)` 순수 함수를 `waveform-utils.ts`에 분리한다.
- `useAudioBuffer(src)` 훅이 Web Audio API 디코딩을 담당하고, 컴포넌트에서 `useMemo`로 bars를 계산한다.

#### Alternatives (기각 사유)

- **A안(Canvas)**: 프로젝트에 Canvas 사용 전례 없음. jsdom 테스트 모킹 부담. 접근성 보조 별도 구현 필요. 바 100개 수준에서 Canvas의 GPU 가속 이점은 미미.
- **B안(SVG)**: JSX 친화적이지만 프로젝트에 SVG 컴포넌트 렌더링 패턴 전례 없음. viewBox 자동 스케일이 장점이나 C안의 ResizeObserver도 간단.

#### Consequences

- **장점**: 기존 vitest/RTL 테스트 패턴 완전 호환. Tailwind 유틸리티로 즉시 스타일링. 접근성(role, aria) 기본 지원. 순수 함수 분리로 단위 테스트 용이.
- **단점**: 바 수가 200개 이상 대폭 증가하면 DOM 노드 성능 문제 가능(현 스코프에서는 해당 없음). 컨테이너 리사이즈 시 바 개수 재계산 필요.

---

## Out of Scope (이번 MVP에서 구현하지 않는 것)

1. 전체 에피소드 파형 뷰 (오버뷰)
2. 파형 드래그 구간 선택
3. 속도 프리셋 퀵 버튼 (슬라이더 옆 0.5x / 1x / 1.5x 등)
4. 파형 줌 인/아웃
5. 서버 사전 계산 파형 데이터 (waveform.json)
6. wavesurfer.js 등 외부 파형 라이브러리 도입
7. 한국어(ko) serif 폰트 (`Noto Serif KR`) — ja만 대상

---

## 용어 정의

(spec-fixed.md §용어 정의 동기화)

| 용어           | 정의                                                             |
| -------------- | ---------------------------------------------------------------- |
| 파형(Waveform) | 오디오 신호의 진폭을 세로 바(bar) 형태로 시각화한 UI 요소        |
| 세그먼트 파형  | 현재 재생 중인 세그먼트(문장) 범위의 파형                        |
| 속도 슬라이더  | 0.05 단위로 재생 속도를 조절하는 range input + ±버튼 복합 컨트롤 |
| 바(Bar)        | 파형을 구성하는 개별 세로 막대                                   |
| 에피소드 보드  | 에피소드 목록 페이지(`/`)                                        |
