# Issue #56 — 집중 모드 음성 녹음 (브라우저 메모리)

> Slice 3 · 의존성: #10(#55 FocusPanel) · 흡수 유틸: `utils-recorder`
> AC1 녹음→정지→Blob+들어보기 / AC2 이탈 시 녹음 소멸(영속화 없음) / AC3 미지원·권한거부 시 버튼 비활성+안내

---

## 1. 시그니처 명세

### ① `src/lib/utils/recorder.ts` (NEW)

```ts
export function isRecordingSupported(): boolean;
// navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined'

export interface Recorder {
  stop(): Promise<Blob>; // MediaRecorder stop → 수집된 chunk를 Blob으로 resolve, 트랙 정리
}

export function startRecording(): Promise<Recorder>;
// 미지원 시 throw Error('RECORDING_UNSUPPORTED')
// getUserMedia 권한 거부 시 reject(원 에러 전파)
```

### ② `src/components/player/FocusPanel.tsx` (수정)

```ts
// 내부 state: recorder(Recorder|null), blobUrl(string|null), recError(string|null)
// segment 존재 시에만 녹음 UI 노출
// - !isRecordingSupported() → 녹음 버튼 disabled + 안내
// - isRecording(recorder!=null) → "정지" 버튼, 아니면 "녹음" 버튼
// - blobUrl 있으면 <audio src={blobUrl} controls> (들어보기)
// - startRecording reject 시 recError 안내
// - 언마운트 시 blobUrl revokeObjectURL (메모리 소멸, AC2)
```

---

## 2. 테스트 시나리오

### `recorder.ts`

- [정상] isRecordingSupported should be true when mediaDevices and MediaRecorder exist
- [예외] isRecordingSupported should be false when MediaRecorder is undefined
- [예외] startRecording should throw when unsupported (AC3)
- [예외] startRecording should reject when getUserMedia is denied (AC3)
- [정상] start then stop should resolve a Blob and stop tracks (AC1)

### `FocusPanel` (녹음)

- [정상] should show a record button when supported and segment present
- [예외] should disable record button and show notice when unsupported (AC3)
- [정상] recording then stopping should reveal a playback audio element (AC1)
- [예외] permission denial should show a notice and not crash (AC3)
- [정상] while recording, the record button is replaced by stop (mutual exclusive)
- [정상] a second recording should revoke the previous blob URL (AC2)
- [정상] unmount should revoke the object URL (AC2)

---

## 3. AC ↔ 시나리오

| AC                              | 커버                                                                  |
| :------------------------------ | :-------------------------------------------------------------------- |
| **AC1** 녹음→정지→Blob+들어보기 | recorder(start→stop Blob), FocusPanel(record→stop → audio 노출)       |
| **AC2** 이탈 시 소멸(비영속)    | FocusPanel(unmount revokeObjectURL, state-only 보관)                  |
| **AC3** 미지원·권한거부 비활성  | recorder(unsupported throw, denied reject), FocusPanel(disabled+안내) |
