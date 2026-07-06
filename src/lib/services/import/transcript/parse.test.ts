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

  it('should scope to #transcript_inner and parse inline "NAME:" speaker labels', () => {
    const html = `
      <p><a class="comments_link">Comments</a></p>
      <nav><p>Share this episode</p></nav>
      <section id="transcript"><div id="transcript_inner">
        <blockquote><p><i><span style="font-weight:400;">DUBNER: Do I seem like an anti-mindfulness person?</span></i></p></blockquote>
        <p><span>DUCKWORTH: Too crotchety to be mindful.</span></p>
      </div></section>`;
    expect(parseTranscriptHtml(html)).toEqual([
      {
        speaker: 'DUBNER',
        text: 'Do I seem like an anti-mindfulness person?',
      },
      { speaker: 'DUCKWORTH', text: 'Too crotchety to be mindful.' },
    ]);
  });

  it('should strip a compound inline "NAME + NAME:" label and map it to BOTH', () => {
    const html = `<div id="transcript_inner">
      <p><span>DUCKWORTH + DUBNER: “there are no stupid questions.”</span></p>
    </div>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'BOTH', text: '“there are no stupid questions.”' },
    ]);
  });

  it('should strip a mixed-case inline label with a middle initial (Stephen J. DUBNER:)', () => {
    const html = `<div id="transcript_inner">
      <p><i><span style="font-weight: 400;">Stephen J. DUBNER: Angela Duckworth, I have a question to ask you. May I?</span></i></p>
    </div>`;
    expect(parseTranscriptHtml(html)).toEqual([
      {
        speaker: 'DUBNER',
        text: 'Angela Duckworth, I have a question to ask you.',
      },
      { speaker: 'DUBNER', text: 'May I?' },
    ]);
  });

  it('should strip a "First LASTNAME:" inline label (Angela DUCKWORTH:)', () => {
    const html = `<div id="transcript_inner">
      <p><i><span style="font-weight: 400;">Angela DUCKWORTH: Mmhmm.</span></i></p>
    </div>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'Mmhmm.' },
    ]);
  });

  it('should ignore a mid-paragraph <b> emphasis and still strip the leading inline label', () => {
    // 본문 중간의 인명 강조 <b>James Gross</b>를 화자 라벨로 오인하면 안 된다.
    const html = `<div id="transcript_inner">
      <p><i><span style="font-weight:400;">DUCKWORTH: Yeah. I talked to <b>James Gross</b> about it.</span></i></p>
    </div>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'Yeah.' },
      { speaker: 'DUCKWORTH', text: 'I talked to James Gross about it.' },
    ]);
  });

  it('should NOT treat a non-speaker "Word:" prefix as a speaker label', () => {
    const html = `<div id="transcript_inner">
      <p><span>New York: a great city.</span></p>
    </div>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'NARRATOR', text: 'New York: a great city.' },
    ]);
  });

  it('should drop the fact-check/credits outro from the Radio Network marker onward', () => {
    const html = `<div id="transcript_inner">
      <p><span>DUCKWORTH: Real dialogue.</span></p>
      <p style="text-align:center">*      *      *</p>
      <p>No Stupid Questions is part of the Freakonomics Radio Network. This episode was produced by Rebecca Lee Douglas.</p>
      <p>Our staff includes Alison Craiglow.</p>
      <p><span>DUBNER: Outro joke after credits.</span></p>
    </div>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'Real dialogue.' },
    ]);
  });

  it('should drop asterisk divider paragraphs', () => {
    const html = `<div id="transcript_inner">
      <p><span>DUCKWORTH: Before.</span></p>
      <p style="text-align:center">*      *      *</p>
      <p><span>DUBNER: After.</span></p>
    </div>`;
    expect(parseTranscriptHtml(html)).toEqual([
      { speaker: 'DUCKWORTH', text: 'Before.' },
      { speaker: 'DUBNER', text: 'After.' },
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
