import { describe, it, expect } from 'vitest';
import { parseTranscriptHtml } from './parse';

describe('parseTranscriptHtml', () => {
  // [정상]
  it('should normalize Angela/Stephen labels to DUCKWORTH/DUBNER', () => {
    const html = `
      <p><strong>Angela DUCKWORTH:</strong> I think so.</p>
      <p><strong>Stephen DUBNER:</strong> Agreed.</p>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'I think so.' },
      { speaker: 'DUBNER', text: 'Agreed.' },
    ]);
  });

  // [경계]
  it('should map unmapped (guest) speaker label to NARRATOR', () => {
    const html = `<p><strong>Mike Maughan:</strong> Hello there.</p>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'NARRATOR', text: 'Hello there.' },
    ]);
  });

  it('should map joint Angela+Stephen label to BOTH', () => {
    const html = `<p><strong>Angela and Stephen:</strong> Yes!</p>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'BOTH', text: 'Yes!' },
    ]);
  });

  it('should strip [LAUGHTER]/(MUSIC) cues and drop cue-only paragraphs', () => {
    const html = `
      <p><strong>Angela DUCKWORTH:</strong> That is funny [LAUGHTER] really.</p>
      <p>[LAUGHTER]</p>
      <p><strong>Stephen DUBNER:</strong> (MUSIC) Let's begin.</p>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'That is funny really.' },
      { speaker: 'DUBNER', text: "Let's begin." },
    ]);
  });

  it('should skip ad/sponsor/footnote paragraphs', () => {
    const html = `
      <p class="ad">Support for Freakonomics comes from a sponsor.</p>
      <p><strong>Angela DUCKWORTH:</strong> Real content here.</p>
      <p class="footnote">1. Some citation.</p>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'Real content here.' },
    ]);
  });

  it('should skip role classes (ad-unit/sponsor-block) but keep non-role classes (metadata)', () => {
    const html = `
      <p class="ad-unit">Buy now.</p>
      <p class="sponsor-block">Sponsored message.</p>
      <p class="metadata"><strong>Angela DUCKWORTH:</strong> Kept content.</p>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'Kept content.' },
    ]);
  });

  it('should split a multi-sentence paragraph and propagate the same speaker', () => {
    const html = `<p><strong>Angela DUCKWORTH:</strong> First sentence. Second one? Third!</p>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'First sentence.' },
      { speaker: 'DUCKWORTH', text: 'Second one?' },
      { speaker: 'DUCKWORTH', text: 'Third!' },
    ]);
  });
});
