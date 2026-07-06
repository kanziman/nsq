import { redirect } from 'next/navigation';
import { getEpisodeById, getEpisodeSegments } from '@/lib/services/episodes';
import { ShadowingPlayer } from '@/components/player/shadowing-player';

export default async function EpisodePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const episode = await getEpisodeById(id);
  const segments = await getEpisodeSegments(id);

  if (
    !episode ||
    episode.importState?.status !== 'completed' ||
    segments.length === 0
  ) {
    redirect('/');
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 md:px-8 py-[32px] md:py-[48px]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] lg:gap-[32px]">
        {/* 좌측: 플레이어 + 스크립트 */}
        <div className="lg:col-span-8">
          <ShadowingPlayer episode={episode} segments={segments} />
        </div>

        {/* 우측 AI 튜터 패널 (골격) */}
        <aside className="lg:col-span-4 rounded-xl border border-hairline bg-surface-card p-[32px] h-fit">
          <h2 className="font-serif text-lg text-ink tracking-[-0.3px]">
            AI 튜터
          </h2>
          <p className="mt-[8px] text-sm text-muted-soft leading-[1.55]">
            준비 중입니다.
          </p>
        </aside>
      </div>
    </main>
  );
}
