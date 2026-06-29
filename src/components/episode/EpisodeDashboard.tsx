'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import EpisodeCard from './EpisodeCard';
import type { Episode } from '@/lib/types';

const IN_PROGRESS_STATUSES = new Set([
  'downloading',
  'processing_subtitles',
  'processing_transcript',
  'aligning',
]);

function hasInProgress(list: Episode[]): boolean {
  return list.some(
    (ep) => ep.importState && IN_PROGRESS_STATUSES.has(ep.importState.status),
  );
}

export default function EpisodeDashboard() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/episodes');
      if (!res.ok) {
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setEpisodes(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '에피소드를 불러오는데 에러가 발생했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCardDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/episodes/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '삭제 중 오류가 발생했습니다.');
      }
      setEpisodes((prev) => (prev ? prev.filter((ep) => ep.id !== id) : null));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '삭제에 실패했습니다.';
      alert(msg);
    }
  };

  // 1. 마운트 시 초기 호출
  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  // 2. 진행 중인 에피소드 감지 시 3초 주기 조건부 폴링
  useEffect(() => {
    if (!episodes || !hasInProgress(episodes) || error) {
      return;
    }
    const timer = setInterval(() => {
      fetchEpisodes();
    }, 3000);

    return () => clearInterval(timer);
  }, [episodes, fetchEpisodes, error]);

  // 3. 에러 발생 시 처리
  if (error && !loading) {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-6 border border-primary/20 rounded-lg bg-surface-card">
        <p className="text-ink font-serif text-lg">
          에피소드를 불러오는데 에러가 발생했습니다.
        </p>
        {error && <p className="text-xs text-muted-soft font-mono">{error}</p>}
        <button
          onClick={() => fetchEpisodes(true)}
          className="h-10 px-6 rounded bg-primary text-primary-foreground font-medium hover:bg-primary-active transition-colors cursor-pointer"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 4. 초기 스켈레톤 로딩
  if (loading && !episodes) {
    return (
      <div
        data-testid="skeleton-loader"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse"
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-64 rounded-lg bg-hairline/20 border border-hairline"
          />
        ))}
      </div>
    );
  }

  // 5. 빈 목록 상태 (Empty State)
  if (episodes && episodes.length === 0) {
    return (
      <div className="max-w-md mx-auto p-12 text-center border border-dashed border-hairline rounded-lg space-y-6">
        <div className="space-y-2">
          <h3 className="font-serif text-xl text-ink">
            등록된 에피소드가 없습니다.
          </h3>
          <p className="text-sm text-muted-soft leading-relaxed">
            YouTube 비디오 주소와 대본 링크를 기입해 나만의 첫 쉐도잉 에피소드를
            임포트해보세요!
          </p>
        </div>
        <Link
          href="/import"
          className="inline-flex h-10 items-center justify-center px-6 rounded bg-primary text-primary-foreground font-medium hover:bg-primary-active transition-colors"
        >
          첫 에피소드 임포트하기
        </Link>
      </div>
    );
  }

  // 6. 정상 목록 렌더링
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {episodes?.map((ep) => (
        <EpisodeCard key={ep.id} episode={ep} onDelete={handleCardDelete} />
      ))}
    </div>
  );
}
