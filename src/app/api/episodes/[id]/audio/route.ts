import { getEpisodeById } from '@/lib/services/episodes';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import path from 'node:path';

// 진행중으로 간주하여 스트리밍을 차단하는 상태들
const IN_PROGRESS = new Set<string>([
  'downloading',
  'processing_subtitles',
  'processing_transcript',
  'aligning',
]);

export async function GET(
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
        { error: 'Cannot stream audio while import is in progress.' },
        { status: 409 },
      );
    }

    // 3. 오디오 파일 존재 확인
    const audioPath = path.join(
      process.cwd(),
      '.shadowing/episodes',
      id,
      'audio.mp3',
    );
    if (!fs.existsSync(audioPath)) {
      return Response.json({ error: 'Audio file not found' }, { status: 404 });
    }

    // 4. 파일 크기 획득
    const stat = await fsPromises.stat(audioPath);
    const totalSize = stat.size;

    // 5. Range 헤더 파싱 및 분기
    const range = request.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      // 범위 유효성 체크 (416)
      if (
        isNaN(start) ||
        start >= totalSize ||
        end >= totalSize ||
        start > end
      ) {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${totalSize}`,
          },
        });
      }

      const chunkLength = end - start + 1;
      const stream = fs.createReadStream(audioPath, { start, end });

      return new Response(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkLength),
          'Content-Type': 'audio/mpeg',
        },
      });
    } else {
      // 일반 전체 스트림 응답
      const stream = fs.createReadStream(audioPath);
      return new Response(stream as any, {
        status: 200,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(totalSize),
          'Content-Type': 'audio/mpeg',
        },
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal Server Error';
    return Response.json({ error: message }, { status: 500 });
  }
}
