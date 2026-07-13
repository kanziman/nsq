# 이슈 목록: 오디오 파형 + 속도 조절 + 네비게이션 + CJK 폰트

## 의존성 순서

```
#1 CJK Serif 폰트 ──┐
#2 복귀 버튼 ────────┤ (모두 독립)
#3 속도 슬라이더 ────┘
        ↓
#4 세그먼트 파형 시각화 (#3 이후 — AudioControls 동일 파일 수정)
```

---

## Issue #1: CJK Serif 폰트 폴백

**제목**: [waveform-speed] CJK Serif 폰트 폴백 (`Noto Serif JP`)

**설명**:
현재 `--font-serif`가 Latin 전용(`Cormorant Garamond`)이라 일본어 에피소드 제목이 시스템 기본 serif로 폴백된다.
`Noto Serif JP`를 Google Fonts로 로드하고 폰트 스택에 추가하여 일본어 제목의 가독성을 개선한다.

**수정 파일**:

- `src/app/globals.css` — `--font-serif` 폰트 스택에 `'Noto Serif JP'`, `'Yu Mincho'` 추가
- `src/app/layout.tsx` — `next/font/google`로 `Noto Serif JP` (weight 400, 700) 로드

**Acceptance Criteria**:

- AC1: Given 일본어 에피소드(`language: 'ja'`)가 존재할 때, When 에피소드 플레이어 페이지를 열면, Then 에피소드 제목(`<h2 class="font-serif">`)이 Noto Serif JP로 렌더링된다.
- AC2: Given 영어 에피소드가 존재할 때, When 에피소드 플레이어 페이지를 열면, Then 제목이 기존과 동일하게 Cormorant Garamond로 렌더링된다 (regression 없음).
- AC3: Given AI Tutor 헤더(`AI Tutor`)일 때, When 페이지 로드 시, Then 영문 텍스트는 Cormorant Garamond로 정상 렌더링된다.

---

## Issue #2: 에피소드 보드 복귀 버튼

**제목**: [waveform-speed] 에피소드 보드 복귀 버튼 (← 네비게이션)

**설명**:
플레이어 상단 에피소드 제목 좌측에 에피소드 목록 페이지(`/`)로 돌아가는 뒤로가기 버튼을 추가한다.

**수정 파일**:

- `src/components/player/shadowing-player.tsx` — 제목 좌측에 `<Link href="/">` + ArrowLeft 아이콘 추가

**Acceptance Criteria**:

- AC1: Given 에피소드 플레이어 페이지에 있을 때, When 제목 좌측의 ← 버튼을 클릭하면, Then 에피소드 목록 페이지(`/`)로 이동한다.
- AC2: Given 오디오가 재생 중일 때, When ← 버튼을 클릭하면, Then 재생이 중단되고 에피소드 목록으로 이동한다 (페이지 전환으로 자동 정리).
- AC3: Given ← 버튼이 렌더링될 때, When 스크린리더가 읽으면, Then `aria-label="에피소드 목록으로"`가 읽힌다.

---

## Issue #3: 속도 슬라이더 (0.05 단위)

**제목**: [waveform-speed] 프리셋 버튼 → 슬라이더+±버튼 속도 조절 (0.05 단위)

**설명**:
기존 고정 프리셋 버튼 6개(`[0.5, 0.75, 1, 1.25, 1.5, 2]`)를 슬라이더 + ±스텝 버튼 복합 컨트롤로 교체한다.
속도 수치 텍스트 클릭 시 1.0x 리셋, 슬라이더 더블클릭 시에도 1.0x 리셋.
키보드 단축키(+/-)도 0.05 단위로 변경.

**수정 파일**:

- [NEW] `src/components/player/SpeedSlider.tsx` — 슬라이더+±버튼+속도 표시 복합 컴포넌트
- [NEW] `src/components/player/SpeedSlider.test.tsx` — 컴포넌트 테스트
- `src/components/player/AudioControls.tsx` — 프리셋 버튼 영역을 `<SpeedSlider>` 로 교체
- `src/components/player/AudioControls.test.tsx` — 프리셋 관련 테스트 갱신
- `src/lib/utils/audio.ts` — `PLAYBACK_RATE_PRESETS` 제거 또는 deprecated, `SPEED_STEP = 0.05` 추가
- `src/components/player/shadowing-player.tsx` — `stepPlaybackRate` 로직을 0.05 산술로 변경
- `src/hooks/useKeyboardShortcuts.ts` — (변경 없음, 이미 콜백 위임)

**Acceptance Criteria**:

- AC1: Given 플레이어가 렌더링될 때, When 속도 조절 영역을 보면, Then 슬라이더(range input) + 좌측 `-` 버튼 + 우측 `+` 버튼 + 상단 속도 텍스트(`1.00x`)가 표시된다.
- AC2: Given 속도가 1.00x일 때, When `+` 버튼을 클릭하면, Then 속도가 1.05x로 변경되고 슬라이더 위치와 텍스트가 갱신된다.
- AC3: Given 속도가 0.50x일 때, When `-` 버튼을 클릭하면, Then 속도가 0.50x에 유지된다 (하한 클램핑).
- AC4: Given 속도가 2.00x일 때, When `+` 버튼을 클릭하면, Then 속도가 2.00x에 유지된다 (상한 클램핑).
- AC5: Given 속도가 1.35x일 때, When 속도 수치 텍스트(`1.35x`)를 클릭하면, Then 속도가 1.00x로 리셋된다.
- AC6: Given 속도가 1.35x일 때, When 슬라이더를 더블클릭하면, Then 속도가 1.00x로 리셋된다.
- AC7: Given 플레이어에 포커스가 있을 때, When 키보드 `+` 키를 누르면, Then 속도가 0.05 증가한다.
- AC8: Given 플레이어에 포커스가 있을 때, When 키보드 `-` 키를 누르면, Then 속도가 0.05 감소한다.

---

## Issue #4: 세그먼트 파형 시각화

**제목**: [waveform-speed] 세그먼트 파형 시각화 (Web Audio API + DOM 바)

**설명**:
현재 재생 중인 세그먼트의 오디오 파형을 바(bar) 형태로 시각화한다.
Web Audio API로 오디오를 디코딩하고, 순수 함수로 바 높이를 계산하며, div 바로 렌더링한다.
파형 클릭으로 세그먼트 내 위치 탐색(seek)이 가능하고, 재생 진행에 따라 바 색상이 전환된다.

**수정 파일**:

- [NEW] `src/lib/utils/waveform-utils.ts` — `computeWaveformBars(audioBuffer, start, end, barCount)` 순수 함수
- [NEW] `src/lib/utils/waveform-utils.test.ts` — 순수 함수 단위 테스트
- [NEW] `src/hooks/useAudioBuffer.ts` — Web Audio API 디코딩 훅 (`AudioBuffer` 캐시)
- [NEW] `src/hooks/useAudioBuffer.test.ts` — 훅 테스트
- [NEW] `src/components/player/Waveform.tsx` — 파형 바 렌더링 + 클릭 seek + 재생 위치 하이라이트
- [NEW] `src/components/player/Waveform.test.tsx` — 컴포넌트 테스트
- `src/components/player/AudioControls.tsx` — 시크바 아래에 `<Waveform>` 통합
- `src/components/player/AudioControls.test.tsx` — 파형 통합 테스트 추가

**Acceptance Criteria**:

- AC1: Given 에피소드 오디오가 로드되었을 때, When 세그먼트가 재생되면, Then 시크바 아래에 해당 세그먼트 구간의 파형 바가 표시된다.
- AC2: Given 파형이 표시될 때, When 세그먼트가 전환되면, Then 새 세그먼트 구간의 파형으로 갱신된다.
- AC3: Given 파형이 표시될 때, When 재생이 진행되면, Then 재생된 바는 `primary` 색상, 미재생 바는 `surface-dark-soft` 색상으로 구분된다.
- AC4: Given 파형이 표시될 때, When 파형의 특정 바를 클릭하면, Then 해당 시간 위치로 seek 이동한다.
- AC5: Given Web Audio API가 미지원 브라우저일 때, When 페이지 로드 시, Then 파형 영역이 숨겨지고 기존 시크바만 표시된다 (graceful degradation).
- AC6: Given 세그먼트가 없는 상태(`currentSegmentIndex < 0`)일 때, When 파형 영역을 보면, Then 빈 파형(flat bar)이 표시된다.
- AC7: Given 에피소드 전환 시, When 새 에피소드가 로드되면, Then 이전 AudioBuffer가 해제되고 새 오디오가 디코딩된다.
- AC8: Given 파형이 렌더링될 때, When 스크린리더가 읽으면, Then `role="img"` + `aria-label="세그먼트 파형"` 이 읽힌다.
