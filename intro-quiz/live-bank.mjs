import {applyBankEdit, migrateSavedSong} from './core.mjs';

// 영상이 바뀌면 이전 영상에서 확인한 시작 시간은 적용하지 않는다.
export function audioEdits(songs, starts) {
  const edits = new Map();
  for (const row of starts) {
    const song = songs.find(song => song.id === row.song_id);
    if (!song || song.introVideo !== row.intro_video || !Number.isFinite(row.intro_start) || row.intro_start < 0 || row.intro_start > 86400) continue;
    const from = [...new Set([song.introStart, ...(Array.isArray(row.previous_starts) ? row.previous_starts : [])])];
    edits.set(song.id, {introStart: {to: row.intro_start, from}});
  }
  return edits;
}
export async function fetchAudioStarts() {
  const response = await fetch('/api/bank-audio', {cache: 'no-store', signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('반영한 시작 시간을 불러오지 못했어요.');
  const data = await response.json();
  if (!Array.isArray(data.starts)) throw new Error('시작 시간 목록이 올바르지 않아요.');
  return data.starts;
}
export const publishedBank = (songs, edits) => songs.map(song => applyBankEdit(song, edits.get(song.id)));
export function migrateAudioStart(song, edits, originals) {
  const original = originals.find(original => original.id === song.id);
  return original?.introVideo === song.introVideo ? migrateSavedSong(song, edits.get(song.id)) : song;
}
