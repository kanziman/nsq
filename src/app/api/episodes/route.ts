import { getEpisodes } from '@/lib/services/episodes';

export async function GET(request: Request): Promise<Response> {
  try {
    const episodes = await getEpisodes();
    return Response.json(episodes);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal Server Error';
    return Response.json({ error: message }, { status: 500 });
  }
}
