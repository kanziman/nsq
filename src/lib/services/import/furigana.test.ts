import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type { RubyToken, Segment } from '@/lib/types';
import { annotateFurigana, hasKanji, type FuriganaAnnotator } from './furigana';

const BASE = path.join(process.cwd(), '.shadowing', 'episodes');
const VID = 'test-furigana-vid';

function seg(id: string, text: string, ruby?: RubyToken[]): Segment {
  return { id, start: 0, end: 2, speaker: 'SPEAKER', text, ruby };
}

async function writeSegments(segments: Segment[]): Promise<void> {
  await fs.mkdir(path.join(BASE, VID), { recursive: true });
  await fs.writeFile(
    path.join(BASE, VID, 'segments.json'),
    JSON.stringify(segments, null, 2),
    'utf-8',
  );
}

async function readSegments(): Promise<Segment[]> {
  const raw = await fs.readFile(path.join(BASE, VID, 'segments.json'), 'utf-8');
  return JSON.parse(raw) as Segment[];
}

afterEach(async () => {
  await fs.rm(path.join(BASE, VID), { recursive: true, force: true });
  vi.restoreAllMocks();
});

const RUBY_TENKI: RubyToken[] = [
  { text: '天気', rt: 'てんき' },
  { text: 'です' },
];

describe('hasKanji', () => {
  it('should detect kanji and reject kana-only text', () => {
    expect(hasKanji('天気です')).toBe(true);
    expect(hasKanji('こんにちは')).toBe(false);
  });
});

describe('annotateFurigana', () => {
  // [정상] 한자 세그먼트에 검증된 루비 주입
  it('should inject validated ruby sequences for kanji segments', async () => {
    await writeSegments([seg('s1', '天気です')]);
    const annotator: FuriganaAnnotator = vi.fn(async () => [RUBY_TENKI]);

    await annotateFurigana(VID, { annotator });

    const segments = await readSegments();
    expect(segments[0].ruby).toEqual(RUBY_TENKI);
  });

  // [정상] 멱등(기존 ruby 스킵) + 한자 없는 세그먼트 스킵
  it('should skip segments that already have ruby or contain no kanji', async () => {
    const existing: RubyToken[] = [
      { text: '天気', rt: 'てんき' },
      { text: 'だ' },
    ];
    await writeSegments([
      seg('s1', '天気だ', existing),
      seg('s2', 'こんにちは'),
      seg('s3', '天気です'),
    ]);
    const annotator: FuriganaAnnotator = vi.fn(async (batch) => {
      // 한자 있고 ruby 없는 s3만 배치에 온다
      expect(batch.map((b: Segment) => b.id)).toEqual(['s3']);
      return [RUBY_TENKI];
    });

    await annotateFurigana(VID, { annotator });

    const segments = await readSegments();
    expect(segments[0].ruby).toEqual(existing);
    expect(segments[1].ruby).toBeUndefined();
    expect(segments[2].ruby).toEqual(RUBY_TENKI);
    expect(annotator).toHaveBeenCalledTimes(1);
  });

  // [경계] LLM이 비한자(가나) 조각에 rt를 붙여도 저장 시 제거된다(프롬프트 위반 방어)
  it('should strip rt from non-kanji pieces before saving', async () => {
    await writeSegments([seg('s1', '天気です')]);
    const annotator: FuriganaAnnotator = vi.fn(async () => [
      [
        { text: '天気', rt: 'てんき' },
        { text: 'です', rt: 'です' }, // 가나 조각에 rt — 위반
      ],
    ]);

    await annotateFurigana(VID, { annotator });

    const segments = await readSegments();
    expect(segments[0].ruby).toEqual([
      { text: '天気', rt: 'てんき' },
      { text: 'です' },
    ]);
  });

  // [경계] join 불일치 → 그 세그먼트 루비 폐기
  it('should drop ruby for a segment when token join mismatches text', async () => {
    await writeSegments([seg('s1', '天気です')]);
    const annotator: FuriganaAnnotator = vi.fn(async () => [
      [{ text: '天気', rt: 'てんき' }], // join '天気' ≠ '天気です'
    ]);

    await annotateFurigana(VID, { annotator });

    const segments = await readSegments();
    expect(segments[0].ruby).toBeUndefined();
  });

  // [경계] 앞 배치 실패 격리, 뒤 배치 계속
  it('should isolate a failing batch and continue with later batches', async () => {
    await writeSegments([seg('s1', '天気です'), seg('s2', '学校へ')]);
    let call = 0;
    const annotator: FuriganaAnnotator = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new Error('llm boom');
      return [[{ text: '学校', rt: 'がっこう' }, { text: 'へ' }]];
    });

    await annotateFurigana(VID, { annotator, batchSize: 1 });

    const segments = await readSegments();
    expect(segments[0].ruby).toBeUndefined();
    expect(segments[1].ruby).toEqual([
      { text: '学校', rt: 'がっこう' },
      { text: 'へ' },
    ]);
  });

  // [예외] segments.json 부재 → throw
  it('should throw when segments.json is missing', async () => {
    const annotator: FuriganaAnnotator = vi.fn(async () => []);
    await expect(annotateFurigana(VID, { annotator })).rejects.toThrow();
  });
});
