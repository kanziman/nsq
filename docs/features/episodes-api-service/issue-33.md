# Issue 33 — 오디오 스트리밍 API (GET /api/episodes/[id]/audio)

## 1. 확정된 시그니처 (Signatures)

### 📂 파일 경로: `src/app/api/episodes/[id]/audio/route.ts`

```typescript
import { getEpisodeById } from '@/lib/services/episodes';

/**
 * GET /api/episodes/[id]/audio
 * 에피소드의 오디오 스트리밍을 제공하며, HTTP Range 요청을 처리하여 200 또는 206 부분 전송을 수행합니다.
 *
 * @param request Web Standard Request
 * @param context Next.js 라우트 컨텍스트 (비동기 params 포함)
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response>;
```

---

## 2. 테스트 시나리오 (Test Scenarios)

### 정상 (Normal)

- **`[정상] GET — should return 200 OK with full audio stream and correct headers when Range is absent`**
  - _조건:_ 에피소드가 존재(완료 상태), `audio.mp3` 파일 존재, `Range` 헤더 없음.
  - _결과:_ 전체 파일 크기에 대한 `Content-Length`, `Content-Type: audio/mpeg` 헤더와 함께 HTTP 200 응답 반환.
- **`[정상] GET — should return 206 Partial Content with chunk stream and range headers when Range is present`**
  - _조건:_ 에피소드가 존재(완료 상태), `audio.mp3` 파일 존재, `Range: bytes=0-99` 헤더 요청.
  - _결과:_ `Content-Range: bytes 0-99/total`, `Content-Length: 100`, `Accept-Ranges: bytes` 헤더와 함께 HTTP 206 응답 반환.

### 예외 (Exception)

- **`[예외] GET — should return 409 Conflict when episode is in progress (downloading)`**
  - _조건:_ 에피소드가 존재하고 `importState.status === 'downloading'`.
  - _결과:_ HTTP 409 응답 반환.
- **`[예외] GET — should return 404 Not Found when episode does not exist`**
  - _조건:_ 에피소드가 존재하지 않아 `getEpisodeById`가 `null`을 반환할 때.
  - _결과:_ HTTP 404 응답 반환.
- **`[예외] GET — should return 404 Not Found when audio.mp3 file does not exist on disk`**
  - _조건:_ 에피소드는 완료 상태지만, 디스크 상의 `audio.mp3` 파일이 없는 경우.
  - _결과:_ HTTP 404 응답 반환.
- **`[예외] GET — should return 416 Range Not Satisfiable when range values are out of file bounds`**
  - _조건:_ `Range: bytes=9999999-` 와 같이 파일 크기를 초과하거나 비정상적인 범위 요청일 때.
  - _결과:_ HTTP 416 응답 반환.
- **`[예외] GET — should return 500 Internal Server Error when filesystem check throws exception`**
  - _조건:_ 파일 스캔 또는 스트림 생성 시 예기치 못한 Exception이 발생한 경우.
  - _결과:_ `{ error: message }` 정보와 HTTP 500 응답 반환.
