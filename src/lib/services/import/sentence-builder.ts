/**
 * 임포트 파이프라인의 sentences(문장 복원) 단계 코어 (#125).
 * 자막 전용 모드의 큐 세그먼트를 LLM으로 자연 문장 단위로 병합·구두점 복원해
 * segments.json을 재기록한다. translation.ts와 동형 컨벤션(DI·배치·best-effort·증분 저장).
 */
import fs from 'fs/promises';
import path from 'path';
import { Segment } from '@/lib/types';
import { OpenRouterConfig } from './translation';

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

/** 한 문장이 소비한 연속 큐 수. cueCount 합 = 배치 큐 수(파티션 계약). */
export interface SentenceGroup {
  text: string;
  cueCount: number;
}

/** 큐 배치(+이전 배치 말미 문맥 힌트)를 받아 순서대로 큐를 소비하는 문장 그룹을 반환. */
export type SentenceBuilder = (
  cues: Segment[],
  contextHint?: string,
) => Promise<SentenceGroup[]>;

export interface BuildSentencesDeps {
  builder: SentenceBuilder;
  batchSize?: number; // 기본 SENTENCE_BATCH_SIZE
}

// 한 번의 LLM 호출로 묶는 큐 수(spec-fixed B5).
export const SENTENCE_BATCH_SIZE = 60;

// 그룹 목록이 배치를 정확히 파티션하는지(합·양의 정수·비어있지 않은 문장) 검증.
function isValidPartition(groups: SentenceGroup[], batchLen: number): boolean {
  if (!Array.isArray(groups) || groups.length === 0) return false;
  let sum = 0;
  for (const g of groups) {
    if (typeof g.text !== 'string' || g.text.trim() === '') return false;
    if (!Number.isInteger(g.cueCount) || g.cueCount < 1) return false;
    sum += g.cueCount;
  }
  return sum === batchLen;
}

export async function buildSentences(
  videoId: string,
  deps: BuildSentencesDeps,
): Promise<void> {
  const { builder, batchSize = SENTENCE_BATCH_SIZE } = deps;
  const segPath = path.join(EPISODES_DIR, videoId, 'segments.json');

  const raw = await fs.readFile(segPath, 'utf-8');
  const cues = JSON.parse(raw) as Segment[];

  const out: Segment[] = [];
  let sentNo = 0;
  let mergedCount = 0;
  let lastSentence: string | undefined;
  const batchCount = Math.ceil(cues.length / batchSize);

  for (let i = 0; i < cues.length; i += batchSize) {
    const batchNo = Math.floor(i / batchSize) + 1;
    const batch = cues.slice(i, i + batchSize);
    try {
      const groups = await builder(batch, lastSentence);
      // 파티션 불일치는 비결정성 방어로 그 배치 전체를 원본 큐로 유지한다.
      if (!isValidPartition(groups, batch.length)) {
        console.warn(
          `sentence-builder: batch ${batchNo}/${batchCount} invalid partition, kept cues`,
        );
        out.push(...batch);
        continue;
      }
      let offset = 0;
      for (const group of groups) {
        sentNo += 1;
        const first = batch[offset];
        const last = batch[offset + group.cueCount - 1];
        out.push({
          id: `sent-${sentNo}`,
          start: first.start,
          end: last.end,
          speaker: first.speaker,
          text: group.text,
        });
        offset += group.cueCount;
      }
      lastSentence = groups[groups.length - 1].text;
      mergedCount += batch.length;
      // 증분 저장: 배치 성공 즉시 (완료분 + 남은 원본 큐)를 반영해 중간 중단에도 보존.
      await fs.writeFile(
        segPath,
        JSON.stringify([...out, ...cues.slice(i + batchSize)], null, 2),
        'utf-8',
      );
    } catch (err) {
      // 배치 실패 격리: 이 배치만 원본 큐로 두고 계속 진행(best-effort).
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `sentence-builder: batch ${batchNo}/${batchCount} failed (${message}), kept cues`,
      );
      out.push(...batch);
      continue;
    }
  }

  await fs.writeFile(segPath, JSON.stringify(out, null, 2), 'utf-8');
  console.log(
    `sentence-builder: ${mergedCount}/${cues.length} cues merged into ${sentNo} sentences for ${videoId}`,
  );
}

// ── OpenRouter 문장 복원기 ──────────────────────────────────────────

const DEFAULT_MODEL = 'google/gemini-3.5-flash';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60_000;

// 파편 큐를 원문 언어 그대로 완결 문장으로 병합하도록 지시하는 시스템 프롬프트.
const SYSTEM_PROMPT =
  '너는 자막 편집자다. 파편화된 자막 큐들을 원문 언어 그대로 자연스러운 완결 문장으로 병합하고 ' +
  '구두점을 복원한다. 큐 순서를 유지하고 내용을 요약·창작·번역하지 마라. ' +
  '각 문장이 소비한 연속 큐 개수(cueCount)를 함께 반환하며, cueCount의 합은 입력 큐 수와 정확히 같아야 한다. ' +
  '설명·코드펜스 없이 JSON 배열 [{"text":"...","cueCount":n}] 만 출력한다. ' +
  '(Respond ONLY with a JSON array of {text, cueCount} objects.)';

// 배치 큐(+이전 문맥)를 번호 목록 사용자 메시지로 직렬화.
function buildUserContent(batch: Segment[], contextHint?: string): string {
  const lines = batch.map((c, i) => `${i + 1}. ${c.text}`);
  const hint = contextHint
    ? `이전 문맥(참고용, 병합 대상 아님): ${contextHint}\n\n`
    : '';
  return `${hint}다음 ${batch.length}개 큐를 문장으로 병합하라:\n${lines.join('\n')}`;
}

// 모델 응답에서 코드펜스를 제거하고 SentenceGroup[]을 파싱. 실패 시 null.
function parseGroups(content: string): SentenceGroup[] | null {
  const stripped = content
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (g) =>
          g !== null &&
          typeof g === 'object' &&
          typeof (g as SentenceGroup).text === 'string' &&
          typeof (g as SentenceGroup).cueCount === 'number',
      )
    ) {
      return parsed as SentenceGroup[];
    }
  } catch {
    // 파싱 실패
  }
  return null;
}

/**
 * OpenRouter(chat completions)로 큐 배치를 문장 그룹으로 병합하는 SentenceBuilder 팩토리.
 * - 파싱 실패/파티션 불일치 → 빈 배열 반환(호출측 buildSentences가 스킵).
 * - HTTP 오류/키 부재 → throw(호출측 배치 실패 격리에 흡수).
 */
export function createOpenRouterSentenceBuilder(
  config: OpenRouterConfig,
): SentenceBuilder {
  const {
    apiKey,
    model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    baseUrl = process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = config;

  return async (batch, contextHint): Promise<SentenceGroup[]> => {
    if (!apiKey) {
      throw new Error('sentence-builder: OPENROUTER_API_KEY is not set');
    }

    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserContent(batch, contextHint) },
        ],
        // 병합·구두점 복원엔 무거운 사고가 불필요 — translation과 동일하게 최저로 낮춘다.
        reasoning: { effort: 'low' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`sentence-builder: OpenRouter HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const groups = parseGroups(content);

    // 파싱 실패·파티션 불일치는 빈 배열로 신호 → buildSentences가 해당 배치 스킵.
    if (!groups || !isValidPartition(groups, batch.length)) return [];
    return groups;
  };
}
