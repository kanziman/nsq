import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import type { Episode } from '@/lib/types';

function formatDuration(sec: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad(m)}:${pad(s)}`;
}

const STEP_NAMES: Record<string, string> = {
  downloading: 'YouTube 다운로드 중',
  processing_subtitles: '자막 분석 중',
  processing_transcript: '대본 분석 중',
  aligning: '대본 정합 중',
};

export default function EpisodeCard({
  episode,
  onDelete,
}: {
  episode: Episode;
  onDelete: (_id: string) => Promise<void>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { title, duration, addedAt, importState } = episode;
  const status = importState?.status ?? 'completed';
  const progress = importState?.progress ?? 0;
  const currentStep = importState?.currentStep ?? '';
  const errorMsg = importState?.error ?? '';

  const thumbnail = `https://i.ytimg.com/vi/${episode.id}/hqdefault.jpg`;
  const formattedDuration = formatDuration(duration);
  const formattedDate = new Date(addedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const stepText =
    STEP_NAMES[status] || STEP_NAMES[currentStep] || '임포트 처리 중';

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await onDelete(episode.id);
    } catch {
      // 대시보드 에러 전파 처리
    } finally {
      setShowConfirm(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(false);
  };

  // -------------------------------------------------------------
  // 1. 공통 모달 렌더링 헬퍼
  // -------------------------------------------------------------
  const renderConfirmModal = () => {
    if (!showConfirm) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
        <div className="bg-surface-card border border-hairline p-6 rounded-xl max-w-sm w-full mx-4 shadow-xl space-y-6 animate-in fade-in-50 zoom-in-95 duration-200">
          <div className="space-y-2">
            <h4 className="font-serif text-lg text-ink font-medium tracking-[-0.3px]">
              에피소드를 삭제하시겠습니까?
            </h4>
            <p className="text-xs text-muted-soft leading-[1.55]">
              다운로드된 오디오 및 대본 정보가 컴퓨터에서 영구적으로 삭제됩니다.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCancelDelete}
              className="h-9 px-4 rounded-md border border-hairline text-xs font-medium text-muted hover:bg-hairline/10 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleConfirmDelete}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-active transition-colors cursor-pointer"
            >
              진짜 삭제
            </button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // 2. 완료 상태 (Completed)
  // -------------------------------------------------------------
  if (status === 'completed') {
    return (
      <div className="group relative border border-hairline rounded-xl overflow-hidden bg-surface-card hover:border-primary-active transition-all duration-300 flex flex-col">
        {renderConfirmModal()}
        <div className="relative aspect-video w-full overflow-hidden bg-hairline/10">
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
          <button
            aria-label="삭제"
            onClick={handleDeleteClick}
            className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-surface-card/90 text-ink border border-hairline rounded-full shadow-sm backdrop-blur-sm transition-all duration-300 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 cursor-pointer"
          >
            <Trash2 className="h-4 w-4 text-ink" strokeWidth={1.5} />
          </button>
          <div className="absolute bottom-2 right-2 bg-ink/75 text-white px-2 py-0.5 text-xs font-mono rounded">
            {formattedDuration}
          </div>
        </div>
        <div className="p-[24px] flex-grow flex flex-col justify-between space-y-3">
          <h3 className="font-sans text-ink font-medium text-[16px] leading-snug tracking-tight line-clamp-2 min-h-[2.75rem] group-hover:text-primary-active transition-colors">
            {title}
          </h3>

          <div className="flex items-center justify-between text-xs text-muted-soft pt-2 border-t border-hairline">
            <span>{formattedDate}</span>
            <div className="flex items-center">
              <Link
                href={`/episodes/${episode.id}`}
                className="font-medium text-primary hover:text-primary-active"
              >
                학습하기 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status !== 'failed') {
    return (
      <div className="border border-hairline rounded-xl overflow-hidden bg-surface-card/60 max-w-sm flex flex-col justify-between relative">
        <div className="relative aspect-video w-full overflow-hidden bg-hairline/20 flex items-center justify-center">
          <button
            aria-label="삭제"
            disabled
            className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-surface-card/40 text-ink/40 border border-hairline/40 rounded-full shadow-sm backdrop-blur-sm cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4 text-ink/40" strokeWidth={1.5} />
          </button>
          <div className="absolute inset-0 bg-ink/5" />
          <div className="z-10 animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
        <div className="p-[24px] space-y-4 flex-grow flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="font-sans text-muted font-medium text-[16px] leading-snug tracking-tight line-clamp-2 min-h-[2.75rem]">
              {title || '새 에피소드 임포트 중...'}
            </h3>
            <p className="text-xs text-primary font-medium">
              {stepText} ({progress}%)
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {/* 프로그레스바 */}
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full bg-hairline/20 h-1.5 rounded-full overflow-hidden"
            >
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] text-muted-soft">{formattedDate}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 4. 실패 상태 (Failed)
  // -------------------------------------------------------------
  return (
    <div className="border border-primary/20 rounded-xl overflow-hidden bg-surface-card/90 max-w-sm flex flex-col justify-between relative">
      {renderConfirmModal()}
      <div className="relative aspect-video w-full overflow-hidden bg-primary/5 flex items-center justify-center">
        <button
          aria-label="삭제"
          onClick={handleDeleteClick}
          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-surface-card/90 text-ink border border-hairline rounded-full shadow-sm backdrop-blur-sm transition-all duration-300 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 cursor-pointer"
        >
          <Trash2 className="h-4 w-4 text-ink" strokeWidth={1.5} />
        </button>
        <span className="z-10 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-xs tracking-[1.5px] uppercase">
          Failed
        </span>
      </div>
      <div className="p-[24px] space-y-4 flex-grow flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="font-sans text-ink font-medium text-[16px] leading-snug tracking-tight line-clamp-2 min-h-[2.75rem]">
            {title || '알 수 없는 비디오'}
          </h3>
          <div className="group relative p-2.5 rounded-md bg-surface-dark border border-hairline text-xs text-muted-soft leading-[1.55] min-h-[3rem] overflow-hidden">
            <span className="line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
              {errorMsg || '임포트 중 상세 불명의 오류가 발생했습니다.'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-hairline">
          <span className="text-[10px] text-muted-soft">{formattedDate}</span>
          <div className="flex items-center">
            <Link
              href={`/import?videoId=${episode.id}`}
              className="inline-flex h-8 items-center justify-center px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-active transition-colors cursor-pointer"
            >
              재시도
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
