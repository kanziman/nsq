/**
 * 임포트 파이프라인의 자막 전용(subtitle-only) 모드 세그먼트 스텝.
 * subtitle.{lang}.vtt → 큐 단위 segments.json 기록 (#124).
 * 문장 복원(sentence-builder, #125) 이전/실패 시의 폴백 산출이기도 하다.
 */
import fs from 'fs/promises';
import path from 'path';
import { LanguageCode, Segment } from '@/lib/types';
import { parseVttCues } from '@/lib/utils/vtt-parser';

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

/** 자막 전용 모드의 단일 화자 키(자막에는 화자 정보가 없다). */
export const SUBTITLE_ONLY_SPEAKER = 'SPEAKER';

export async function buildCueSegments(
  videoId: string,
  lang: LanguageCode,
): Promise<void> {
  const dir = path.join(EPISODES_DIR, videoId);
  const vttPath = path.join(dir, `subtitle.${lang}.vtt`);

  let raw: string;
  try {
    raw = await fs.readFile(vttPath, 'utf-8');
  } catch {
    throw new Error(`cue-segments: missing subtitle.${lang}.vtt (${vttPath})`);
  }

  const cues = parseVttCues(raw);
  if (cues.length === 0) {
    throw new Error(`cue-segments: no cues parsed from subtitle.${lang}.vtt`);
  }

  const segments: Segment[] = cues.map((cue, i) => ({
    id: `cue-${i + 1}`,
    start: cue.start,
    end: cue.end,
    speaker: SUBTITLE_ONLY_SPEAKER,
    text: cue.text,
  }));

  await fs.writeFile(
    path.join(dir, 'segments.json'),
    JSON.stringify(segments, null, 2),
    'utf-8',
  );
}
