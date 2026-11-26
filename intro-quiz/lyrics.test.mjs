import test from 'node:test';
import assert from 'node:assert/strict';
import {searchQueries, pickResult, parseLyricsfile, parseSynced, prepareLines, parseResult, lineIndexAt, wordProgress, fetchLyrics} from './lyrics.mjs';

test('search tries the main title, the bracketed name, and the artist without features', () => {
  const queries = searchQueries({title: '다라리 (DARARI)', artist: '이하이 feat. 원슈타인'});
  assert.deepEqual(queries[0], {track_name: '다라리', artist_name: '이하이'});
  assert.ok(queries.some(q => q.track_name === 'DARARI'));
  assert.ok(queries.some(q => q.q === '다라리'));
  assert.ok(searchQueries({title: 'Hey Mama', artist: 'ROSÉ & Bruno Mars'}).some(q => q.artist_name === 'ROSÉ'));
});

test('picks synced lyrics by the same artist and skips other artists', () => {
  const song = {title: 'Supernova', artist: 'aespa'};
  const results = [
    {artistName: 'Someone Else', syncedLyrics: '[00:01.00] x'},
    {artistName: 'aespa', plainLyrics: 'no sync'},
    {artistName: 'aespa', syncedLyrics: '[00:01.00] a'},
    {artistName: 'aespa', syncedLyrics: '[00:01.00] b', hasWordSync: true, lyricsfile: 'x'},
  ];
  assert.equal(pickResult(results, song), results[3]);
  assert.equal(pickResult([results[0]], song), null);
  assert.equal(pickResult([{artistName: 'AESPA', instrumental: true, syncedLyrics: '[00:01.00] a'}], song), null);
});

test('reads word timings from the lyricsfile', () => {
  const lines = parseLyricsfile(`version: '1.0'
metadata:
  title: Supernova
lines:
- text: I'm like some kind
  start_ms: 2820
  end_ms: 6253
  words:
  - text: 'I''m '
    start_ms: 2820
  - text: like
    start_ms: 3097
- text: "Watch out"
  start_ms: 6970
  end_ms: 7507
`);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].words, [{text: "I'm ", start: 2.82}, {text: 'like', start: 3.097}]);
  assert.equal(lines[1].text, 'Watch out');
  assert.equal(lines[1].end, 7.507);
});

test('line-synced lyrics get evenly spread word timings and skip empty lines', () => {
  const lines = prepareLines(parseSynced('[00:01.00] 안녕 하세요\n[00:03.00]\n[00:05.00][00:20.00] 후렴'));
  assert.deepEqual(lines.map(line => line.text), ['안녕 하세요', '후렴', '후렴']);
  assert.equal(lines[0].end, 3);
  assert.deepEqual(lines[0].words.map(word => word.start), [1, 1 + 2 * 2 / 5]);
  assert.equal(lines[1].end, 13);
});

test('finds the current line and how far each word is filled', () => {
  const lines = parseResult({syncedLyrics: '[00:02.00] a b\n[00:04.00] c'});
  assert.equal(lineIndexAt(lines, 1), -1);
  assert.equal(lineIndexAt(lines, 2.5), 0);
  assert.equal(lineIndexAt(lines, 9), 1);
  assert.deepEqual(wordProgress(lines[0], 2.5), [0.5, 0]);
  assert.deepEqual(wordProgress(lines[0], 4), [1, 1]);
});

test('fetch stops at the first query with usable lyrics', async () => {
  const calls = [];
  const fake = async url => {
    calls.push(url);
    const body = calls.length === 1 ? [] : [{artistName: 'IVE', syncedLyrics: '[00:01.00] I AM', duration: 183}];
    return {ok: true, json: async () => body};
  };
  const lyrics = await fetchLyrics({title: 'I AM', artist: 'IVE (아이브)'}, {fetch: fake});
  assert.equal(calls.length, 2);
  assert.equal(lyrics.lines[0].text, 'I AM');
  assert.equal(lyrics.duration, 183);
  assert.equal(await fetchLyrics({title: '없는 곡', artist: '누구'}, {fetch: async () => ({ok: true, json: async () => []})}), null);
});
