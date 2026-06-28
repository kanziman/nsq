// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StepTimeline } from './StepTimeline';

afterEach(cleanup);

function stateOf(label: string): string | null {
  return screen.getByText(label).getAttribute('data-state');
}

describe('StepTimeline', () => {
  it('should mark prior steps done, current active, later pending', () => {
    render(
      <StepTimeline
        status="processing_transcript"
        currentStep="transcript"
        progress={70}
      />,
    );
    expect(stateOf('다운로드')).toBe('done');
    expect(stateOf('자막')).toBe('done');
    expect(stateOf('대본')).toBe('active');
    expect(stateOf('정합')).toBe('pending');
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '70',
    );
  });

  it('should mark all steps done on completed', () => {
    render(
      <StepTimeline
        status="completed"
        currentStep="completed"
        progress={100}
      />,
    );
    for (const label of ['다운로드', '자막', '대본', '정합']) {
      expect(stateOf(label)).toBe('done');
    }
  });

  it('should mark current step failed on failed status', () => {
    render(
      <StepTimeline status="failed" currentStep="alignment" progress={90} />,
    );
    expect(stateOf('대본')).toBe('done');
    expect(stateOf('정합')).toBe('failed');
  });
});
