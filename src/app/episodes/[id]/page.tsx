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
      <ShadowingPlayer episode={episode} segments={segments} />
    </main>
  );
}
