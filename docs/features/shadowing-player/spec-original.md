# 쉐도잉 플레이어 MVP — 초기 기능 정의서

> 출처: GOAL.md §2 핵심 기능, checklist.json `player` + `script-view` + `utils` 섹션

---

## 기능 개요

홈 대시보드에서 임포트 완료(completed) 에피소드를 선택하면 진입하는 쉐도잉 플레이어 페이지(`/episodes/[id]`).
HTML5 Audio API 기반으로 세그먼트 단위 재생을 지원하며, 화자별 색상 스크립트 뷰와 연동된다.

---

## 핵심 기능 목록

### A. 플레이어 (player)

1. **플레이어 페이지**: 에피소드 상세 페이지 — 플레이어 + 스크립트 뷰 + AI 튜터 채팅 레이아웃 (채팅은 골격만)
2. **학습 모드 선택**: 전체 모드(스크립트 전체 흐름 학습) / 집중 모드(세그먼트 반복 + 녹음) 전환
3. **플레이어 코어**: HTML5 Audio 기반 세그먼트 단위 재생 엔진
4. **오디오 컨트롤 UI**: 재생/정지, 이전/다음 세그먼트, 진행바, 타임코드 표시
5. **A-B 구간 반복**: 선택한 세그먼트(들) 구간 반복 재생 + 반복 횟수 표시
6. **재생 속도 조절**: 0.5x ~ 2.0x
7. **화자 필터링**: 특정 화자만 선택하여 해당 세그먼트만 재생
8. **키보드 단축키**: Space(재생/정지), ←→(세그먼트 이동), R(구간반복) 등
9. **재생 경계 처리**: 인접 세그먼트 간 start/end 경계 공유 시 BOUNDARY_PARK_BACKOFF_SEC(0.05s) 기반 park
10. **집중 모드 음성 녹음**: 현재 세그먼트에 대해 녹음/재생(들어보기) UI

### B. 스크립트 뷰 (script-view)

1. **코어**: 세그먼트 목록을 화자별 색상으로 렌더링
2. **현재 재생 하이라이트**: 현재 재생 중 세그먼트 시각적 강조 + 자동 스크롤
3. **번역 블러 처리**: 한국어 번역 기본 blur, 개별 해제, 전체 토글
4. **단어 레벨 하이라이트**: VTT word-level timing 활용
5. **구간 선택**: 클릭으로 세그먼트 선택, Shift+클릭으로 범위 선택 → A-B 반복 연결

### C. 유틸리티 (utils)

1. **Audio API 유틸**: HTML5 Audio 래퍼 — 시간 이동, 구간 재생, 속도 제어
2. **시간 포맷 유틸**: 초 → mm:ss, VTT 타임코드 파싱
3. **VTT 파서**: VTT 자막 파일 파싱 — 타임코드 + 단어 레벨 타이밍 추출
4. **웹 오디오 녹음 유틸**: MediaRecorder API 래핑

---

## 사용자 결정 사항 (이미 확정)

- **오디오 파형(Waveform) 시각화**: Post-MVP로 이관. MVP에서는 프로그레스 바로 대체.
- **AI 튜터 채팅 패널**: 레이아웃 골격만 구현. 실제 기능은 별도 피처로 분리.
- **집중 모드 + 녹음**: MVP에 포함.

---

## 기존 인프라

- **오디오 스트리밍 API**: `GET /api/episodes/[id]/audio` (HTTP Range 206 지원) — 구현 완료
- **에피소드 조회 API**: `GET /api/episodes`, `DELETE /api/episodes/[id]` — 구현 완료
- **세그먼트 서비스 함수**: `getEpisodeSegments(id)` — 구현 완료, API 엔드포인트는 미구현
- **디자인 시스템**: warm-canvas 에디토리얼 테마, 화자별 색상(`speakers.ts`), dark surface 오디오 영역
- **데이터 구조**: `.shadowing/episodes/{videoId}/segments.json` — `Segment[]` 타입

---

## 데이터 형태

```typescript
interface Segment {
  id: string;
  start: number; // 초 단위
  end: number;
  speaker: 'DUCKWORTH' | 'DUBNER' | 'BOTH' | 'NARRATOR';
  text: string;
  translation?: string;
  words?: { word: string; start: number; end: number }[];
}
```
