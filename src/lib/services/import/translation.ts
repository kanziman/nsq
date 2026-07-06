/**
 * 임포트 파이프라인의 translation(번역) 단계 코어.
 * segments.json을 읽어 translation이 없는 세그먼트만 배치로 묶어 주입 translator로
 * 번역하고, 결과를 병합해 같은 segments.json에 재기록한다(A안 In-place).
 *
 * 정책(spec-fixed §3·§6):
 * - 멱등: 이미 translation이 있는 세그먼트는 재번역하지 않는다.
 * - best-effort: 배치 실패/길이 불일치는 그 배치만 스킵하고 계속 진행한다.
 * - 빈/공백 text는 번역 대상에서 제외한다.
 */
import fs from 'fs/promises';
import path from 'path';
import { Segment } from '@/lib/types';

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

// 한 번의 번역 호출로 묶는 인접 세그먼트 수(문맥 유지 단위). spec-fixed §B3.
const DEFAULT_BATCH_SIZE = 20;

/** 세그먼트 배치를 받아 동일 길이의 한국어 번역 배열을 반환하는 번역기 계약. */
export type SegmentTranslator = (batch: Segment[]) => Promise<string[]>;

export interface TranslateDeps {
  translator: SegmentTranslator;
  batchSize?: number; // 기본 20
}

// 번역이 필요한 세그먼트: translation이 비어있고 text가 공백이 아닌 것.
function needsTranslation(seg: Segment): boolean {
  return (
    (seg.translation == null || seg.translation.trim() === '') &&
    seg.text.trim() !== ''
  );
}

export async function translate(
  videoId: string,
  deps: TranslateDeps,
): Promise<void> {
  const { translator, batchSize = DEFAULT_BATCH_SIZE } = deps;
  const segPath = path.join(EPISODES_DIR, videoId, 'segments.json');

  const raw = await fs.readFile(segPath, 'utf-8');
  const segments = JSON.parse(raw) as Segment[];

  // 원본 인덱스를 보존한 채 번역 대상만 추린다(멱등·빈 텍스트 제외).
  const targets = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => needsTranslation(segment));

  let mutated = false;
  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    try {
      const results = await translator(batch.map((t) => t.segment));
      // 길이 불일치 응답은 비결정성 방어로 그 배치 전체 스킵(spec-fixed §B5).
      if (results.length !== batch.length) continue;
      batch.forEach((t, j) => {
        segments[t.index].translation = results[j];
      });
      mutated = true;
    } catch {
      // 배치 실패 격리: 이 배치만 건너뛰고 계속 진행(best-effort).
      continue;
    }
  }

  if (mutated) {
    await fs.writeFile(segPath, JSON.stringify(segments, null, 2), 'utf-8');
  }
}
