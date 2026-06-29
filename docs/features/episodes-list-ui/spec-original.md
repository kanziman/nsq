# 에피소드 목록 UI (episodes-list-ui) 초기 아이디어

임포트된 에피소드 목록을 보여주고, 각 에피소드의 진행 상태를 실시간(혹은 폴링)으로 시각화하며, 쉐도잉 학습 및 관리의 시작점 역할을 하는 홈 페이지 UI 피처입니다.

## 기능 범위

1. **홈 페이지 (`src/app/page.tsx`)**:
   - 디자인 시스템(DESIGN.md)에 최적화된 Sleek Dashboard 레이아웃.
   - 새로운 에피소드를 추가하기 위한 임포트 페이지(`/import`) 이동 내비게이션 버튼.
   - `/api/episodes` API로부터 데이터를 조회하여 목록 바인딩 (로딩, 에러, 빈 목록 분기 처리).

2. **에피소드 목록 카드 그리드 (`src/components/episode-list.tsx` / `EpisodeCard.tsx`)**:
   - 반응형 그리드 구조 (Grid Layout).
   - 개별 에피소드 카드 정보 렌더링:
     - 썸네일 (비디오 프리뷰 이미지)
     - 에피소드 제목, 러닝타임(분/초 포맷), 임포트 날짜
     - 진행 상태 시각화 (`downloading`, `processing_subtitles`, etc. 인 경우 프로그레스 바 및 현재 단계명 표시)
     - 완료된 에피소드는 클릭 시 `/episodes/[id]` 상세 페이지로 이동.
     - 삭제 아이콘을 탑재하여 `DELETE /api/episodes/[id]` 호출을 연동.
