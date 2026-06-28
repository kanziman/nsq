'use client';

import * as React from 'react';
import type { ImportState } from '@/lib/types';
import { useImportStatus } from '@/hooks/use-import-status';
import { StepTimeline } from './StepTimeline';

export interface ImportMonitorProps {
  videoId: string;
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
  const { state, error, loading } = useImportStatus(videoId);

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
        <p role="alert" className="text-sm text-primary">
          {state.error ?? '임포트에 실패했습니다.'}
        </p>
      )}
    </div>
  );
}
