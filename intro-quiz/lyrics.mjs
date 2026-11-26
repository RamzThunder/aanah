// 노래방식 가사: LRCLIB(https://lrclib.net)에서 정답을 공개할 때 그때그때 받아 와 화면에만 띄운다.
// 가사는 사이트나 DB에 저장하지 않는다.
const API = 'https://lrclib.net/api/search';
const MAX_LINE_SECONDS = 8;

const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[\s'’"`.,!?~～·\-_()（）[\]]/g, '');
const unique = list => [...new Set(list.map(item => item.trim()).filter(Boolean))];

// "다라리 (DARARI)" → ["다라리 (DARARI)", "다라리", "DARARI"]
function nameVariants(name) {
  const base = name.replace(/\s+feat\..*$/i, '');
  const inner = [...base.matchAll(/\(([^)]*)\)/g)].map(match => match[1].replace(/^CV:.*$/i, ''));
  const outer = base.replace(/\s*\([^)]*\)\s*/g, ' ');
  return unique([outer, ...inner, base]);
}
function artistVariants(artist) {
  const names = nameVariants(artist);
  return unique([...names, ...names.map(name => name.split(/\s*(?:,|&|×| x )\s*/i)[0])]);
}

export function searchQueries(song) {
  const titles = nameVariants(song.title), artists = artistVariants(song.artist);
  const queries = [];
  for (const title of titles) for (const artist of artists) queries.push({track_name: title, artist_name: artist});
  for (const title of titles) queries.push({q: title});
  return queries.slice(0, 8);
}

export function pickResult(results, song) {
  const artists = artistVariants(song.artist).map(normalize).filter(Boolean);
  const synced = (Array.isArray(results) ? results : []).filter(item => !item.instrumental && (item.syncedLyrics || item.lyricsfile));
  const artistMatch = item => {
    const name = normalize(item.artistName || '');
    return artists.some(artist => name.includes(artist) || artist.includes(name));
  };
  const score = item => (artistMatch(item) ? 2 : 0) + (item.hasWordSync ? 1 : 0);
  const best = synced.sort((a, b) => score(b) - score(a))[0];
  // 가수가 전혀 다르면 같은 제목의 다른 노래일 가능성이 커서 쓰지 않는다.
  return best && artistMatch(best) ? best : null;
}

function unquote(value) {
  value = value.trim();
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  return value;
}

// LRCLIB lyricsfile(YAML)의 lines/words 부분만 읽는다.
export function parseLyricsfile(text) {
  const lines = [];
  let line = null, word = null, inWords = false;
  for (const raw of String(text || '').split('\n')) {
    let match;
    if ((match = raw.match(/^- text:(.*)$/))) {
      line = {text: unquote(match[1]), start: NaN, end: NaN, words: []}; lines.push(line); word = null; inWords = false;
    } else if (!line) {
      continue;
    } else if ((match = raw.match(/^ {2}words:\s*$/))) {
      inWords = true;
    } else if (inWords && (match = raw.match(/^ {2}- text:(.*)$/))) {
      word = {text: unquote(match[1]), start: NaN}; line.words.push(word);
    } else if (inWords && word && (match = raw.match(/^ {4}start_ms:\s*(\d+)/))) {
      word.start = Number(match[1]) / 1000;
    } else if ((match = raw.match(/^ {2}(start|end)_ms:\s*(\d+)/))) {
      line[match[1]] = Number(match[2]) / 1000;
    }
  }
  return lines.filter(item => Number.isFinite(item.start));
}

// [mm:ss.xx] 형식. 한 줄에 시간 표시가 여러 개면 그 시간마다 같은 가사가 나온다.
export function parseSynced(text) {
  const lines = [];
  for (const raw of String(text || '').split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const lyric = raw.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();
    for (const stamp of stamps) lines.push({text: lyric, start: Number(stamp[1]) * 60 + Number(stamp[2]), end: NaN, words: []});
  }
  return lines.sort((a, b) => a.start - b.start);
}

// 끝 시간과 단어 시간이 없는 줄은 다음 줄까지 단어를 고르게 나눠 채운다.
export function prepareLines(lines) {
  const sorted = lines.filter(line => Number.isFinite(line.start)).sort((a, b) => a.start - b.start);
  return sorted.map((line, index) => {
    const next = sorted[index + 1]?.start ?? line.start + MAX_LINE_SECONDS;
    const end = Number.isFinite(line.end) && line.end > line.start ? line.end : Math.min(next, line.start + MAX_LINE_SECONDS);
    let words = line.words.filter(word => word.text);
    if (!words.length || words.some(word => !Number.isFinite(word.start))) {
      const parts = line.text.match(/\S+\s*/g) || [];
      const total = parts.reduce((sum, part) => sum + part.trim().length, 0) || 1;
      let done = 0;
      words = parts.map(part => {
        const start = line.start + (end - line.start) * done / total;
        done += part.trim().length;
        return {text: part, start};
      });
    }
    return {text: line.text, start: line.start, end, words};
  }).filter(line => line.text.trim());
}

export function parseResult(result) {
  if (!result) return [];
  const words = result.lyricsfile ? parseLyricsfile(result.lyricsfile) : [];
  return prepareLines(words.length ? words : parseSynced(result.syncedLyrics));
}

// t초에 불러야 하는 줄의 번호. 첫 줄 전이면 -1.
export function lineIndexAt(lines, t) {
  let low = 0, high = lines.length - 1, found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].start <= t) { found = mid; low = mid + 1; } else high = mid - 1;
  }
  return found;
}

// 각 단어가 얼마나 채워졌는지(0~1).
export function wordProgress(line, t) {
  return line.words.map((word, index) => {
    const end = line.words[index + 1]?.start ?? line.end;
    if (t <= word.start) return 0;
    if (t >= end || end <= word.start) return 1;
    return (t - word.start) / (end - word.start);
  });
}

export async function fetchLyrics(song, {fetch: fetchImpl = fetch, signal} = {}) {
  for (const query of searchQueries(song)) {
    const response = await fetchImpl(`${API}?${new URLSearchParams(query)}`, {signal});
    if (!response.ok) continue;
    const result = pickResult(await response.json(), song);
    const lines = parseResult(result);
    if (lines.length) return {lines, duration: Number(result.duration) || NaN};
  }
  return null;
}
