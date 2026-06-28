/**
 * 임포트 파이프라인의 transcript(Freakonomics 스크래핑) 단계 모듈.
 * transcriptUrl → transcript.txt 산출.
 *
 * 주입형 fetcher로 HTML 취득 → transcript/parse → JSONL 기록.
 */
import fs from 'fs/promises';
import path from 'path';
import { parseTranscriptHtml } from './transcript/parse';

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

/** HTTP GET 추상. 기본 전역 fetch, 테스트는 고정 HTML/상태 반환 fake 주입. */
export type Fetcher = typeof fetch;

export async function fetchTranscript(
  videoId: string,
  transcriptUrl: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const res = await fetcher(transcriptUrl);
  if (!res.ok) {
    throw new Error(`transcript fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  const sentences = parseTranscriptHtml(html);
  if (sentences.length === 0) {
    throw new Error('transcript parse produced no sentences');
  }

  const outDir = path.join(EPISODES_DIR, videoId);
  await fs.mkdir(outDir, { recursive: true });
  // JSONL: 한 줄 = 하나의 Sentence. 항상 덮어쓰기(멱등 재생성).
  const jsonl = sentences.map((s) => JSON.stringify(s)).join('\n') + '\n';
  await fs.writeFile(path.join(outDir, 'transcript.txt'), jsonl, 'utf-8');
}
