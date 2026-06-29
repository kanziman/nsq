# 쉐도잉 플레이어 MVP — 확정 요구사항 (spec-fixed.md)

> 출처: [spec-original.md](./spec-original.md) + 요구사항 인터뷰(Q1~Q7) 확정 결과
> 범위: `/episodes/[id]` 쉐도잉 플레이어 페이지 (player + script-view + utils, 3개 수직 슬라이스)

---

## 1. 핵심 사용자 (Primary User)

**쉐도잉 학습자** — 홈 대시보드에서 임포트 완료(completed)된 에피소드 카드를 클릭해 진입한다. 오디오를 들으며 화자별 스크립트를 따라 읽고(전체 모드), 특정 문장을 반복·녹음하며 발음을 교정한다(집중 모드).

---

## 2. 최소 동작 시나리오 (3개)

### 시나리오 1 — 전체 모드 청취 (기본 흐름)

1. 홈에서 completed 에피소드 카드 클릭 → `/episodes/[id]` 진입
2. 상단 dark 플레이어에서 ▶ 재생 → 오디오가 처음부터 **연속 재생**
3. 재생 위치(`timeupdate`)에 따라 하단 cream 스크립트의 현재 세그먼트가 **자동 강조 + 자동 스크롤**
4. ⏮/⏭로 세그먼트 단위 이동, 진행바 클릭으로 seek

### 시나리오 2 — 구간 반복 + 속도 학습

1. 스크립트에서 문장(세그먼트) 클릭 → 해당 시점으로 seek
2. Shift+클릭으로 범위 선택 → **A-B 구간 반복** 토글, 반복 횟수 표시
3. 속도를 0.75x로 낮춰 천천히 따라 말함
4. 번역(translation) blur를 hover/토글로 해제해 의미 확인
5. 화자 필터로 Angela만 선택 → 비대상 세그먼트는 **자동 스킵**되어 대상 화자만 연속 재생

### 시나리오 3 — 집중 모드 녹음

1. 모드 토글로 **집중 모드** 진입 → 스크립트 영역이 현재 세그먼트 1개 크게 표시로 전환(플레이어 컨트롤은 유지)
2. 세그먼트를 반복 청취
3. ● 녹음 → 따라 말하기 → ■ 정지 → "들어보기"로 즉시 재생 비교
4. 다음 세그먼트로 이동(녹음 Blob은 브라우저 메모리에만 보관, 페이지 이탈 시 소멸)

---

## 3. 확정된 결정 사항 (인터뷰 Q1~Q7)

| #   | 주제                      | 결정                                                                                                                                      |
| :-- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 전체 모드 재생 방식       | **연속 재생**. 세그먼트 경계에서 멈추지 않고, `timeupdate`로 현재 세그먼트를 추적해 스크립트 강조만 이동                                  |
| Q2  | 페이지 레이아웃           | **상단 sticky dark 플레이어 + 하단 cream 스크립트**, 우측 AI 튜터 패널 골격                                                               |
| Q3  | 집중 모드 전환            | **인라인 전환** — 스크립트 뷰 영역만 변경, 상단 플레이어 컨트롤 유지                                                                      |
| Q4  | 녹음 데이터 저장          | **브라우저 메모리 only** — Blob을 state/ref에 보관, 페이지 이탈 시 소멸, 서버 저장 없음                                                   |
| Q5  | 미완료/부재 에피소드 접근 | **홈으로 redirect** — Server Component 단계에서 completed + segments 존재 검증, 아니면 `redirect('/')`                                    |
| Q6  | 단어 레벨 타이밍 출처     | **런타임 VTT 파싱 + 폴백** — `subtitle.en.vtt`를 기존 `parseVtt()`로 파싱해 세그먼트에 단어 매핑, 부재 시 세그먼트 레벨 하이라이트로 폴백 |
| Q7  | 화자 필터 × 연속 재생     | **자동 스킵 재생** — 필터 활성 시 비대상 세그먼트 진입하면 다음 대상 세그먼트 start로 seek, 대상 0개면 필터 자동 해제                     |

### 기확정 (spec-original)

- **파형(Waveform)**: Post-MVP 이관 → MVP는 프로그레스 바로 대체
- **AI 튜터 채팅 패널**: 레이아웃 골격만, 실제 기능은 별도 피처
- **집중 모드 + 녹음**: MVP에 포함

---

## 4. 데이터 저장 / 기존 구조와의 관계

- **세그먼트 조회**: 신규 `GET /api/episodes/[id]/segments` 엔드포인트가 기존 `getEpisodeSegments(id)` 서비스를 래핑해 `Segment[]` 반환. (서비스는 구현 완료, 엔드포인트만 신규)
- **오디오 소스**: 기존 `GET /api/episodes/[id]/audio` (HTTP Range 206) 그대로 사용
- **단어 타이밍**: `.shadowing/episodes/{id}/subtitle.en.vtt` → `parseVtt()` → `VttToken[]` (런타임 파싱, import 무수정)
- **녹음 데이터**: 영속화 없음 (메모리)
- **테스트 데이터**: `.shadowing/episodes/`가 비어 있어, 개발/E2E용 mock 에피소드 시딩 스크립트 신규 필요 (`meta.json`, `import-state.json`(completed), `segments.json`, `audio.mp3` stub)

---

## 5. 경계 조건 (Edge Cases)

- **빈 세그먼트**: `segments.json`이 빈 배열 → 재생 컨트롤 비활성 + "세그먼트 없음" 안내
- **마지막 세그먼트**: 연속 재생이 오디오 끝(`ended`)에 도달 → 정지, 마지막 세그먼트 강조 유지
- **세그먼트 간 gap**: gap 구간 재생 중에는 직전 세그먼트 강조 유지(연속 재생이므로 끊지 않음)
- **인접 세그먼트 경계 공유**(`seg[n].end === seg[n+1].start`): `BOUNDARY_PARK_BACKOFF_SEC = 0.05` 적용해 세그먼트 단위/구간 반복 시 다음 세그먼트로 새는 것 방지
- **화자 필터 대상 0개**: 필터 자동 해제 + 안내
- **VTT 부재/파싱 실패**: 단어 레벨 → 세그먼트 레벨 하이라이트 폴백
- **녹음 미지원/권한 거부**: MediaRecorder 미지원 또는 마이크 권한 거부 시 집중 모드 녹음 버튼 비활성 + 안내

---

## 6. 예외 및 에러 처리 (UI 전달)

- **에피소드 미존재 / 미완료(진행중·실패) / segments.json 부재**: Server Component에서 `redirect('/')` (Q5)
- **오디오 로드 실패**(`audio.error`): 플레이어 영역에 에러 메시지 + 재시도 버튼
- **segments API 응답 규약**: 미존재 404 / 임포트 진행 중 409 / segments.json 부재 404 (정상 흐름은 redirect로 선차단되므로 방어적 계층)
- **마이크 권한 거부**: 집중 모드 내 인라인 안내, 재생/스크립트 기능은 정상 유지

---

## 7. 기존 UI / 컴포넌트 재사용 일관성

- **기존 mockup** [shadowing-player.tsx](../../../src/components/player/shadowing-player.tsx)를 동작하는 Client Component로 재작성(레이아웃·톤 계승)
- **화자 색상**: [speakers.ts](../../../src/lib/constants/speakers.ts)의 `SPEAKER_COLORS`(Angela/Steven/Both/Narrator) 및 `textClass`/`bgClass`/`borderClass` 재사용
- **VTT 파서**: import 영역의 `parseVtt()` 재사용(중복 신설 금지) — 필요 시 공용 utils로 위치 정리
- **디자인 시스템**: warm-canvas 에디토리얼(dark surface 플레이어 / cream canvas 스크립트), 색상은 CSS 변수 토큰만 사용

---

## 8. 성능 제약

- **세그먼트 수**: 한 에피소드 수백 개 세그먼트 가정 → 스크립트 리스트 렌더 시 현재 세그먼트 추적은 인덱스 기반 O(1)~O(log n) 탐색, 불필요한 전체 리렌더 방지(메모이제이션)
- **timeupdate 처리**: 브라우저 `timeupdate`(~250ms)에 의존, 추가 rAF 폴링 없이 처리. 단어 레벨 하이라이트도 동일 틱 내 계산
- **자동 스크롤**: `scrollIntoView({ behavior: 'smooth', block: 'center' })`, 세그먼트 변경 시에만 트리거
- **VTT 파싱**: 진입 시 1회 파싱 후 메모리 캐시

---

## 9. 향후 확장성 / 종속성

- **선행 의존**: 본 feature는 에피소드/오디오 API, 세그먼트 서비스, import 파이프라인(VTT 산출) 위에 올라감 — 모두 구현 완료
- **Post-MVP 확장 지점**: 파형 시각화, AI 튜터 채팅 실제 연동, 녹음 영속화(파일시스템/IndexedDB), 단어 타이밍 정밀화(import에 words 굽기)
- **분리 원칙**: 단어 타이밍은 런타임 파싱으로 격리해 import 결합도를 높이지 않음

---

## 10. 용어 정의 (Ubiquitous Language)

| 용어                                      | 정의                                                                                                               |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **세그먼트 (Segment)**                    | 화자·텍스트·`start`/`end`(초)·optional translation/words를 가진 스크립트 최소 단위. `Segment` 타입                 |
| **전체 모드 (Full Mode)**                 | 오디오를 연속 재생하며 스크립트 강조만 따라가는 기본 학습 모드                                                     |
| **집중 모드 (Focus Mode)**                | 현재 세그먼트 1개를 크게 표시하고 반복·녹음하는 인라인 전환 모드                                                   |
| **A-B 구간 반복 (A-B Repeat)**            | 선택한 세그먼트(또는 범위)를 반복 재생하는 기능                                                                    |
| **경계 park (Boundary Park)**             | 세그먼트/구간 끝에서 `BOUNDARY_PARK_BACKOFF_SEC`(0.05s)만큼 앞에서 정지·고정해 다음 세그먼트로 새지 않게 하는 처리 |
| **화자 필터 (Speaker Filter)**            | 특정 화자만 연속 재생하고 비대상 세그먼트를 자동 스킵하는 기능                                                     |
| **단어 레벨 하이라이트 (Word Highlight)** | 재생 중 현재 발화 단어를 개별 강조. 데이터는 VTT 런타임 파싱(`VttToken`)에서 도출                                  |
| **VttToken**                              | `{ word, start, end }` — `parseVtt()`가 큐를 단어 수로 균등 분배해 산출한 단어 타이밍                              |
| **화자 키 (Speaker Key)**                 | `DUCKWORTH`(Angela) / `DUBNER`(Steven) / `BOTH` / `NARRATOR`. `SPEAKER_COLORS`의 키                                |
| **completed**                             | `import-state.json`의 임포트 완료 상태. 플레이어 진입 허용 조건                                                    |
