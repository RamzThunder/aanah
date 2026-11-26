import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewStatus} from './audio-review.mjs';
import {audioEdits, publishedBank, migrateAudioStart} from './live-bank.mjs';
import {BANK} from './bank.mjs';
import {AUDIO_REVIEW} from './audio-review-data.mjs';
const song = {id: 'song-1', introVideo: 'phuiiNCxRMg', introStart: 0};
const result = {introVideo: song.introVideo, introStart: 0, suggested_start: 0.52};
const published = {song_id: song.id, intro_video: song.introVideo, intro_start: 0.52, previous_starts: [0, 0.6]};

test('review rejects stale videos, starts and pending audio changes', () => {
  assert.equal(reviewStatus(song, result), 'available');
  assert.equal(reviewStatus({...song, introStart: 1}, result), 'stale');
  assert.equal(reviewStatus({...song, introVideo: 'other'}, result), 'stale');
  assert.equal(reviewStatus(song, result, {changes: {introStart: 0}}), 'stale');
  assert.equal(reviewStatus(song, result, {changes: {genre: '힙합'}}), 'available');
  assert.equal(reviewStatus(song, {...result, suggested_start: undefined}), 'unavailable');
  assert.equal(reviewStatus({...song, introStart: .52}, result, null, published), 'applied');
});
test('published starts update untouched saved defaults and earlier published starts only', () => {
  const edits = audioEdits([song], [published]);
  assert.equal(publishedBank([song], edits)[0].introStart, .52);
  assert.equal(migrateAudioStart(song, edits, [song]).introStart, .52);
  assert.equal(migrateAudioStart({...song, introStart: .6}, edits, [song]).introStart, .52);
  assert.equal(migrateAudioStart({...song, introStart: 2.3}, edits, [song]).introStart, 2.3);
  assert.equal(migrateAudioStart({...song, introVideo: 'custom'}, edits, [song]).introStart, 0);
});
test('published starts cannot carry over to replaced recordings or invalid times', () => {
  assert.equal(audioEdits([{...song, introVideo: 'new'}], [published]).size, 0);
  assert.equal(audioEdits([song], [{...published, intro_start: -1}]).size, 0);
  assert.equal(audioEdits([song], [{...published, intro_start: Infinity}]).size, 0);
});
test('all shipped suggestions have valid song fingerprints and usable starts', () => {
  const ids = new Set();
  for (const row of AUDIO_REVIEW.results) {
    assert.ok(!ids.has(row.id)); ids.add(row.id);
    assert.ok(BANK.some(song => song.id === row.id));
    assert.match(row.introVideo, /^[\w-]{11}$/);
    if (row.status !== 'error') assert.ok(Number.isFinite(row.suggested_start) && row.suggested_start >= 0 && row.suggested_start <= 86400);
  }
  assert.equal(AUDIO_REVIEW.results.length, 80);
});

test('review marks approved repository times and replaced recordings as reflected', () => {
  assert.equal(reviewStatus({...song, introStart: 1.2}, result, null, null, {introStart: {to: 1.2}}), 'applied');
  assert.equal(reviewStatus({...song, introVideo: 'new'}, result, null, null, {introVideo: {to: 'new'}}), 'applied');
  assert.equal(reviewStatus({...song, introStart: 1.2}, result, {changes: {introStart: 2}}, null, {introStart: {to: 1.2}}), 'stale');
});
