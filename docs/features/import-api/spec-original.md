# 임포트 API 엔드포인트 (import-api) 초기 정의서

## 기능 개요

YouTube 비디오 URL과 Freakonomics 대본 URL을 입력받아 오디오 다운로드, 자막 추출, 대본 스크래핑 및 정합(alignment)을 수행하고 결과를 한국어로 번역하는 임포트 파이프라인을 구동하는 POST API.

## 기능 요구사항

- **엔드포인트**: `POST /api/import`
- **입력 데이터**:
  - `youtubeUrl` (필수, 문자열)
  - `transcriptUrl` (필수, 문자열)
  - `retryStep` (선택 사항, "all" | "transcript" | "subtitles")
- **동작**:
  1. 유튜브 오디오 및 자막 다운로드
  2. Freakonomics 대본 fetch 및 화자 이름 정규화
  3. 자막 ↔ 대본 토큰 정합 매칭 (Patience-Diff 앵커 매칭 및 선형 보간)
  4. 정합 상태 검증 (`matchRate < 0.85` 인 경우 잘못된 대본으로 판단하여 중단 및 에러 throw)
  5. 세그먼트별 한국어 번역 수행 (`TRANSLATION_MODEL` 기반 OpenRouter 연동)
- **상태 관리**:
  - 단계별 진행 상태(`.shadowing/episodes/{videoId}/import-state.json`)를 파일 시스템에 영속화.
