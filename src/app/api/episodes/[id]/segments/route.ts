import { getEpisodeById, getEpisodeSegments } from '@/lib/services/episodes';

// 진행중으로 간주하여 조회를 차단하는 상태들
const IN_PROGRESS = new Set<string>([
  'downloading',
  'processing_subtitles',
  'processing_transcript',
  'aligning',
  'translating',
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;

    const episode = await getEpisodeById(id);
    if (!episode) {
      return Response.json({ error: 'Episode not found' }, { status: 404 });
    }

    const status = episode.importState?.status;
    if (status && IN_PROGRESS.has(status)) {
      return Response.json(
        { error: 'Cannot read segments while import is in progress.' },
        { status: 409 },
      );
    }

    const segments = await getEpisodeSegments(id);
    return Response.json(segments, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal Server Error';
    return Response.json({ error: message }, { status: 500 });
  }
}
