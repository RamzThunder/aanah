import test from 'node:test';
import assert from 'node:assert/strict';
import {BANK, RETIRED_SONG_IDS, updateLegacySong} from './bank.mjs';
import {questionYear, clipStart} from './shortform-bank.mjs';
import {videoId,validateBank,mergeSavedSongs,pickSongs,publicState,applyBankEdit,migrateSavedSong} from './core.mjs';
import {BANK_EDITS} from './bank-edits.mjs';

const releaseBank = BANK.filter(song => questionYear(song, 'release') !== undefined);

test('188 active default songs including film, animation, and requested songs', () => {
  validateBank(BANK);
  const songs = releaseBank;
  assert.equal(songs.length, 188);
  assert.equal(songs.filter(song => song.genre === 'K-pop').length, 139);
  assert.equal(songs.filter(song => song.genre === '힙합').length, 6);
  assert.equal(songs.find(song => song.title === 'HAPPY').id, 'song-6');
  assert.equal(songs.filter(song => song.genre === '어린이 애니 OST').length, 9);
  assert.ok(songs.every(song => !RETIRED_SONG_IDS.has(song.id)));
  assert.equal(BANK.find(song => song.title === 'Golden').genre, '영화 수록곡');
  // 밴드·인디 곡은 요청함 신청곡(202번 이후)으로만 들어온다.
  assert.deepEqual(songs.filter(song => song.genre === '밴드·인디').map(song => song.id), ['song-205', 'song-206', 'song-224', 'song-236', 'song-238']);
  assert.equal(new Set(songs.map(song => `${song.title}|${song.artist}`)).size, songs.length);
  const added = songs.filter(song => Number(song.id.slice(5)) >= 109 && Number(song.id.slice(5)) <= 178);
  for (let year = 2020; year <= 2026; year++) {
    assert.equal(added.filter(song => song.year === year).length, 10);
  }
});
test('accept supported YouTube URLs and reject impostors',()=>{
  for(const value of ['phuiiNCxRMg','https://youtu.be/phuiiNCxRMg?t=3','https://www.youtube.com/watch?v=phuiiNCxRMg','https://music.youtube.com/watch?v=phuiiNCxRMg','https://youtube.com/shorts/phuiiNCxRMg'])assert.equal(videoId(value),'phuiiNCxRMg');
  for(const value of ['https://youtube.com.evil.test/watch?v=phuiiNCxRMg','javascript:alert(1)','https://example.com/phuiiNCxRMg','https://youtube.com/playlist?list=anything'])assert.equal(videoId(value),null);
});
test('filter intersection, small pools, and no duplicates',()=>{
  const result=pickSongs(BANK,[2024,2026],['K-pop'],15,()=>.4);
  assert.equal(result.length,15);assert.equal(new Set(result.map(s=>s.id)).size,15);
  assert.ok(result.every(s=>s.year!==2025));assert.equal(pickSongs(releaseBank,[2024],['K-pop'],30).length,19);
  assert.equal(pickSongs(BANK,[],null,10).length,0);assert.equal(pickSongs(releaseBank,[2024],['발라드'],10).length,0);
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
  const original = BANK.filter(song => Number(song.id.slice(5)) < 109);
  const edited = {...original[0], introStart: 4.5, checked: true};
  const added = {...original[1], id: 'teacher-song', title: '추가곡'};
  const merged = mergeSavedSongs(BANK, [edited, ...original.slice(1), added]);
  assert.equal(merged.length, 212);
  assert.equal(merged.filter(song => questionYear(song, 'release') < 2024).length, 115);
  assert.deepEqual(merged.find(song => song.id === edited.id), edited);
  assert.deepEqual(merged.find(song => song.id === added.id), added);
});

test('excluded artists do not appear in the playlist', () => {
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const excluded = new Set(['IVE', 'aespa']);
  const pool = releaseBank.filter(song => song.genre === 'K-pop' && years.includes(song.year) && !excluded.has(song.artist));
  const playlist = pickSongs(releaseBank, years, ['K-pop'], BANK.length, () => 0.5, excluded);
  assert.equal(playlist.length, pool.length);
  assert.ok(playlist.every(song => !excluded.has(song.artist)));
  assert.deepEqual(pickSongs(BANK, years, null, 10, Math.random, new Set(BANK.map(song => song.artist))), []);
});

test('Work titles appear only at reveal and are restored for older saved songs', () => {
  const song = BANK.find(song => song.title === 'Golden');
  const {work, ...legacySong} = song;
  assert.equal(work, '케이팝 데몬 헌터스');
  const saved = validateBank([{...legacySong, introStart: 3}]);
  const [merged] = mergeSavedSongs([song], saved);
  assert.equal(merged.introStart, 3);
  assert.equal(merged.work, work);
  assert.equal(publicState({phase: 'question', song: merged}).song, undefined);
  assert.equal(publicState({phase: 'answer', song: merged}).song.work, work);
  assert.equal(validateBank([{...song, work: ' 내 작품명 '}])[0].work, '내 작품명');
});

test('old backups cannot restore retired defaults but keep teacher additions', () => {
  const retired = {...BANK[0], id: 'song-20', title: 'Golden'};
  const custom = {...BANK[0], id: 'teacher-ost', genre: 'OST', work: '수업용 작품'};
  const merged = mergeSavedSongs(BANK, [retired, custom], RETIRED_SONG_IDS);
  assert.equal(merged.length, 212);
  assert.equal(merged.find(song => song.id === retired.id), undefined);
  assert.deepEqual(merged.find(song => song.id === custom.id), custom);
});

test('combined genre selection includes only checked genres', () => {
  const songs = pickSongs(releaseBank, [2020, 2021, 2022], ['힙합', '어린이 애니 OST'], 30);
  assert.equal(songs.length, 6);
  assert.equal(songs.filter(song => song.genre === '힙합').length, 3);
  assert.deepEqual(pickSongs(BANK, [2020], [], 10), []);
  const anySong = BANK.find(song => song.title === '아무노래');
  const saved = {...anySong, genre: 'K-pop', introStart: 5};
  assert.deepEqual(updateLegacySong(saved), {...anySong, introStart: 5});
});

test('RUDE uses the official audio and preserves customized intro settings', () => {
  const rude = BANK.find(song => song.id === 'song-25');
  assert.equal(rude.introVideo, 'Q4AE3ub4nBM');
  assert.equal(rude.answerVideo, 'F7sGJVUrkjQ');
  const oldDefault = {...rude, introVideo: rude.answerVideo, introStart: 0};
  assert.deepEqual(updateLegacySong(oldDefault), rude);
  for (const edited of [{introStart: 2}, {introVideo: 'HttxcynVU48'}, {checked: true}]) {
    const saved = {...oldDefault, ...edited};
    assert.deepEqual(updateLegacySong(saved), saved);
  }
});

test('reviewed audio replaces only unchanged intro settings in older banks', () => {
  const song = BANK.find(song => song.id === 'song-36');
  const previous = {...song, genre: 'K-pop', introVideo: song.answerVideo, introStart: 0};
  assert.deepEqual(updateLegacySong(previous), song);
  assert.deepEqual(updateLegacySong({...previous, introStart: 5}), {
    ...song, introVideo: previous.introVideo, introStart: 5
  });

  const whiplash = BANK.find(song => song.id === 'song-7');
  const saved = {...whiplash, introVideo: whiplash.answerVideo, introStart: 0, answerStart: 12};
  assert.deepEqual(updateLegacySong(saved), {...whiplash, answerStart: 12});
  assert.deepEqual(updateLegacySong({...saved, checked: true}), {...saved, checked: true});
});

test('shortform rounds contain five unique tracks per trend year without altering release rounds', () => {
  const yearOf = song => questionYear(song, 'shortform');
  const acrossYears = [];
  for (let year = 2020; year <= 2026; year++) {
    const songs = pickSongs(BANK, [year], null, BANK.length, () => 0.5, undefined, yearOf);
    assert.equal(songs.length, 5);
    acrossYears.push(...songs);
  }
  assert.equal(new Set(acrossYears.map(song => song.id)).size, 35);
  const cake = acrossYears.find(song => song.title === '티라미수 케익');
  assert.equal(cake.year, 2015);
  assert.equal(yearOf(cake), 2024);
  assert.equal(questionYear(cake, 'release'), undefined);
  const ids = new Set(acrossYears.map(song => song.id));
  assert.equal(releaseBank.filter(song => ids.has(song.id)).length, 12);
  const [saved] = validateBank([{...cake, introStart: 2, shortformStart: 15.5}]);
  assert.equal(clipStart(saved, 'release'), 2);
  assert.equal(clipStart(saved, 'shortform'), 15.5);
  assert.equal(clipStart(cake, 'shortform'), 46.4);
  assert.equal(clipStart({...cake, introVideo: 'aaaaaaaaaaa'}, 'shortform'), cake.introStart);
  assert.equal(clipStart(cake, 'release'), cake.introStart);
});

test('admin bank edits update defaults and untouched saved copies only', () => {
  const song = {...BANK.find(s => s.id === 'song-225')};
  const edit = {genre: {to: '야구', from: ['응원가']}, introStart: {to: 3.5, from: [0]}, work: {to: null, from: ['옛 작품']}};
  const updated = applyBankEdit({...song, work: '옛 작품'}, edit);
  assert.equal(updated.genre, '야구');
  assert.equal(updated.introStart, 3.5);
  assert.equal('work' in updated, false);
  validateBank([updated]);
  // 선생님이 직접 바꾼 시작 시간은 지키고, 손대지 않은 장르만 바꾼다.
  const saved = {...song, introStart: 7};
  const migrated = migrateSavedSong(saved, edit);
  assert.equal(migrated.genre, '야구');
  assert.equal(migrated.introStart, 7);
  assert.equal(migrateSavedSong({...song, genre: '내 장르'}, edit).genre, '내 장르');
  // 반영된 수정 내역은 모두 기본 문제은행에 적용되어 있어야 한다.
  for (const [id, fields] of Object.entries(BANK_EDITS)) {
    const current = BANK.find(s => s.id === id);
    assert.ok(current, id);
    for (const [field, {to}] of Object.entries(fields)) assert.equal(current[field] ?? null, to, `${id}.${field}`);
  }
});

test('random playlists spread artists and genres instead of following the bank skew', () => {
  const years = [...new Set(releaseBank.map(song => song.year))];
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let kpop = 0;
  for (let run = 0; run < 200; run++) {
    const songs = pickSongs(releaseBank, years, null, 30, random);
    assert.equal(songs.length, 30);
    assert.equal(new Set(songs.map(song => song.artist.toLowerCase())).size, 30);
    kpop += songs.filter(song => song.genre === 'K-pop').length;
  }
  const average = kpop / 200;
  assert.ok(average > 10 && average < 20, `K-pop 평균 ${average}곡`);
});

test('artists repeat only after every other artist in the pool has appeared', () => {
  const bank = [
    ...Array.from({length: 5}, (_, i) => ({id: `a${i}`, title: `A${i}`, artist: 'IVE', genre: 'K-pop', year: 2024})),
    {id: 'b', title: 'B', artist: 'aespa', genre: 'K-pop', year: 2024},
    {id: 'c', title: 'C', artist: '체리필터', genre: '밴드·인디', year: 2024},
  ];
  for (let run = 0; run < 50; run++) {
    const songs = pickSongs(bank, [2024], null, 4);
    assert.deepEqual(new Set(songs.slice(0, 3).map(song => song.artist)), new Set(['IVE', 'aespa', '체리필터']));
    assert.equal(songs[3].artist, 'IVE');
  }
  assert.equal(pickSongs(bank, [2024], null, 99).length, bank.length);
});
