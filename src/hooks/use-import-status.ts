'use client';

import * as React from 'react';
import type { ImportState } from '@/lib/types';

export interface ImportStatusResult {
  state: ImportState | null;
  error: string | null;
  loading: boolean;
}

const DEFAULT_INTERVAL_MS = 2500;
const TERMINAL: ReadonlySet<ImportState['status']> = new Set([
  'completed',
  'failed',
]);

/**
 * videoId의 import-state를 폴링한다.
 * videoId가 null이면 비활성. 즉시 1회 + intervalMs마다 GET. 터미널 상태에서 중단.
 */
export function useImportStatus(
  videoId: string | null,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): ImportStatusResult {
  const [state, setState] = React.useState<ImportState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(videoId !== null);

  React.useEffect(() => {
    if (videoId === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(): Promise<void> {
      try {
        const res = await fetch(
          `/api/import?videoId=${encodeURIComponent(videoId as string)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(`상태를 찾을 수 없습니다 (HTTP ${res.status})`);
          setLoading(false);
          return;
        }
        const next = (await res.json()) as ImportState;
        if (cancelled) return;
        setState(next);
        setError(null);
        setLoading(false);
        if (!TERMINAL.has(next.status)) {
          timer = setTimeout(poll, intervalMs);
        }
      } catch {
        if (cancelled) return;
        setError('상태 조회 중 오류가 발생했습니다');
        setLoading(false);
      }
    }

    setLoading(true);
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [videoId, intervalMs]);

  return { state, error, loading };
}
