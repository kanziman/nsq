# 에피소드 및 오디오 API 서비스 (episodes-api-service) 초기 아이디어

임포트된 에피소드 목록을 관리하고 오디오 스트리밍을 제공하는 백엔드 API 서비스 피처입니다.

## 기능 범위

1. **에피소드 목록 조회 및 삭제 (`/api/episodes`)**:
   - `GET /api/episodes`: 파일 시스템에 임포트된 모든 에피소드 목록을 반환
   - `DELETE /api/episodes/[id]`: 특정 에피소드의 데이터 디렉토리를 완전히 삭제
2. **오디오 스트리밍 API (`/api/episodes/[id]/audio`)**:
   - `GET /api/episodes/[id]/audio`: mp3 파일을 스트리밍으로 전송하되, 오디오 플레이어 조작(탐색, 버퍼링)을 원활하게 지원하기 위해 HTTP Range 요청을 처리해야 함
