'use client';

import * as React from 'react';
import type { ImportState, RetryStep } from '@/lib/types';
import { useImportStatus } from '@/hooks/use-import-status';
import { Button } from '@/components/ui/button';
import { StepTimeline } from './StepTimeline';

export interface ImportMonitorProps {
  videoId: string;
}

/**
 * 실패한 currentStep을 안전한 재시도 계획(retryStep + 버튼 라벨)으로 매핑한다.
 * download/subtitle 실패 → 처음부터(all), transcript/alignment 실패 → 대본·정합부터(transcript).
 * 매핑되지 않는 단계는 null(재시도 버튼 미노출).
 */
export function retryPlanFor(
  currentStep: string,
): { retryStep: RetryStep; label: string } | null {
  if (currentStep === 'download' || currentStep === 'subtitle') {
    return { retryStep: 'all', label: '전체 재시도' };
  }
  if (currentStep === 'transcript' || currentStep === 'alignment') {
    return { retryStep: 'transcript', label: '대본·정합 재시도' };
  }
  return null;
}

const STATUS_LABEL: Record<ImportState['status'], string> = {
  idle: '대기',
  downloading: '다운로드 중',
  processing_subtitles: '자막 처리 중',
  processing_transcript: '대본 처리 중',
  aligning: '정합 중',
  translating: '번역 중',
  completed: '완료',
  failed: '실패',
};

export function ImportMonitor({
  videoId,
}: ImportMonitorProps): React.JSX.Element {
  const { state, error, loading, restart } = useImportStatus(videoId);

  async function handleRetry(retryStep: RetryStep): Promise<void> {
    if (!state) return;
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: state.youtubeUrl,
        transcriptUrl: state.transcriptUrl,
        retryStep,
      }),
    });
    if (res.status === 202) {
      restart();
    }
  }

  if (error && !state) {
    return (
      <p role="alert" className="text-sm text-primary">
        {error}
      </p>
    );
  }

  if (!state) {
    return (
      <p className="text-sm text-muted">{loading ? '불러오는 중…' : ''}</p>
    );
  }

  const retryPlan =
    state.status === 'failed' ? retryPlanFor(state.currentStep) : null;

  return (
    <div className="space-y-6">
      <StepTimeline
        status={state.status}
        currentStep={state.currentStep}
        progress={state.progress}
      />

      <p className="text-sm font-medium text-ink">
        {STATUS_LABEL[state.status]}
      </p>

      {state.status === 'completed' && (
        <div className="space-y-1">
          <p className="text-sm text-accent-teal">임포트가 완료되었습니다.</p>
          {state.matchRate !== undefined && (
            <p className="text-sm text-muted">
              정합 품질 (matchRate): {Math.round(state.matchRate * 100)}%
            </p>
          )}
        </div>
      )}

      {state.status === 'failed' && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-primary">
            {state.error ?? '임포트에 실패했습니다.'}
          </p>
          {retryPlan && (
            <Button
              type="button"
              variant="primary"
              onClick={() => handleRetry(retryPlan.retryStep)}
            >
              {retryPlan.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
