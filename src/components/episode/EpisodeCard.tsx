import Link from 'next/link';
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

export default function EpisodeCard({ episode }: { episode: Episode }) {
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

  // -------------------------------------------------------------
  // 1. 완료 상태 (Completed)
  // -------------------------------------------------------------
  if (status === 'completed') {
    return (
      <Link
        href={`/episodes/${episode.id}`}
        className="group block border border-hairline rounded-lg overflow-hidden bg-surface-base hover:border-primary-active transition-all duration-300"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-hairline/10">
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
          <div className="absolute bottom-2 right-2 bg-ink/75 text-white px-2 py-0.5 text-xs font-mono rounded">
            {formattedDuration}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <h3 className="font-serif text-ink font-normal text-lg leading-snug line-clamp-2 min-h-[3.25rem] group-hover:text-primary-active transition-colors">
            {title}
          </h3>
          <div className="flex items-center justify-between text-xs text-muted-soft pt-2 border-t border-hairline">
            <span>{formattedDate}</span>
            <span className="font-medium text-primary">학습하기 →</span>
          </div>
        </div>
      </Link>
    );
  }

  // -------------------------------------------------------------
  // 2. 진행 중 상태 (In Progress)
  // -------------------------------------------------------------
  if (status !== 'failed') {
    return (
      <div className="border border-hairline rounded-lg overflow-hidden bg-surface-base/60 max-w-sm flex flex-col justify-between">
        <div className="relative aspect-video w-full overflow-hidden bg-hairline/20 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink/5" />
          <div className="z-10 animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
        <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="font-serif text-muted font-normal text-lg leading-snug line-clamp-2">
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
            <div className="text-[10px] text-muted-soft text-right">
              {formattedDate}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. 실패 상태 (Failed)
  // -------------------------------------------------------------
  return (
    <div className="border border-primary/20 rounded-lg overflow-hidden bg-surface-base/90 max-w-sm flex flex-col justify-between">
      <div className="relative aspect-video w-full overflow-hidden bg-primary/5 flex items-center justify-center">
        <span className="z-10 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs tracking-wider uppercase">
          Failed
        </span>
      </div>
      <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="font-serif text-ink font-normal text-lg leading-snug line-clamp-2">
            {title || '알 수 없는 비디오'}
          </h3>
          {/* 에러 상세 툴팁 영역 (마우스 오버 툴팁 역할 겸 텍스트 영역) */}
          <div className="group relative p-2.5 rounded bg-surface-dark border border-hairline text-xs text-muted-soft leading-relaxed min-h-[3rem] overflow-hidden">
            <span className="line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
              {errorMsg || '임포트 중 상세 불명의 오류가 발생했습니다.'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-hairline">
          <span className="text-[10px] text-muted-soft">{formattedDate}</span>
          <Link
            href={`/import?videoId=${episode.id}`}
            className="inline-flex h-8 items-center justify-center px-4 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-active transition-colors cursor-pointer"
          >
            재시도
          </Link>
        </div>
      </div>
    </div>
  );
}
