import { getEpisodeById, deleteEpisode } from '@/lib/services/episodes';

// 진행중으로 간주하여 삭제를 차단하는 상태들
const IN_PROGRESS = new Set<string>([
  'downloading',
  'processing_subtitles',
  'processing_transcript',
  'aligning',
]);

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;

    // 1. 에피소드 조회
    const episode = await getEpisodeById(id);
    if (!episode) {
      return Response.json({ error: 'Episode not found' }, { status: 404 });
    }

    // 2. 진행 상태 체크
    const status = episode.importState?.status;
    if (status && IN_PROGRESS.has(status)) {
      return Response.json(
        { error: 'Cannot delete episode while import is in progress.' },
        { status: 409 },
      );
    }

    // 3. 에피소드 디렉토리 삭제
    await deleteEpisode(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal Server Error';
    return Response.json({ error: message }, { status: 500 });
  }
}
