# 에피소드 및 오디오 API 서비스 (episodes-api-service) 이슈 분해

> 근거: [prd.md](./prd.md) · [spec-fixed.md](./spec-fixed.md)
> 원칙: 수직 슬라이싱(각 이슈는 폴링 및 독립 테스트 검증 가능), TDD 지향.

---

## Issue 1 — 에피소드 목록 조회 API (`GET /api/episodes`)

**목적**: 로컬 저장소의 모든 에피소드 상태 및 메타 데이터를 조회하여 클라이언트에 JSON 형식으로 반환한다.

**범위**

- `src/app/api/episodes/route.ts` GET 핸들러 구현.
- 기존 `src/lib/services/episodes.ts` 서비스의 `getEpisodes()`를 활용하여 로컬 에피소드 목록을 확보하고, 메타데이터와 `importState`가 온전히 병합된 JSON 응답 배열을 구성한다.
- 로컬 저장 공간이 비어있어 등록된 에피소드가 없는 경우 에러 없이 빈 배열 `[]`을 반환한다.

**의존성**: 없음 (시작 이슈).

**Acceptance Criteria**

- [x] Given 1개의 완료된 에피소드와 1개의 진행중인 에피소드 파일 구조가 존재할 때, When `GET /api/episodes` 호출, Then `200 OK` 응답과 함께 2개의 에피소드 객체가 반환되며 각각의 `importState` 상태가 정확히 포함되어 있다.
- [x] Given 저장 공간이 비어 에피소드가 존재하지 않을 때, When `GET /api/episodes` 호출, Then `200 OK`와 함께 빈 배열 `[]`을 반환한다.

---

## Issue 2 — 에피소드 삭제 API (`DELETE /api/episodes/[id]`)

**목적**: 특정 에피소드에 대해 임포트 진행 중일 시 삭제를 차단하고, 그 외에는 디렉토리를 안전하게 삭제한다.

**범위**

- `src/app/api/episodes/[id]/route.ts` DELETE 핸들러 구현.
- 해당 `[id]`의 현재 `importState` 상태를 체크하여:
  - 진행 중(`downloading`, `processing_subtitles`, `processing_transcript`, `aligning`) 상태인 경우: **`409 Conflict`** 응답을 반환하고 삭제를 반려한다.
  - 존재하지 않는 `[id]`인 경우: **`404 Not Found`** 응답을 반환한다.
  - 그 외 안정 상태(`completed`, `failed`): 로컬 파일 저장소 디렉토리를 재귀적으로 안전하게 완전 파괴(`deleteEpisode` 헬퍼 활용)한 후 **`200 OK`**를 응답한다.

**의존성**: Issue 1 (에피소드 개별 조회 및 라우팅 디렉토리 기반).

**Acceptance Criteria**

- [x] Given 임포트 진행 중(`downloading`)인 에피소드 ID, When `DELETE /api/episodes/[id]` 호출, Then `409 Conflict` 응답을 반환하고 디렉토리가 지워지지 않고 보존된다.
- [x] Given 완료(`completed`) 또는 실패(`failed`) 상태인 에피소드 ID, When `DELETE /api/episodes/[id]` 호출, Then `200 OK` 응답을 반환하고 로컬의 해당 에피소드 디렉토리가 완전히 제거된다.
- [x] Given 존재하지 않는 에피소드 ID, When `DELETE /api/episodes/[id]` 호출, Then `404 Not Found` 응답을 반환한다.

---

## Issue 3 — 오디오 스트리밍 API (`GET /api/episodes/[id]/audio`)

**목적**: 에피소드의 오디오 파일 스트리밍을 제공하되, 브라우저 미디어 컨트롤러의 구간 이동(Seeking)을 위한 HTTP Range 요청을 명세에 맞추어 처리한다.

**범위**

- `src/app/api/episodes/[id]/audio/route.ts` GET 핸들러 구현.
- 해당 `[id]`의 현재 `importState` 상태를 확인하여 진행 중(`downloading` 등)인 경우 **`409 Conflict`** 반환.
- 오디오 파일 `audio.mp3`가 없거나 해당 에피소드가 미등록 상태인 경우 **`404 Not Found`** 반환.
- **Range 헤더가 없는 경우**: 전체 파일을 로드하여 `200 OK`로 응답 (`Content-Type: audio/mpeg`, `Content-Length` 세팅).
- **Range 헤더가 있는 경우 (`bytes=start-end`)**:
  - `start`, `end` 범위를 파싱하여 청크 크기 계산. 범위가 잘못된 경우 **`416 Range Not Satisfiable`** 응답.
  - `fs.createReadStream`에 `start` 및 `end` 옵션을 전달하여 해당 구간만 스트리밍 전송.
  - 응답 코드를 **`206 Partial Content`**로 세팅하고 `Content-Range: bytes start-end/totalSize`, `Content-Length`, `Accept-Ranges: bytes`, `Content-Type: audio/mpeg` 헤더를 조율하여 회신.

**의존성**: Issue 2 (에피소드 개별 리소스 접근 라우트).

**Acceptance Criteria**

- [ ] Given 진행 중(`downloading`) 상태인 에피소드 ID, When `GET /api/episodes/[id]/audio` 호출, Then `409 Conflict` 응답을 반환한다.
- [ ] Given 완료 상태이지만 실제 `audio.mp3` 파일이 없는 에피소드 ID, When `GET /api/episodes/[id]/audio` 호출, Then `404 Not Found` 응답을 반환한다.
- [ ] Given 완료 및 오디오가 존재하는 에피소드 ID 및 Range 헤더가 없는 요청, When `GET /api/episodes/[id]/audio` 호출, Then `200 OK`와 함께 전체 오디오 콘텐츠 및 올바른 `Content-Length` 헤더를 반환한다.
- [ ] Given 완료 및 오디오가 존재하는 에피소드 ID 및 `Range: bytes=0-99` 헤더 요청, When `GET /api/episodes/[id]/audio` 호출, Then `206 Partial Content` 응답과 함께 100바이트 크기의 청크 데이터를 전송하며 헤더에 `Content-Range`와 `Content-Length: 100`이 올바르게 세팅되어 있다.
- [ ] Given 파일 크기 한계를 벗어나는 잘못된 `Range: bytes=99999999-` 헤더 요청, When `GET /api/episodes/[id]/audio` 호출, Then `416 Range Not Satisfiable` 응답을 반환한다.

---

## 의존성 그래프

```
Issue 1 (목록 조회 GET)
    └─▶ Issue 2 (개별 삭제 DELETE)
           └─▶ Issue 3 (오디오 스트리밍 Range GET)
```
