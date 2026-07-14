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
  minChunk?: number; // 기본 MIN_MERGE_CHUNK — 적응 분할 하한
}

// 한 번의 LLM 호출로 묶는 큐 수. 카운트 오류의 폭발 반경을 줄이려 축소했다(#143, was 60).
export const SENTENCE_BATCH_SIZE = 20;

// 파티션 불일치 시 이 크기 이하로는 더 쪼개지 않고 원본 큐를 유지한다(#143).
export const MIN_MERGE_CHUNK = 5;

// 재병합 대상(원본 자동자막 큐) 판별. 이미 병합된 sent-*는 재시도 시 그대로 통과시킨다.
function isRawCue(seg: Segment): boolean {
  return typeof seg.id === 'string' && seg.id.startsWith('cue-');
}

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

// 완결 문장 종결부호(。！？) 경계로 분할한다. 부호는 앞 문장에 유지, trim·빈 조각 제거(#147).
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 여러 완결 문장을 담은 세그먼트를 문장별로 분할한다(#147). 그룹 [start,end)를 글자수
// 비례로 재분배(첫 조각.start=base.start, 마지막.end=base.end, 단조), speaker 계승.
// 짧은 완결 문장도 흡수 없이 독립 유지한다(최소길이 병합 없음).
function splitSegmentBySentences(base: Segment): Segment[] {
  const parts = splitIntoSentences(base.text);
  // 단일 문장이면 분할 없이(부호·공백만 정돈된) 세그먼트 하나로 둔다.
  if (parts.length <= 1) return [{ ...base, text: parts[0] ?? base.text }];
  const totalChars = parts.reduce((sum, p) => sum + p.length, 0);
  const span = base.end - base.start;
  const segs: Segment[] = [];
  let cum = 0;
  for (let idx = 0; idx < parts.length; idx += 1) {
    const start = base.start + (span * cum) / totalChars;
    cum += parts[idx].length;
    const end =
      idx === parts.length - 1
        ? base.end
        : base.start + (span * cum) / totalChars;
    segs.push({ id: '', start, end, speaker: base.speaker, text: parts[idx] });
  }
  return segs;
}

// 유효 파티션 그룹을 큐 시각에 매핑해 문장 세그먼트로 만든다. 그룹이 여러 완결 문장을
// 담으면 문장별로 분할한다(#147). id는 빈 문자열('')로 두고 최종 renumber에서 sent-N 부여.
function groupsToSegments(groups: SentenceGroup[], cues: Segment[]): Segment[] {
  const segs: Segment[] = [];
  let offset = 0;
  for (const group of groups) {
    const first = cues[offset];
    const last = cues[offset + group.cueCount - 1];
    const base: Segment = {
      id: '',
      start: first.start,
      end: last.end,
      speaker: first.speaker,
      text: group.text,
    };
    segs.push(...splitSegmentBySentences(base));
    offset += group.cueCount;
  }
  return segs;
}

/**
 * 큐 청크를 적응적으로 병합한다(#143). builder 결과가 유효 파티션이면 문장으로 매핑하고,
 * 파티션 불일치면 절반으로 분할해 재귀한다(왼쪽 먼저 → 오른쪽은 왼쪽 마지막 문장을 hint로).
 * minChunk 이하에서도 불일치면 원본 큐를 유지한다. builder throw(API 오류)는 분할해도
 * 소용없으므로 원본 큐 유지. ⇒ 불일치 격리 범위가 배치 전체가 아니라 ≤minChunk로 축소된다.
 */
async function mergeChunk(
  cues: Segment[],
  builder: SentenceBuilder,
  contextHint: string | undefined,
  minChunk: number,
): Promise<Segment[]> {
  if (cues.length === 0) return [];
  try {
    const groups = await builder(cues, contextHint);
    if (isValidPartition(groups, cues.length)) {
      return groupsToSegments(groups, cues);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `sentence-builder: chunk(${cues.length}) failed (${message}), kept cues`,
    );
    return cues;
  }
  // 파티션 불일치: 하한 이하면 원본 유지, 아니면 절반 분할 재귀.
  if (cues.length <= minChunk) {
    console.warn(
      `sentence-builder: chunk(${cues.length}) invalid partition at floor, kept cues`,
    );
    return cues;
  }
  const mid = Math.floor(cues.length / 2);
  const left = await mergeChunk(
    cues.slice(0, mid),
    builder,
    contextHint,
    minChunk,
  );
  const hint = left.length ? left[left.length - 1].text : contextHint;
  const right = await mergeChunk(cues.slice(mid), builder, hint, minChunk);
  return [...left, ...right];
}

// 문장 세그먼트(비-cue)에 sent-N을 순차 부여한다. 원본 큐(cue-*)는 id를 보존한다.
function renumber(segs: Segment[]): Segment[] {
  let n = 0;
  return segs.map((s) => (isRawCue(s) ? s : { ...s, id: `sent-${(n += 1)}` }));
}

export async function buildSentences(
  videoId: string,
  deps: BuildSentencesDeps,
): Promise<void> {
  const {
    builder,
    batchSize = SENTENCE_BATCH_SIZE,
    minChunk = MIN_MERGE_CHUNK,
  } = deps;
  const segPath = path.join(EPISODES_DIR, videoId, 'segments.json');

  const raw = await fs.readFile(segPath, 'utf-8');
  const entries = JSON.parse(raw) as Segment[];

  const out: Segment[] = [];
  let lastSentence: string | undefined;
  let cueTotal = 0;

  let i = 0;
  while (i < entries.length) {
    // 이미 병합된 sent-* 등은 그대로 통과(재시도 시 보존, #143 AC3).
    if (!isRawCue(entries[i])) {
      out.push(entries[i]);
      lastSentence = entries[i].text;
      i += 1;
      continue;
    }
    // 연속한 cue-* 런을 모아 batchSize 청크로 적응 병합. 단, speaker가 바뀌면 런을 끊어
    // 병합이 화자 경계를 넘지 않게 한다(턴 보존, #147 AC5).
    let j = i;
    while (
      j < entries.length &&
      isRawCue(entries[j]) &&
      entries[j].speaker === entries[i].speaker
    )
      j += 1;
    const run = entries.slice(i, j);
    cueTotal += run.length;
    for (let k = 0; k < run.length; k += batchSize) {
      const chunk = run.slice(k, k + batchSize);
      const merged = await mergeChunk(chunk, builder, lastSentence, minChunk);
      out.push(...merged);
      if (merged.length) lastSentence = merged[merged.length - 1].text;
      // 증분 저장: (완료분 + 런 잔여 + 남은 원본 항목)을 반영해 중간 중단에도 보존.
      const remaining = [...run.slice(k + batchSize), ...entries.slice(j)];
      await fs.writeFile(
        segPath,
        JSON.stringify(renumber([...out, ...remaining]), null, 2),
        'utf-8',
      );
    }
    i = j;
  }

  const final = renumber(out);
  await fs.writeFile(segPath, JSON.stringify(final, null, 2), 'utf-8');
  const sentCount = final.filter((s) => !isRawCue(s)).length;
  console.log(
    `sentence-builder: ${cueTotal} cues → ${sentCount} sentences for ${videoId}`,
  );
}

// ── OpenRouter 문장 복원기 ──────────────────────────────────────────

const DEFAULT_MODEL = 'google/gemini-3.5-flash';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60_000;

// 파편 큐를 원문 언어 그대로 완결 문장으로 병합하도록 지시하는 시스템 프롬프트.
const SYSTEM_PROMPT =
  '너는 자막 편집자다. 파편화된 자막 큐들을 원문 언어 그대로 자연스러운 완결 문장으로 병합하고 ' +
  '구두점을 복원한다. 각 완결 문장(。！？로 끝나는 단위)마다 별도 그룹으로 반환하고, 여러 문장을 한 그룹에 묶지 마라. ' +
  '큐 순서를 유지하고 내용을 요약·창작·번역하지 마라. ' +
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
