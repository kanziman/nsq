// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isRecordingSupported, startRecording } from './recorder';

// 원복용 원본 참조
const origMediaRecorder = (globalThis as { MediaRecorder?: unknown })
  .MediaRecorder;
const origMediaDevices = navigator.mediaDevices;

function setMediaDevices(value: unknown): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value,
    configurable: true,
  });
}

/** 최소 MediaRecorder 페이크: start/stop, ondataavailable/onstop 트리거 */
class FakeMediaRecorder {
  static isTypeSupported = () => true;
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: MediaStream) {}
  start(): void {}
  stop(): void {
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function fakeStream(): MediaStream {
  const track = { stop: vi.fn() };
  return {
    getTracks: () => [track],
  } as unknown as MediaStream;
}

afterEach(() => {
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = origMediaRecorder;
  setMediaDevices(origMediaDevices);
  vi.restoreAllMocks();
});

describe('recorder', () => {
  it('[정상] isRecordingSupported should be true when mediaDevices and MediaRecorder exist', () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
      FakeMediaRecorder;
    setMediaDevices({ getUserMedia: vi.fn() });
    expect(isRecordingSupported()).toBe(true);
  });

  it('[예외] isRecordingSupported should be false when MediaRecorder is undefined', () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
    setMediaDevices({ getUserMedia: vi.fn() });
    expect(isRecordingSupported()).toBe(false);
  });

  it('[예외] startRecording should throw when unsupported (AC3)', async () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
    setMediaDevices(undefined);
    await expect(startRecording()).rejects.toThrow();
  });

  it('[예외] startRecording should reject when getUserMedia is denied (AC3)', async () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
      FakeMediaRecorder;
    setMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
    });
    await expect(startRecording()).rejects.toThrow();
  });

  it('[정상] start then stop should resolve a Blob and stop tracks (AC1)', async () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
      FakeMediaRecorder;
    const stream = fakeStream();
    setMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(stream) });
    const rec = await startRecording();
    const blob = await rec.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
  });
});
