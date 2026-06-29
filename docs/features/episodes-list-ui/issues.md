# 에피소드 목록 UI (episodes-list-ui) 이슈 분해

> 근거: [prd.md](./prd.md) · [spec-fixed.md](./spec-fixed.md)
> 원칙: 수직 슬라이싱(독립 테스트 및 렌더링 검증 가능), TDD 지향.

---

## Issue 1 — 에피소드 대시보드 및 리스트 페이지 구조화 (`src/app/page.tsx`)

**목적**: 홈 대시보드 라우트를 생성하고, API로부터 데이터를 로드하여 목록을 바인딩하며 조건부 폴링 라이프사이클을 구현한다.

**범위**

- `src/app/page.tsx` 라우트 페이지에서 클라이언트 대시보드 컴포넌트(`src/components/episode/EpisodeDashboard.tsx`)를 불러오도록 구조화.
- `/api/episodes` 로부터 에피소드 목록 데이터 패칭 구현.
- 로딩 중일 때 디자인 시스템에 맞춘 스켈레톤 로딩(Skeleton) 노출.
- API 에러 발생 시 에러 화면 노출 및 "다시 시도" 버튼 활성화.
- 조회된 에피소드가 0개일 때 Empty State 화면 노출 (임포트 페이지 `/import` 이동 촉구).
- 목록 중 진행 중(`downloading`, `processing_subtitles`, `processing_transcript`, `aligning`) 상태인 에피소드가 1개 이상 존재할 때만 3초 주기로 `/api/episodes` API 목록을 조건부 폴링. 완료/실패 시 정지.

**의존성**: 없음.

**Acceptance Criteria**

- [x] Given 조회된 에피소드 목록이 없을 때, When 홈 화면 진입, Then "등록된 에피소드가 없습니다" 문구와 함께 큼직한 "에피소드 임포트" 버튼이 중앙에 렌더링된다.
- [x] Given 1개 이상의 진행 중인 에피소드가 목록에 감지될 때, When 대시보드가 마운트됨, Then 3초 주기로 폴링 타이머가 시작되어 목록 데이터를 주기적으로 갱신한다.
- [x] Given 폴링 수행 중 모든 에피소드가 완료/실패 안정 상태로 변경될 때, When 다음 폴링 인터벌이 동작, Then 갱신 타이머가 완전히 해제(Clear)된다.

---

## Issue 2 — 에피소드 카드 컴포넌트 (`src/components/episode/EpisodeCard.tsx`) 구현

**목적**: 대시보드 내 그리드에 표시될 개별 에피소드 카드 정보 및 상태 분기 UI를 구현한다.

**범위**

- `src/components/episode/EpisodeCard.tsx` 생성.
- **완료 (`completed`) 상태**:
  - YouTube 썸네일, 제목 (최대 2줄 말줄임표 처리), 재생 시간, 추가일 표시.
  - 카드를 클릭하면 상세 학습 페이지인 `/episodes/[id]` 로 이동.
- **진행 중 상태**:
  - 진행률 프로그레스 바(Progress Bar) 표시.
  - 현재 단계명(예: "대본 정합 중 (80%)") 텍스트 표시.
  - 카드 클릭 이동 불가(비활성화).
- **실패 (`failed`) 상태**:
  - 빨간색 `Failed` 배지 표시.
  - 마우스 오버(Hover) 시 상세 에러를 노출하는 툴팁(Tooltip) 탑재.
  - 클릭 시 `/import?videoId={id}` 경로로 이동(재시도 컨텍스트 연동)하는 "재시도(Retry)" 버튼 탑재.

**의존성**: Issue 1 (대시보드 리스트 바인딩).

**Acceptance Criteria**

- [x] Given 완료 상태인 에피소드 카드, When 카드 클릭, Then `/episodes/{id}` 주소로 정상 이동한다.
- [x] Given 진행 중 상태인 에피소드 카드, When 카드 렌더링, Then 프로그레스 바와 단계 텍스트가 표시되며 클릭해도 라우팅이 일어나지 않는다.
- [x] Given 실패 상태인 에피소드 카드, When "재시도" 버튼 클릭, Then `/import?videoId={id}` 경로로 정확한 ID 쿼리 스트링과 함께 사용자가 리다이렉트된다.

---

## Issue 3 — AlertDialog 경고 모달 통합 및 개별 에피소드 삭제 연동

**목적**: 카드 내 삭제 버튼 클릭 시 AlertDialog 확인 모달을 띄우고 실제 삭제 API를 태워 반영한다.

**범위**

- 개별 에피소드 카드 내 우측 하단에 삭제(쓰레기통) 버튼 노출. (진행 중인 에피소드는 오클릭 방지를 위해 삭제 아이콘을 비활성화 또는 숨김 처리).
- 삭제 아이콘 클릭 시, shadcn/ui 기반의 `AlertDialog` (경고 다이얼로그) 모달 노출.
- 모달 내에서 최종 "삭제" 승인 클릭 시:
  - `DELETE /api/episodes/[id]` API 호출.
  - 성공적으로 지워진 경우 모달을 닫고, 대시보드 리스트 State를 최신화하여 화면에서 제거.
  - API 삭제 오류 시 (예: 동시성 409 conflict 등) 오류 알림(Toast 또는 Alert)을 통해 예외 보고.

**의존성**: Issue 2 (에피소드 카드 UI 결합).

**Acceptance Criteria**

- [ ] Given 임포트 완료 또는 실패 상태인 에피소드 카드, When 삭제 버튼 클릭, Then 경고 문구 및 삭제/취소 액션이 있는 AlertDialog 모달이 노출된다.
- [ ] Given 삭제 모달이 열린 상태, When 최종 "삭제" 클릭, Then `DELETE /api/episodes/[id]` API가 호출되고 리스트에서 해당 카드가 즉시 제거된다.
- [ ] Given 진행 중인 에피소드 카드, When 렌더링 상태 검사, Then 삭제 버튼이 비활성화(Disabled) 상태여야 한다.

---

## 의존성 그래프

```
Issue 1 (대시보드 틀 & 폴링 라이프사이클)
    └─▶ Issue 2 (에피소드 상태별 카드 렌더링)
           └─▶ Issue 3 (AlertDialog 및 DELETE API 연동)
```
