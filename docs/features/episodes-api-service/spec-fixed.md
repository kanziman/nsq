# 에피소드 및 오디오 API 서비스 (episodes-api-service) 확정 요구사항

이 문서는 `spec-original.md`에 정의된 요구사항의 모호함을 인터뷰로 제거한 **확정 요구사항**이다.
이후 개발, 디자인 및 의사결정은 이 문서를 기준으로 진행한다.

---

## 1. 기능 개요

로컬 파일 시스템(`.shadowing/episodes/`)의 에피소드 데이터를 외부 서비스와 화면에 서빙하기 위한 에피소드 CRUD API 및 미디어 조작(탐색, 버퍼링)을 위한 HTTP Range 지원 오디오 스트리밍 API를 구축한다.

---

## 2. 핵심 사용자 (Primary User)

- 단일 사용자 (로컬 운영). 임포트된 에피소드 목록을 홈 화면에서 확인 및 삭제하고, 오디오 플레이어에서 오디오를 듣고 쉐도잉을 훈련하는 학습자.

---

## 3. 확정된 결정 사항

### 3-1. 에피소드 삭제 (`DELETE /api/episodes/[id]`) 시 진행 중 임포트 제어 ✅

- 에피소드의 임포트 상태가 진행 중(`downloading`, `processing_subtitles`, `processing_transcript`, `aligning`)일 때 삭제 요청이 들어오면 **`409 Conflict` 에러를 반환하여 차단**한다.
- 임포트 상태가 `completed`이거나 `failed`인 안정 상태인 경우에만 로컬 에피소드 디렉토리를 재귀적으로 안전하게 삭제한다.

### 3-2. 오디오 스트리밍 (`GET /api/episodes/[id]/audio`) 시 파일 부재 예외 처리 ✅

- 요청된 에피소드가 아직 다운로드 중 상태인 경우 **`409 Conflict`**를 즉시 반환한다.
- 다운로드되지 않았거나 파일이 아예 누락되어 존재하지 않는 경우 **`404 Not Found`**를 반환하여 브라우저 오디오 플레이어가 예외 처리를 수행할 수 있도록 한다.

### 3-3. 에피소드 목록 조회 (`GET /api/episodes`) 시 포함할 에피소드 상태 범위 ✅

- 조회 요청 시 완료(`completed`) 상태뿐만 아니라 진행 중(`downloading` 등)이거나 실패(`failed`)한 에피소드를 **모두 포함하여 반환**한다.
- 각 에피소드 객체 내에 `importState` 프로퍼티를 결합하여 반환함으로써, 클라이언트가 진행률 또는 에러 메시지를 렌더링하고 재시도할 수 있도록 지원한다.

### 3-4. 오디오 Range 스트리밍 처리 규칙 (Range Request) ✅

- 오디오 미디어 재생 시 원활한 구간 탐색(Seek) 및 스트리밍을 위해 **HTTP 206 Partial Content**를 올바르게 처리한다.
- `Range` 헤더가 요청에 실려오면:
  - 헤더의 byte range 파싱 후 해당 세그먼트만 파일을 읽어 전송한다.
  - `Content-Range`, `Content-Length`, `Accept-Ranges: bytes`, `Content-Type: audio/mpeg` 헤더를 적절히 세팅하여 응답한다.
- `Range` 헤더가 없는 일반 요청의 경우 파일 전체를 `200 OK`로 응답한다.

---

## 4. 입출력 명세

### 4-1. 에피소드 목록 조회

- **요청**: `GET /api/episodes`
- **응답 (200 OK)**:
  ```json
  [
    {
      "id": "video-id-1",
      "title": "Episode 1",
      "duration": 3600,
      "youtubeUrl": "https://youtube.com/watch?v=...",
      "addedAt": "2026-06-29T10:00:00Z",
      "importState": {
        "videoId": "video-id-1",
        "status": "completed",
        "progress": 100,
        "currentStep": "completed",
        "updatedAt": "2026-06-29T10:05:00Z"
      }
    }
  ]
  ```

### 4-2. 에피소드 삭제

- **요청**: `DELETE /api/episodes/[id]`
- **응답**:
  - 정상 삭제 성공 시: `200 OK` 혹은 `204 No Content`
  - 임포트 진행 중 삭제 시도 시: `409 Conflict` (예: `{ "error": "Cannot delete episode while import is in progress." }`)
  - 존재하지 않는 에피소드 삭제 시도 시: `404 Not Found` (또는 유연한 멱등성 처리를 위해 `200`도 무방하나 기본적으로 `404` 혹은 `200`을 반환하되, 여기서는 `404`로 명확화)

### 4-3. 오디오 스트리밍

- **요청**: `GET /api/episodes/[id]/audio` (헤더에 `Range: bytes=0-` 등 포함 가능)
- **응답**:
  - Range 요청 성공 시: `206 Partial Content` (바디는 해당 오디오 청크 데이터)
  - 일반 전체 요청 성공 시: `200 OK` (바디는 전체 오디오 파일)
  - 파일 미존재 시: `404 Not Found`
  - 진행 중(임포트 미완료) 시: `409 Conflict`
  - 내부 로드 에러 시: `500 Internal Server Error`

---

## 5. 경계 조건 (Boundary Conditions)

- **Range 파싱 오류**: `Range` 헤더가 잘못 정의되었거나 파일 크기를 벗어날 경우 `416 Range Not Satisfiable`을 반환한다.
- **빈 에피소드 목록**: 로컬 디렉토리에 에피소드가 전혀 없는 경우 빈 배열 `[]`과 `200 OK`를 반환한다.
- **삭제 동시성**: 동시에 여러 번 삭제 요청이 오는 경우, 첫 번째에 삭제가 이루어지면 두 번째부터는 `404 Not Found`를 일관성 있게 반환한다.

---

## 6. Ubiquitous Language (용어 정의)

| 용어                      | 정의                                                                             |
| :------------------------ | :------------------------------------------------------------------------------- |
| **에피소드 목록**         | 파일 시스템에서 조회하여 반환되는 메타데이터와 진행 상태가 결합된 구조체 목록    |
| **오디오 스트리밍**       | 클라이언트 미디어 플레이어의 구간 이동을 지원하는 HTTP Range 기반 mp3 서빙 방식  |
| **Partial Content (206)** | HTTP Range 헤더의 요청을 수락하여 파일의 일부 청크만 응답하는 규격 상태          |
| **Conflict (409)**        | 백그라운드 태스크가 구동 중이거나 맞지 않는 상태 전이 시 반환하는 자원 충돌 상태 |

---

## 7. 명시적 비범위 (Out of Scope)

- 에피소드 메타데이터 개별 수정 (Update) API 및 화면
- 특정 에피소드 일시 정지(Pause) 또는 취소(Cancel) 제어 기능
- 한 번에 대량의 에피소드를 일괄 삭제(Batch Delete)하는 기능
- 오디오 파일 이외의 대본 텍스트 및 자막 VTT 스트리밍 API (이들은 API 대신 episodes 서비스 레이어 직접 조회 또는 다른 라우트로 대체)
