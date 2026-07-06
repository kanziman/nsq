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

// ── OpenRouter 배치 번역기 (이슈 #104) ──────────────────────────────

const DEFAULT_MODEL = 'google/gemini-2.5-pro';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60_000;

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch; // 테스트 주입
  timeoutMs?: number;
}

// 배치를 한국어 JSON 배열로만 번역하도록 지시하는 시스템 프롬프트.
const SYSTEM_PROMPT =
  '너는 팟캐스트 대본 번역가다. 각 줄의 영어 대사를 자연스러운 한국어 구어체로 번역한다. ' +
  '화자와 인접 문맥을 참고하되, 입력과 같은 개수·같은 순서의 한국어 문자열 JSON 배열로만 응답한다. ' +
  '설명·코드펜스 없이 순수 JSON 배열만 출력한다. (Respond ONLY with a JSON array of Korean strings.)';

// 배치 세그먼트를 화자·원문이 순서대로 담긴 사용자 메시지로 직렬화.
function buildUserContent(batch: Segment[]): string {
  const lines = batch.map((s, i) => `${i + 1}. [${s.speaker}] ${s.text}`);
  return `다음 ${batch.length}개 대사를 한국어 JSON 배열로 번역하라:\n${lines.join('\n')}`;
}

// 모델 응답에서 코드펜스·잡음을 제거하고 JSON 배열을 파싱. 실패 시 null.
function parseKoreanArray(content: string): string[] | null {
  const stripped = content
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[];
    }
  } catch {
    // 파싱 실패
  }
  return null;
}

/**
 * OpenRouter(OpenAI 호환 chat completions)로 배치를 번역하는 SegmentTranslator를 만든다.
 * - 길이 불일치/파싱 실패 → 빈 배열 반환(호출측 translate가 스킵).
 * - HTTP 오류/키 부재 → throw(호출측 배치 실패 격리에 흡수).
 */
export function createOpenRouterTranslator(
  config: OpenRouterConfig,
): SegmentTranslator {
  const {
    apiKey,
    model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    baseUrl = process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = config;

  return async (batch: Segment[]): Promise<string[]> => {
    if (!apiKey) {
      throw new Error('translation: OPENROUTER_API_KEY is not set');
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
          { role: 'user', content: buildUserContent(batch) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`translation: OpenRouter HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = parseKoreanArray(content);

    // 길이 불일치·파싱 실패는 빈 배열로 신호 → translate가 해당 배치 스킵.
    if (!parsed || parsed.length !== batch.length) return [];
    return parsed;
  };
}
