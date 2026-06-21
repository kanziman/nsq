import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getEpisodes,
  getEpisodeById,
  getEpisodeSegments,
  deleteEpisode,
} from '../lib/services/episodes';
import { EpisodeMeta, Segment, ImportState } from '../types';

const TEST_ID = 'test-video-123';
const BASE_DIR = path.join(process.cwd(), '.shadowing', 'episodes', TEST_ID);

async function runTest() {
  console.log('🚀 Starting Data Layer Verification Test...');

  // 1. Clean up potential leftover
  await deleteEpisode(TEST_ID);

  // 2. Mock meta.json
  const mockMeta: EpisodeMeta = {
    id: TEST_ID,
    title: 'Test Episode Title',
    duration: 332,
    youtubeUrl: 'https://youtube.com/watch?v=test-video-123',
    addedAt: new Date().toISOString(),
  };

  // Mock import-state.json
  const mockState: ImportState = {
    videoId: TEST_ID,
    status: 'completed',
    progress: 100,
    currentStep: 'Done',
    updatedAt: new Date().toISOString(),
  };

  // Mock segments.json
  const mockSegments: Segment[] = [
    {
      id: 'seg_1',
      start: 1.2,
      end: 4.5,
      speaker: 'DUCKWORTH',
      text: 'Hello test segment',
      translation: '안녕 테스트 세그먼트',
    },
  ];

  // Write mock files
  await fs.mkdir(BASE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(BASE_DIR, 'meta.json'),
    JSON.stringify(mockMeta),
  );
  await fs.writeFile(
    path.join(BASE_DIR, 'import-state.json'),
    JSON.stringify(mockState),
  );
  await fs.writeFile(
    path.join(BASE_DIR, 'segments.json'),
    JSON.stringify(mockSegments),
  );

  console.log('✅ Mock data written to .shadowing/episodes/test-video-123/');

  // 3. Test getEpisodes
  const episodes = await getEpisodes();
  const found = episodes.find((e) => e.id === TEST_ID);
  assert.ok(found, 'getEpisodes should return the mock episode');
  assert.strictEqual(found.title, 'Test Episode Title');
  assert.strictEqual(found.importState?.status, 'completed');
  console.log('✅ getEpisodes() verification passed.');

  // 4. Test getEpisodeById
  const episode = await getEpisodeById(TEST_ID);
  assert.ok(episode, 'getEpisodeById should return the mock episode');
  assert.strictEqual(episode.title, 'Test Episode Title');
  console.log('✅ getEpisodeById() verification passed.');

  // 5. Test getEpisodeSegments
  const segments = await getEpisodeSegments(TEST_ID);
  assert.strictEqual(segments.length, 1);
  assert.strictEqual(segments[0].text, 'Hello test segment');
  console.log('✅ getEpisodeSegments() verification passed.');

  // 6. Test deleteEpisode
  await deleteEpisode(TEST_ID);
  const deletedEpisode = await getEpisodeById(TEST_ID);
  assert.strictEqual(
    deletedEpisode,
    null,
    'deleteEpisode should remove the directory',
  );
  console.log('✅ deleteEpisode() verification passed.');

  console.log('🎉 All Data Layer Tests Passed Successfully!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
