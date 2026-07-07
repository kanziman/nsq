import * as React from 'react';
import type { ImportState } from '@/lib/types';

/** 임포트 모드별 타임라인 단계 구성 (#125). */
export type TimelineMode = 'transcript' | 'subtitle-only';

export interface StepTimelineProps {
  status: ImportState['status'];
  currentStep: string;
  progress: number;
  mode?: TimelineMode; // 기본 'transcript'
}

type StepState = 'done' | 'active' | 'pending' | 'failed';

// 모드별 파이프라인 4단계 (currentStep 키 → 라벨).
const STEPS_BY_MODE: Record<TimelineMode, { key: string; label: string }[]> = {
  transcript: [
    { key: 'download', label: '다운로드' },
    { key: 'subtitle', label: '자막' },
    { key: 'transcript', label: '대본' },
    { key: 'alignment', label: '정합' },
  ],
  'subtitle-only': [
    { key: 'download', label: '다운로드' },
    { key: 'subtitle', label: '자막' },
    { key: 'segments', label: '세그먼트' },
    { key: 'sentences', label: '문장' },
  ],
};

function activeIndex(steps: { key: string }[], currentStep: string): number {
  const i = steps.findIndex((s) => s.key === currentStep);
  // completed 등 단계 외 값이면 모든 단계를 지난 것으로 간주.
  return i === -1 ? steps.length : i;
}

function stepStateAt(
  index: number,
  current: number,
  status: ImportState['status'],
): StepState {
  if (status === 'completed') return 'done';
  if (index < current) return 'done';
  if (index === current) return status === 'failed' ? 'failed' : 'active';
  return 'pending';
}

const STATE_CLASS: Record<StepState, string> = {
  done: 'text-accent-teal',
  active: 'text-primary',
  failed: 'text-primary',
  pending: 'text-muted',
};

export function StepTimeline({
  status,
  currentStep,
  progress,
  mode = 'transcript',
}: StepTimelineProps): React.JSX.Element {
  const steps = STEPS_BY_MODE[mode];
  const current = activeIndex(steps, currentStep);

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-3">
        {steps.map((step, i) => {
          const state = stepStateAt(i, current, status);
          return (
            <li
              key={step.key}
              data-step={step.key}
              data-state={state}
              className={`text-sm font-medium ${STATE_CLASS[state]}`}
            >
              {step.label}
            </li>
          );
        })}
      </ol>
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
