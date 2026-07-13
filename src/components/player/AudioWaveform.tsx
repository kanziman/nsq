import React, { useRef, useEffect, useCallback } from 'react';

export interface AudioWaveformProps {
  waveform: number[];
  currentTime: number;
  segmentStart: number;
  segmentEnd: number;
  onSeek: (time: number) => void;
  isLoading?: boolean;
}

export default function AudioWaveform({
  waveform,
  currentTime,
  segmentStart,
  segmentEnd,
  onSeek,
  isLoading = false,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = segmentEnd - segmentStart;
  const progress = duration > 0 ? (currentTime - segmentStart) / duration : 0;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLoading || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    onSeek(segmentStart + ratio * duration);
  };

  const displayWaveform =
    !isLoading && waveform.length > 0 ? waveform : new Array(80).fill(0.08);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const midY = H / 2;
    ctx.clearRect(0, 0, W, H);

    // 포인트 생성
    const count = displayWaveform.length;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= count; i++) {
      const idx = Math.min(i, count - 1);
      const val = displayWaveform[idx];
      const x = (i / count) * W;
      points.push({ x, y: val });
    }

    // 곡선 경로 생성 (sign: 1 = 위, -1 = 아래)
    function buildCurvePath(pts: { x: number; y: number }[], sign: number) {
      if (!ctx) return;
      const amplitude = (midY - 4) * sign;
      ctx.moveTo(pts[0].x, midY - pts[0].y * amplitude);
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const cpx = (prev.x + curr.x) / 2;
        const prevY = midY - prev.y * amplitude;
        const currY = midY - curr.y * amplitude;
        ctx.quadraticCurveTo(cpx, prevY, cpx, (prevY + currY) / 2);
        ctx.quadraticCurveTo(cpx, currY, curr.x, currY);
      }
    }

    // ── 미재생 영역 (전체 배경) ──
    // 위쪽
    ctx.beginPath();
    buildCurvePath(points, 1);
    ctx.lineTo(W, midY);
    ctx.lineTo(0, midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100, 120, 160, 0.18)';
    ctx.fill();

    // 아래쪽 (반전, 축소)
    ctx.beginPath();
    buildCurvePath(points, -0.45);
    ctx.lineTo(W, midY);
    ctx.lineTo(0, midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100, 120, 160, 0.10)';
    ctx.fill();

    // ── 재생된 영역 (클리핑) ──
    const px = clampedProgress * W;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, px, H);
    ctx.clip();

    // 위쪽 fill (재생됨) — 그라데이션
    const grad = ctx.createLinearGradient(0, 0, 0, midY);
    grad.addColorStop(0, 'rgba(99, 179, 237, 0.7)');
    grad.addColorStop(1, 'rgba(99, 179, 237, 0.12)');
    ctx.beginPath();
    buildCurvePath(points, 1);
    ctx.lineTo(px, midY);
    ctx.lineTo(0, midY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 위쪽 stroke (재생됨)
    ctx.beginPath();
    buildCurvePath(points, 1);
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 아래쪽 fill (재생됨)
    ctx.beginPath();
    buildCurvePath(points, -0.45);
    ctx.lineTo(px, midY);
    ctx.lineTo(0, midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 179, 237, 0.10)';
    ctx.fill();

    ctx.restore();

    // ── 중앙 라인 ──
    ctx.strokeStyle = 'rgba(100, 120, 160, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    // ── 플레이헤드 ──
    if (!isLoading && clampedProgress > 0 && clampedProgress < 1) {
      ctx.fillStyle = 'rgba(99, 179, 237, 0.6)';
      ctx.fillRect(px - 0.5, 4, 1, H - 8);
      // 플레이헤드 도트
      ctx.beginPath();
      ctx.arc(px, midY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, midY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#63b3ed';
      ctx.fill();
    }
  }, [displayWaveform, clampedProgress, isLoading]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 리사이즈 대응
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => draw());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="오디오 파형"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedProgress * 100)}
      className={`w-full h-14 cursor-pointer ${
        isLoading ? 'animate-pulse pointer-events-none opacity-50' : ''
      }`}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        role="presentation"
      />
    </div>
  );
}
