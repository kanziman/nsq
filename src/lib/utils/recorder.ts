/**
 * 브라우저 음성 녹음 래퍼. getUserMedia + MediaRecorder를 감싸 start/stop→Blob을 제공한다.
 * 녹음물은 호출자가 메모리에 보관하며, 어떤 영속화도 하지 않는다.
 */

export interface Recorder {
  /** 녹음을 멈추고 수집된 오디오를 Blob으로 반환한다. 스트림 트랙도 정리한다. */
  stop(): Promise<Blob>;
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

export async function startRecording(): Promise<Recorder> {
  if (!isRecordingSupported()) {
    throw new Error('RECORDING_UNSUPPORTED');
  }
  // 권한 거부 시 여기서 reject 된다.
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start();

  return {
    stop() {
      return new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(
            new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' }),
          );
        };
        mediaRecorder.stop();
      });
    },
  };
}
