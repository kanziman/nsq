import { redirect } from 'next/navigation';
import { getEpisodeById, getEpisodeSegments } from '@/lib/services/episodes';
import ScriptView from '@/components/player/ScriptView';

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
      {/* 상단 dark 플레이어 영역 (골격 — Issue 2에서 동작 연결) */}
      <section className="sticky top-4 z-10 mb-8 rounded-lg bg-surface-dark p-6 text-on-dark">
        <h1 className="font-serif text-2xl">{episode.title}</h1>
        <p className="mt-1 text-sm text-on-dark-soft">플레이어 준비 중</p>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* 하단 cream 스크립트 영역 */}
        <section>
          <ScriptView segments={segments} />
        </section>

        {/* 우측 AI 튜터 패널 (골격) */}
        <aside className="rounded-lg border border-hairline bg-surface-card p-5">
          <h2 className="font-serif text-lg text-ink">AI 튜터</h2>
          <p className="mt-2 text-sm text-muted-soft">준비 중입니다.</p>
        </aside>
      </div>
    </main>
  );
}
