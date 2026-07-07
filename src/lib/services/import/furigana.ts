/**
 * 임포트 파이프라인의 furigana(후리가나) 단계 코어 (#128).
 * 자막 전용 ja 세그먼트에 LLM으로 루비(Segment.ruby)를 주입한다.
 * translation.ts와 동형 컨벤션(DI·배치·멱등·best-effort·증분 저장).
 */
import fs from 'fs/promises';
import path from 'path';
import { RubyToken, Segment } from '@/lib/types';
import { OpenRouterConfig } from './translation';

const EPISODES_DIR = path.join(process.cwd(), '.shadowing', 'episodes');

// 한 번의 LLM 호출로 묶는 세그먼트 수(translation과 동일).
const DEFAULT_BATCH_SIZE = 20;

/** 세그먼트 배치를 받아 동일 길이의 루비 시퀀스 배열을 반환하는 주석기 계약. */
export type FuriganaAnnotator = (batch: Segment[]) => Promise<RubyToken[][]>;

export interface AnnotateFuriganaDeps {
  annotator: FuriganaAnnotator;
  batchSize?: number; // 기본 20
}

// CJK 통합 한자(확장 A·호환 한자 포함) 범위.
const KANJI_RE = /[㐀-䶿一-鿿豈-﫿]/;

/** CJK 통합 한자 포함 여부(루비 필요 판정). */
export function hasKanji(text: string): boolean {
  return KANJI_RE.test(text);
}

// 루비 대상: ruby가 없고 한자를 포함한 세그먼트.
function needsRuby(seg: Segment): boolean {
  return seg.ruby == null && hasKanji(seg.text);
}

// 루비 시퀀스가 세그먼트 원문을 정확히 덮는지 검증.
function isValidRuby(tokens: RubyToken[], text: string): boolean {
  return (
    Array.isArray(tokens) &&
    tokens.length > 0 &&
    tokens.every((t) => typeof t.text === 'string') &&
    tokens.map((t) => t.text).join('') === text
  );
}

export async function annotateFurigana(
  videoId: string,
  deps: AnnotateFuriganaDeps,
): Promise<void> {
  const { annotator, batchSize = DEFAULT_BATCH_SIZE } = deps;
  const segPath = path.join(EPISODES_DIR, videoId, 'segments.json');

  const raw = await fs.readFile(segPath, 'utf-8');
  const segments = JSON.parse(raw) as Segment[];

  // 원본 인덱스를 보존한 채 루비 대상만 추린다(멱등·한자 없는 세그먼트 제외).
  const targets = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => needsRuby(segment));

  let annotatedCount = 0;
  const batchCount = Math.ceil(targets.length / batchSize);
  for (let i = 0; i < targets.length; i += batchSize) {
    const batchNo = Math.floor(i / batchSize) + 1;
    const batch = targets.slice(i, i + batchSize);
    try {
      const results = await annotator(batch.map((t) => t.segment));
      // 길이 불일치 응답은 비결정성 방어로 그 배치 전체 스킵.
      if (results.length !== batch.length) {
        console.warn(
          `furigana: batch ${batchNo}/${batchCount} length mismatch ` +
            `(${results.length} != ${batch.length}), skipped`,
        );
        continue;
      }
      batch.forEach((t, j) => {
        // 세그먼트별 join 검증 실패는 그 세그먼트만 폐기(원문 폴백).
        if (isValidRuby(results[j], t.segment.text)) {
          // 프롬프트 위반 방어: 비한자(가나·기호) 조각에 붙은 rt는 제거한다.
          segments[t.index].ruby = results[j].map((token) =>
            token.rt && !hasKanji(token.text) ? { text: token.text } : token,
          );
          annotatedCount += 1;
        } else {
          console.warn(
            `furigana: segment ${t.segment.id} ruby join mismatch, dropped`,
          );
        }
      });
      // 증분 저장: 배치 성공 즉시 누적 반영해 중간 중단에도 완료분을 보존한다.
      await fs.writeFile(segPath, JSON.stringify(segments, null, 2), 'utf-8');
    } catch (err) {
      // 배치 실패 격리: 이 배치만 건너뛰고 계속 진행(best-effort).
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `furigana: batch ${batchNo}/${batchCount} failed (${message}), skipped`,
      );
      continue;
    }
  }

  console.log(
    `furigana: ${annotatedCount}/${targets.length} segments annotated for ${videoId}`,
  );
}

// ── OpenRouter 후리가나 주석기 ──────────────────────────────────────

const DEFAULT_MODEL = 'google/gemini-3.5-flash';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT =
  '너는 일본어 후리가나 주석가다. 각 문장을 루비 토큰 시퀀스로 분해한다. ' +
  '한자 연속 구간 토큰에만 rt(히라가나 요미가나)를 달고, 가나·기호 구간 토큰에는 rt를 넣지 않는다. ' +
  '각 문장의 토큰 text를 이어붙이면 원문과 정확히 일치해야 한다(문자 추가·삭제 금지). ' +
  '입력과 같은 개수·같은 순서로, 설명·코드펜스 없이 ' +
  'JSON 배열의 배열 [[{"text":"...","rt":"..."}, ...], ...] 만 출력한다.';

function buildUserContent(batch: Segment[]): string {
  const lines = batch.map((s, i) => `${i + 1}. ${s.text}`);
  return `다음 ${batch.length}개 문장에 후리가나 루비 토큰을 달아라:\n${lines.join('\n')}`;
}

// 응답에서 코드펜스를 제거하고 RubyToken[][]을 파싱. 실패 시 null.
function parseRubyMatrix(content: string): RubyToken[][] | null {
  const stripped = content
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (row) =>
          Array.isArray(row) &&
          row.every(
            (t) =>
              t !== null &&
              typeof t === 'object' &&
              typeof (t as RubyToken).text === 'string' &&
              ((t as RubyToken).rt === undefined ||
                typeof (t as RubyToken).rt === 'string'),
          ),
      )
    ) {
      return parsed as RubyToken[][];
    }
  } catch {
    // 파싱 실패
  }
  return null;
}

/**
 * OpenRouter(chat completions)로 세그먼트 배치에 루비를 다는 FuriganaAnnotator 팩토리.
 * - 파싱 실패/길이 불일치 → 빈 배열 반환(호출측 annotateFurigana가 스킵).
 * - HTTP 오류/키 부재 → throw(호출측 배치 실패 격리에 흡수).
 */
export function createOpenRouterFuriganaAnnotator(
  config: OpenRouterConfig,
): FuriganaAnnotator {
  const {
    apiKey,
    model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    baseUrl = process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = config;

  return async (batch: Segment[]): Promise<RubyToken[][]> => {
    if (!apiKey) {
      throw new Error('furigana: OPENROUTER_API_KEY is not set');
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
        // 요미가나 주석엔 무거운 사고가 불필요 — translation과 동일하게 최저로 낮춘다.
        reasoning: { effort: 'low' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`furigana: OpenRouter HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = parseRubyMatrix(content);

    // 파싱 실패·길이 불일치는 빈 배열로 신호 → annotateFurigana가 해당 배치 스킵.
    if (!parsed || parsed.length !== batch.length) return [];
    return parsed;
  };
}
