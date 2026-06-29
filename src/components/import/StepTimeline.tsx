import * as React from 'react';
import type { ImportState } from '@/lib/types';

export interface StepTimelineProps {
  status: ImportState['status'];
  currentStep: string;
  progress: number;
}

type StepState = 'done' | 'active' | 'pending' | 'failed';

// 파이프라인 4단계 (currentStep 키 → 라벨).
const STEPS: { key: string; label: string }[] = [
  { key: 'download', label: '다운로드' },
  { key: 'subtitle', label: '자막' },
  { key: 'transcript', label: '대본' },
  { key: 'alignment', label: '정합' },
];

function activeIndex(currentStep: string): number {
  const i = STEPS.findIndex((s) => s.key === currentStep);
  // completed 등 단계 외 값이면 모든 단계를 지난 것으로 간주.
  return i === -1 ? STEPS.length : i;
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
}: StepTimelineProps): React.JSX.Element {
  const current = activeIndex(currentStep);

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-3">
        {STEPS.map((step, i) => {
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
