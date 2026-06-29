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
    <main className="mx-auto min-h-screen max-w-6xl p-6 md:p-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* 좌측: 플레이어 + 스크립트 */}
        <ShadowingPlayer episode={episode} segments={segments} />

        {/* 우측 AI 튜터 패널 (골격) */}
        <aside className="rounded-lg border border-hairline bg-surface-card p-5">
          <h2 className="font-serif text-lg text-ink">AI 튜터</h2>
          <p className="mt-2 text-sm text-muted-soft">준비 중입니다.</p>
        </aside>
      </div>
    </main>
  );
}
