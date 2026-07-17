import { redirect } from 'next/navigation';
import {
  getEpisodes,
  getEpisodeById,
  getEpisodeSegments,
} from '@/lib/services/episodes';
import { ShadowingPlayer } from '@/components/player/shadowing-player';

// public/episodes에 published된 에피소드를 빌드타임에 정적 생성한다(#160, SSG).
// 런타임 .shadowing fs 읽기를 없애 Vercel outputFileTracing 문제를 피한다.
export async function generateStaticParams(): Promise<{ id: string }[]> {
  const episodes = await getEpisodes();
  return episodes.map((e) => ({ id: e.id }));
}

// 정적 생성 목록에 없는 id는 런타임 온디맨드 렌더(=fs fallback)를 열지 않고 404 처리한다.
// 조회를 완전히 빌드타임 정적화하려는 취지(#160).
export const dynamicParams = false;

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
