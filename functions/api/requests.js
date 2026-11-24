// 요청 보내기(/request)가 쓰는 API.
//   GET  /api/requests  → { ready, turnstile }  요청함 사용 가능 여부와 로봇 확인 사이트 키
//   POST /api/requests  → 요청 저장
import { KINDS, json, db, sha256 } from './_lib.js';

const SONG_TOOL = '전주 듣고 노래 맞히기';
const LIMITS = { tool: 60, title: 200, body: 2000, link: 300, contact: 100 };
const WINDOW = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MAX_SONGS = 20;

const ready = env => !!(env.DB && env.ADMIN_PASSWORD);
const turnstileOn = env => !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);

export function onRequestGet({ env }) {
  return json({ ready: ready(env), turnstile: turnstileOn(env) ? env.TURNSTILE_SITE_KEY : null });
}

const text = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  if (!ready(env)) return json({ error: '요청함이 아직 준비되지 않았어요.' }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: '잘못된 요청이에요.' }, 400); }

  // 사람에게는 보이지 않는 칸. 채워져 있으면 봇이므로 저장하지 않고 성공처럼 답한다.
  if (input.website) return json({ ok: true });

  const kind = Object.hasOwn(KINDS, input.kind) ? input.kind : null;
  if (!kind) return json({ error: '요청 종류를 골라 주세요.' }, 400);
  const tool = kind === 'song' ? SONG_TOOL : text(input.tool, LIMITS.tool) || '아나! 전체';
  const contact = text(input.contact, LIMITS.contact);
  const body = text(input.body, LIMITS.body);
  // 곡 신청은 한 번에 여러 곡을 받아 곡마다 한 줄씩 저장한다(관리 페이지에서 같은 곡끼리 묶어 세기 위해).
  const rows = [];
  if (kind === 'song') {
    const list = Array.isArray(input.songs) ? input.songs : [{ artist: input.artist, song: input.song, link: input.link }];
    for (const [i, item] of list.slice(0, MAX_SONGS + 1).entries()) {
      const artist = text(item?.artist, 100), song = text(item?.song, 100), link = text(item?.link, LIMITS.link);
      if (!artist && !song && !link) continue;
      const where = list.length > 1 ? `${i + 1}번째 곡: ` : '';
      if (!artist || !song) return json({ error: `${where}가수와 노래 제목을 모두 적어 주세요.` }, 400);
      if (link && !/^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(link)) {
        return json({ error: `${where}유튜브 링크만 붙여 넣을 수 있어요.` }, 400);
      }
      rows.push({ title: `${artist} - ${song}`, link });
    }
    if (!rows.length) return json({ error: '가수와 노래 제목을 적어 주세요.' }, 400);
    if (rows.length > MAX_SONGS) return json({ error: `한 번에 ${MAX_SONGS}곡까지 보낼 수 있어요.` }, 400);
  } else {
    if (!body) return json({ error: '내용을 적어 주세요.' }, 400);
    rows.push({ title: text(input.title, LIMITS.title), link: '' });
  }

  const ip = request.headers.get('cf-connecting-ip') || '';
  if (turnstileOn(env)) {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(input.turnstile || ''), remoteip: ip });
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
      .then(r => r.json()).catch(() => ({}));
    if (!check.success) return json({ error: '로봇 확인에 실패했어요. 새로고침 후 다시 시도해 주세요.' }, 400);
  }

  const DB = await db(env);
  const now = Date.now();
  const ipHash = await sha256(`${env.ADMIN_PASSWORD}:${ip}`);
  // 한 번에 보낸 여러 곡은 created_at이 같으므로 보낸 횟수로 센다.
  const recent = await DB.prepare('SELECT COUNT(DISTINCT created_at) AS n FROM requests WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - WINDOW).first();
  if (recent.n >= MAX_PER_WINDOW) return json({ error: '잠시 뒤에 다시 보내 주세요. (10분에 5개까지)' }, 429);

  const insert = DB.prepare(`INSERT INTO requests (created_at, kind, tool, title, body, link, contact, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  await DB.batch(rows.map(r => insert.bind(now, kind, tool, r.title, body, r.link, contact, ipHash)));

  return json({ ok: true });
}
