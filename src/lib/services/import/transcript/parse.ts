/**
 * 대본 HTML → Sentence[] 순수 변환.
 * 비발화 제거 · 화자 정규화 · 문장 분할 포함.
 */
import { parse } from 'node-html-parser';
import { Sentence } from '@/lib/types';

type Speaker = Sentence['speaker'];

// 광고·후원·각주·메타 역할(role) 클래스 문단은 발화가 아니므로 통째로 스킵.
const SKIP_ROLES = new Set([
  'ad',
  'ads',
  'sponsor',
  'sponsored',
  'footnote',
  'footnotes',
  'meta',
]);
// 인라인 비발화 큐: 대괄호 [LAUGHTER], 소괄호 (MUSIC) 등.
const CUE = /\[[^\]]*\]|\([^)]*\)/g;

// class 토큰(공백 분리)별로 역할 클래스 여부 판정.
// 정확 일치 또는 `role-`/`role_` 접두(예: ad-unit, sponsor-block)만 스킵.
// 'metadata'처럼 구분자 없는 일반 클래스는 보존한다.
function isNonSpeechClass(classAttr: string): boolean {
  return classAttr
    .split(/\s+/)
    .filter(Boolean)
    .some(
      (token) =>
        SKIP_ROLES.has(token) || SKIP_ROLES.has(token.split(/[-_]/)[0]),
    );
}

// 화자 라벨 → 정규화된 Speaker. 매핑 외(게스트 등)·라벨 없음은 NARRATOR.
function normalizeSpeaker(label: string): Speaker {
  const l = label.toLowerCase();
  const isDuckworth = l.includes('angela') || l.includes('duckworth');
  const isDubner =
    l.includes('stephen') || l.includes('steven') || l.includes('dubner');
  if (isDuckworth && isDubner) return 'BOTH';
  if (isDuckworth) return 'DUCKWORTH';
  if (isDubner) return 'DUBNER';
  return 'NARRATOR';
}

// 비발화 큐 제거 + 공백 정규화.
function cleanText(raw: string): string {
  return raw.replace(CUE, ' ').replace(/\s+/g, ' ').trim();
}

// 문장 경계(. ? !) + 공백 기준 분할.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseTranscriptHtml(html: string): Sentence[] {
  const root = parse(html);
  const sentences: Sentence[] = [];

  for (const p of root.querySelectorAll('p')) {
    if (isNonSpeechClass(p.getAttribute('class') ?? '')) continue;

    const labelEl = p.querySelector('strong') ?? p.querySelector('b');
    let speaker: Speaker = 'NARRATOR';
    let body = p.text;
    if (labelEl) {
      speaker = normalizeSpeaker(labelEl.text.replace(/:\s*$/, ''));
      body = p.text.replace(labelEl.text, '');
    }

    const cleaned = cleanText(body);
    if (!cleaned) continue;

    for (const text of splitSentences(cleaned)) {
      sentences.push({ speaker, text });
    }
  }

  return sentences;
}
