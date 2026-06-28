# import-ui (프론트엔드 연동) — 초기 기능 정의서

## 한 줄 요약

다운로드·분석 엔진(POST /api/import + 파이프라인)이 준비된 상태에서, 사용자가 임포트를 **조작할 폼**과 진행 **상태를 모니터링**하는 화면을 구현한다.

## 범위 (checklist: import-pipeline 페이즈)

- `import-form-ui` — 임포트 URL 입력 폼, 단계별 진행 상태 게이지/타임라인, 실패 단계별 개별 재시도 버튼
- `import-page` — `/import` 전용 라우팅 페이지, 디자인 시스템(DESIGN.md) 준수 모니터링 레이아웃

## 이유

엔진이 준비된 후 사용자가 조작할 실제 폼과 상태 모니터링 화면 레이아웃에만 집중 → E2E(Playwright)와 함께 기획하기 완벽한 크기.

## 기존 자산 (분석 결과)

- **백엔드**: `POST /api/import` → 202 `{videoId, status:'downloading'}` 반환 후 `runImportPipeline` fire-and-forget. 검증 실패 400, 중복 409(진행중·완료), 예외 500. `retryStep`(all/transcript/subtitles) 지원.
- **상태**: `ImportState{ videoId, status, progress(0-100), currentStep, error?, updatedAt }`. status = downloading/processing_subtitles/processing_transcript/aligning/translating/completed/failed. `import-state.json`에 기록. **단, 상태를 읽는 GET 엔드포인트는 아직 없음** → 폴링 수단 필요(아키텍처 결정 대상).
- **UI 자산**: `components/ui/{button,card,input,badge}.tsx`, 디자인 시스템 `docs/design-system/`.
- **페이지**: `app/page.tsx`(현재 디자인 쇼케이스), `/import` 라우트 없음.

## 미해결 결정 사항 (인터뷰 대상)

1. 상태 모니터링 통신 방식 (GET 폴링 엔드포인트 신설 vs SSE vs 서버 컴포넌트)
2. 폼 검증 위치 (클라이언트 사전 검증 vs 서버 400 의존)
3. 단계 타임라인 표현 (status→step 매핑, progress 게이지)
4. 실패 단계별 재시도 버튼 ↔ `retryStep`(all/transcript/subtitles) 매핑
5. 409(이미 진행중/완료)·500 등 에러의 UI 전달
6. 완료 후 흐름(에피소드 페이지 연결 — out of scope 후보)
7. 네비게이션(홈 → /import 진입)
