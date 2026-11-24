import test from 'node:test';
import assert from 'node:assert/strict';
import {BANK} from './bank.mjs';
import {videoId,validateBank,mergeSavedSongs,pickSongs,publicState} from './core.mjs';

test('70 valid songs with ten per year',()=>{
  assert.equal(validateBank(BANK).length,70);
  for(const year of [2020,2021,2022,2023,2024,2025,2026])assert.equal(BANK.filter(s=>s.year===year).length,10);
});
test('accept supported YouTube URLs and reject impostors',()=>{
  for(const value of ['phuiiNCxRMg','https://youtu.be/phuiiNCxRMg?t=3','https://www.youtube.com/watch?v=phuiiNCxRMg','https://music.youtube.com/watch?v=phuiiNCxRMg','https://youtube.com/shorts/phuiiNCxRMg'])assert.equal(videoId(value),'phuiiNCxRMg');
  for(const value of ['https://youtube.com.evil.test/watch?v=phuiiNCxRMg','javascript:alert(1)','https://example.com/phuiiNCxRMg','https://youtube.com/playlist?list=anything'])assert.equal(videoId(value),null);
});
test('filter intersection, small pools, and no duplicates',()=>{
  const result=pickSongs(BANK,[2024,2026],'K-pop',15,()=>.4);
  assert.equal(result.length,15);assert.equal(new Set(result.map(s=>s.id)).size,15);
  assert.ok(result.every(s=>s.year!==2025));assert.equal(pickSongs(BANK,[2024],'K-pop',30).length,10);
  assert.equal(pickSongs(BANK,[],'',10).length,0);assert.equal(pickSongs(BANK,[2024],'발라드',10).length,0);
});
test('question state never includes answers or video identifiers',()=>{
  for(const phase of ['idle','loading','listening','question','done']){
    const s=publicState({phase,index:0,stage:1,duration:.5,total:10,song:BANK[0]});
    assert.equal(s.song,undefined);assert.ok(!JSON.stringify(s).includes(BANK[0].title));
  }
  const s=publicState({phase:'answer',index:0,stage:1,duration:.5,total:10,song:BANK[0]});
  assert.equal(s.song.title,BANK[0].title);assert.equal(s.song.introVideo,undefined);
});
test('invalid imports fail before persistence',()=>{
  for(const change of [{introStart:-1},{answerStart:Infinity},{year:2024.5},{answerVideo:'bad'},{title:''}])assert.throws(()=>validateBank([{...BANK[0],...change}]));
  assert.throws(()=>validateBank([BANK[0],BANK[0]]));assert.throws(()=>validateBank([]));
});

test('existing browser banks gain new default songs without losing teacher edits', () => {
  const original = BANK.filter(song => song.year >= 2024);
  const edited = {...original[0], introStart: 4.5, checked: true};
  const added = {...original[1], id: 'teacher-song', title: '추가곡'};
  const merged = mergeSavedSongs(BANK, [edited, ...original.slice(1), added]);
  assert.equal(merged.length, 71);
  assert.equal(merged.filter(song => song.year < 2024).length, 40);
  assert.deepEqual(merged.find(song => song.id === edited.id), edited);
  assert.deepEqual(merged.find(song => song.id === added.id), added);
});

test('excluded artists do not appear in the playlist', () => {
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const excluded = new Set(['IVE', 'aespa']);
  const pool = BANK.filter(song => !excluded.has(song.artist));
  const playlist = pickSongs(BANK, years, 'K-pop', 70, () => 0.5, excluded);
  assert.equal(playlist.length, pool.length);
  assert.ok(playlist.every(song => !excluded.has(song.artist)));
  assert.deepEqual(pickSongs(BANK, years, '', 10, Math.random, new Set(BANK.map(song => song.artist))), []);
});
