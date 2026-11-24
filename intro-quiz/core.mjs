export function videoId(value) {
  const s=String(value||'').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u=new URL(s);
    if(!['http:','https:'].includes(u.protocol)) return null;
    const host=u.hostname.replace(/^www\./,'');
    let id;
    if(host==='youtu.be') id=u.pathname.slice(1);
    else if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host))
      id=u.searchParams.get('v') || (/^\/(embed|shorts|live)\//.test(u.pathname)?u.pathname.split('/')[2]:null);
    return /^[\w-]{11}$/.test(id||'')?id:null;
  } catch { return null; }
}
export function validateBank(input) {
  if(!Array.isArray(input)||!input.length) throw Error('한 곡 이상 담긴 목록이 필요합니다.');
  const ids=new Set();
  return input.map(s=>{
    if(!s||typeof s!=='object') throw Error('곡 형식이 올바르지 않습니다.');
    const r={};
    for(const k of ['id','title','artist','genre']) {
      if(typeof s[k]!=='string'||!s[k].trim()||s[k].length>150) throw Error('곡 ID·제목·가수·장르를 확인해 주세요.');
      r[k]=s[k].trim();
    }
    if(ids.has(r.id)) throw Error('중복된 곡 ID가 있습니다.');
    ids.add(r.id);
    if(!Number.isInteger(s.year)||s.year<1900||s.year>2100) throw Error('연도를 확인해 주세요.');
    r.year=s.year;
    for(const k of ['introVideo','answerVideo']) {
      r[k]=videoId(s[k]); if(!r[k]) throw Error('올바른 유튜브 영상 주소가 필요합니다.');
    }
    for(const k of ['introStart','answerStart']) {
      if(typeof s[k]!=='number'||!Number.isFinite(s[k])||s[k]<0||s[k]>86400) throw Error('시작 시간은 0~86400초 사이여야 합니다.');
      r[k]=s[k];
    }
    if (s.shortformStart !== undefined) {
      if (!Number.isFinite(s.shortformStart) || s.shortformStart < 0 || s.shortformStart > 86400) {
        throw Error('숏폼 시작 시간은 0~86400초 사이여야 합니다.');
      }
      r.shortformStart = s.shortformStart;
    }
    if (s.work !== undefined) {
      if (typeof s.work !== 'string' || s.work.length > 150) throw Error('작품명은 150자 이내로 입력해 주세요.');
      r.work = s.work.trim();
    }
    r.checked=s.checked===true;
    return r;
  });
}
// 관리 페이지에서 고친 기본값(bank-edits.mjs)을 적용한다.
const same = (a, b) => (a ?? null) === (b ?? null);
function setField(song, field, value) {
  const next = {...song};
  if (value === null) delete next[field]; else next[field] = value;
  return next;
}
export function applyBankEdit(song, edit) {
  if (!edit) return song;
  for (const [field, {to}] of Object.entries(edit)) song = setField(song, field, to);
  return song;
}
// 저장된 곡은 선생님이 직접 바꾸지 않은 필드(예전 기본값 그대로인 필드)만 새 기본값으로 바꾼다.
export function migrateSavedSong(song, edit) {
  if (!edit) return song;
  for (const [field, {to, from}] of Object.entries(edit)) {
    if (!same(song[field], to) && from.some(value => same(song[field], value))) song = setField(song, field, to);
  }
  return song;
}
export function mergeSavedSongs(defaults, savedSongs, retiredIds = new Set()) {
  const songs = new Map(defaults.map(song => [song.id, song]));
  for (const song of savedSongs) {
    if (retiredIds.has(song.id)) continue;
    const original = songs.get(song.id);
    const sameTrack = original?.title === song.title && original.artist === song.artist && original.genre === song.genre;
    const work = song.work ?? (sameTrack ? original.work : undefined);
    songs.set(song.id, work === undefined ? song : {...song, work});
  }
  return [...songs.values()];
}

export function filterSongs(bank, years, genres, excludedArtists = new Set(), yearOf = song => song.year) {
  return bank.filter(song =>
    years.includes(yearOf(song)) &&
    (!genres || genres.includes(song.genre)) &&
    !excludedArtists.has(song.artist)
  );
}

export function pickSongs(bank,years,genres,count,random=Math.random,excludedArtists,yearOf) {
  const pool=filterSongs(bank, years, genres, excludedArtists, yearOf);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,Math.max(0,Math.floor(count)));
}
// Send no answer data to the presentation window before reveal.
export function publicState(state) {
  const {phase,index,stage,duration,total}=state;
  const result={phase,index,stage,duration,total};
  if(phase==='answer'&&state.song) {
    const {title,artist,year,answerVideo,answerStart,work}=state.song;
    result.song={title,artist,year,answerVideo,answerStart};
    if (work) result.song.work = work;
  }
  return result;
}
