// 요청 보내기(/request)가 쓰는 API.
//   GET  /api/requests  → { ready, turnstile }  요청함 사용 가능 여부와 로봇 확인 사이트 키
//   POST /api/requests  → 요청 저장 후 카카오톡 나에게 보내기로 알림
import { KINDS, ADMIN_PATH, json, db, sha256, sendKakao, notificationText } from './_lib.js';

const SONG_TOOL = '전주 듣고 노래 맞히기';
const LIMITS = { tool: 60, title: 200, body: 2000, link: 300, contact: 100 };
const WINDOW = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const ready = env => !!(env.DB && env.ADMIN_PASSWORD);
const turnstileOn = env => !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);

export function onRequestGet({ env }) {
  return json({ ready: ready(env), turnstile: turnstileOn(env) ? env.TURNSTILE_SITE_KEY : null });
}

const text = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

export async function onRequestPost({ request, env, waitUntil }) {
  if (!ready(env)) return json({ error: '요청함이 아직 준비되지 않았어요.' }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: '잘못된 요청이에요.' }, 400); }

  // 사람에게는 보이지 않는 칸. 채워져 있으면 봇이므로 저장하지 않고 성공처럼 답한다.
  if (input.website) return json({ ok: true });

  const kind = Object.hasOwn(KINDS, input.kind) ? input.kind : null;
  if (!kind) return json({ error: '요청 종류를 골라 주세요.' }, 400);
  const tool = kind === 'song' ? SONG_TOOL : text(input.tool, LIMITS.tool) || '아나! 전체';
  const contact = text(input.contact, LIMITS.contact);
  let title, body, link = '';
  if (kind === 'song') {
    const artist = text(input.artist, 100), song = text(input.song, 100);
    if (!artist || !song) return json({ error: '가수와 노래 제목을 모두 적어 주세요.' }, 400);
    title = `${artist} - ${song}`;
    body = text(input.body, LIMITS.body);
    link = text(input.link, LIMITS.link);
    if (link && !/^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(link)) {
      return json({ error: '유튜브 링크만 붙여 넣을 수 있어요.' }, 400);
    }
  } else {
    title = text(input.title, LIMITS.title);
    body = text(input.body, LIMITS.body);
    if (!body) return json({ error: '내용을 적어 주세요.' }, 400);
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
  const recent = await DB.prepare('SELECT COUNT(*) AS n FROM requests WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - WINDOW).first();
  if (recent.n >= MAX_PER_WINDOW) return json({ error: '잠시 뒤에 다시 보내 주세요. (10분에 5개까지)' }, 429);

  const row = { kind, tool, title, body, link, contact };
  const saved = await DB.prepare(`INSERT INTO requests (created_at, kind, tool, title, body, link, contact, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).bind(now, kind, tool, title, body, link, contact, ipHash).first();

  // 알림이 실패해도 요청은 이미 저장됐으니 응답은 기다리지 않는다.
  waitUntil(sendKakao(env, DB, notificationText(row), new URL(ADMIN_PATH, request.url).href)
    .then(r => r.sent && DB.prepare('UPDATE requests SET notified = 1 WHERE id = ?').bind(saved.id).run())
    .catch(e => console.error(e.message)));

  return json({ ok: true });
}
