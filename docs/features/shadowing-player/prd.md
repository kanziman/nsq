# 쉐도잉 플레이어 MVP (shadowing-player) PRD

이 문서는 `/episodes/[id]` 쉐도잉 플레이어 화면을 설계·개발하기 위한 단일 기준 문서(PRD)이다.
[spec-fixed.md](./spec-fixed.md)에서 확정한 요구사항·용어와 동기화한다.

---

## 1. 개요

홈 대시보드에서 임포트 완료(completed)된 에피소드 카드를 클릭하면 진입하는 쉐도잉 플레이어 페이지를 구축한다. HTML5 Audio 기반으로 세그먼트 단위 재생을 추적하고, 화자별 색상 스크립트를 실시간으로 따라가며(전체 모드), 특정 세그먼트를 반복·녹음해 발음을 교정한다(집중 모드). 기능은 3개 수직 슬라이스로 점진 전달한다.

---

## 2. 사용자 스토리

- **학습자로서**, completed 에피소드를 클릭해 플레이어로 진입하고, ▶ 한 번으로 오디오를 연속 청취하며 현재 문장이 자동 강조·스크롤되는 스크립트를 따라가고 싶다. (전체 모드)
- **학습자로서**, 특정 문장(또는 범위)을 A-B 반복하고 속도를 낮추며, 화자를 필터링하고 번역 blur를 토글해 효율적으로 학습하고 싶다.
- **학습자로서**, 집중 모드로 전환해 한 문장을 반복 들으며 직접 녹음하고 바로 들어보며 내 발음을 비교하고 싶다.

---

## 3. 아키텍처 3개 시나리오 제안 및 비교

오디오 엔진은 세 안 모두 `audio.ts`(HTMLAudioElement 래퍼)로 동일 추상화하며, 차이는 **재생 상태를 컴포넌트 간에 공유하는 방식**이다.

### 안 A — 커스텀 훅(`useShadowingPlayer`) + props (채택)

Server Component가 `meta`+`Segment[]`를 로드해 Client `ShadowingPlayer`에 props로 전달하고, 재생 상태(재생/정지, `currentSegmentIndex`, 모드, 필터, A-B 반복)는 단일 커스텀 훅 `useShadowingPlayer`에 응집한다. 자식 컴포넌트는 상태·콜백을 props로 받는다. React 내장 API만 사용.

### 안 B — React Context(`PlayerProvider`)

동일하게 로드하되 재생 상태를 `PlayerContext`로 노출하고 자식은 `useContext`로 소비한다. props drilling은 줄지만 고빈도 `timeupdate`에서 전체 consumer 리렌더 위험이 있다.

### 안 C — 상태관리 라이브러리(zustand)

재생 상태를 zustand store로 관리하고 selector 구독으로 리렌더를 최소화한다. 최적화엔 유리하나 신규 의존성이 추가되고 기존(React 내장) 패턴과 이질적이다.

---

### 3-1. 아키텍처 비교표 (7가지 고정 기준)

| #     | 기준             | 안 A (커스텀 훅 + props)                                                             | 안 B (Context Provider)               | 안 C (zustand)                       |
| :---- | :--------------- | :----------------------------------------------------------------------------------- | :------------------------------------ | :----------------------------------- |
| **1** | 데이터 구조      | RSC가 `meta`+`Segment[]` props 전달, 상태는 훅 내 `useState`/`useRef`                | 동일 로드, 상태는 Context value       | 동일 로드, 상태는 store              |
| **2** | API 레이어 변경  | 신규 `GET /api/episodes/[id]/segments` 1개                                           | 동일                                  | 동일                                 |
| **3** | 상태관리 변경    | 커스텀 훅 1개, 외부 의존 0                                                           | `PlayerProvider`+Context 1개          | store 모듈 + **zustand 의존성 추가** |
| **4** | 핵심 동작        | 훅이 audio manager 소유, `timeupdate`→`currentSegmentIndex`, 모드/필터/AB 제어       | Context로 동일 상태/액션 노출         | store action/selector                |
| **5** | 컴포넌트 구조    | `ShadowingPlayer`(훅) ➔ `AudioControls`·`ScriptView`·`FocusPanel`·`TutorPanel(골격)` | 동일 + Provider 래퍼, 자식 useContext | 동일, 자식 store 직접 구독           |
| **6** | 기존 패턴 일관성 | 매우 높음 (`useImportStatus` 등 기존 훅 패턴·ADR-003 철학과 동일)                    | 보통 (Context 전역상태 선례 없음)     | 낮음 (신규 패키지, 이질적)           |
| **7** | 테스트 용이성    | 높음 (훅 단위 `vi.useFakeTimers` + 자식 props 격리)                                  | 보통 (Provider 래핑 필요)             | 보통 (store 모킹/리셋)               |

---

## 4. Out of Scope

이번 `shadowing-player` MVP에서 **구현하지 않는 비범위 사항**:

1. **오디오 파형(Waveform) 시각화**: Canvas/Web Audio 실시간 파형은 Post-MVP. MVP는 프로그레스 바로 대체.
2. **AI 튜터 채팅 실제 기능**: 우측 패널은 레이아웃 골격만. 메시지 송수신·튜터 API 연동은 별도 피처.
3. **녹음 데이터 영속화**: 서버 파일시스템/IndexedDB 저장은 제외. 녹음은 브라우저 메모리에서만 즉시 재생.
4. **import 파이프라인 수정**: `segments.json`에 `words`를 굽거나 forced-alignment로 단어 타이밍을 정밀화하는 작업은 제외(런타임 VTT 파싱으로 격리).
5. **학습 진도·이력·통계 저장**: 재생 위치 기억, 학습 기록, 통계 대시보드 제외.
6. **다중 에피소드 플레이리스트 연속재생**: 한 에피소드 내 재생만. 에피소드 간 자동 넘김 제외.
7. **모바일 전용 제스처**: CSS 반응형만 준수, 스와이프 등 터치 전용 인터랙션 제외.

---

## 5. 기술 결정 (ADR-004)

### ADR-004: 커스텀 훅(`useShadowingPlayer`) + props 기반 재생 상태 관리

**Status**: Accepted (2026-06-29)

**Context**

- 플레이어는 `timeupdate`(~250ms) 기반으로 현재 세그먼트 추적, 스크립트 자동 강조·스크롤, A-B 반복, 속도, 화자 필터(자동 스킵), 집중 모드, 메모리 녹음 등 다수의 상호 연관 상태를 다룬다.
- `AudioControls`·`ScriptView`·`FocusPanel` 등 여러 자식이 동일 재생 상태를 공유해야 한다.
- 프로젝트는 episodes-list·import 전반에서 React 내장 `useState`/`useEffect` + 커스텀 훅 패턴으로 통일되어 있다(ADR-003).

**Decision**

- Server Component `src/app/episodes/[id]/page.tsx`가 `meta`+`Segment[]`를 로드하고 completed·segments 검증 후 Client `ShadowingPlayer`에 props 전달한다(미충족 시 `redirect('/')`).
- 재생 상태와 오디오 제어 로직을 단일 커스텀 훅 `useShadowingPlayer`에 응집한다. 훅은 `audio.ts`(HTMLAudioElement 래퍼)를 `useRef`로 소유하고, `timeupdate`로 `currentSegmentIndex`를 산출하며 모드/필터/AB 반복/경계 park를 제어한다.
- 자식 컴포넌트는 상태와 콜백을 props로 받아 렌더링만 담당한다. 무거운 `ScriptView`는 `React.memo` + 현재 인덱스 prop으로 고빈도 리렌더를 격리한다.

**Alternatives**

- **안 B (React Context)** — 거부. Context value가 `timeupdate`마다 변하면 모든 consumer가 리렌더되어 수백 세그먼트 스크립트에서 성능 저하가 우려된다. value 분할·메모로 회피 가능하나 복잡도가 커지고, 프로젝트에 전역 Context 상태 선례가 없어 일관성도 떨어진다.
- **안 C (zustand)** — 거부. selector 구독으로 리렌더 최적화엔 유리하나, 신규 패키지 의존성을 추가해 번들·빌드 일관성을 해치고 기존 React 내장 패턴과 이질적이다. MVP 규모에선 과한 선택이다.

**Consequences**

- **장점 (+)**: 신규 의존성 0으로 번들·일관성 유지. 상태가 한 훅에 응집돼 `vi.useFakeTimers()`로 재생·경계·필터 로직을 단위 테스트로 견고히 검증 가능. 기존 훅 패턴과 정합.
- **단점/한계 (-)**: 컴포넌트 트리가 깊어지면 props 전달이 다소 늘어난다. 고빈도 `timeupdate` 리렌더는 `React.memo`·인덱스 prop 분리로 직접 관리해야 하며, 이를 게을리하면 스크립트 렌더 성능이 저하될 수 있다(테스트·프로파일링으로 보완).

---

## 6. 용어 정의

[spec-fixed.md](./spec-fixed.md) §10 용어 정의 목록과 완전히 부합하며 동기화하여 관리한다. (세그먼트, 전체/집중 모드, A-B 구간 반복, 경계 park, 화자 필터, 단어 레벨 하이라이트, VttToken, 화자 키, completed)
