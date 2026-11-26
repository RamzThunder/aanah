// 요청 보내기(/request)가 쓰는 API.
//   GET  /api/requests  → { ready, turnstile }  요청함 사용 가능 여부와 로봇 확인 사이트 키
//   POST /api/requests  → 요청 저장
import { KINDS, json, db, sha256 } from './_lib.js';
import {parseRequest, UploadError} from './_request-images.js';

const SONG_TOOL = '전주 듣고 노래 맞히기';
const LIMITS = { tool: 60, title: 200, body: 2000, link: 300, contact: 100 };
// 사람에게는 사실상 제한이 없고(같은 학교 선생님들은 IP를 함께 쓴다), 봇이 D1 하루 쓰기 한도를
// 다 써 버리는 것만 막는 상한. 곡 여러 개를 한 번에 보내면 곡 수만큼 센다.
const WINDOW = 10 * 60 * 1000;
const MAX_ROWS_PER_WINDOW = 300;
const MAX_SONGS = 20;

const ready = env => !!(env.DB && env.ADMIN_PASSWORD);
const turnstileOn = env => !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);

export function onRequestGet({ env }) {
  return json({ ready: ready(env), turnstile: turnstileOn(env) ? env.TURNSTILE_SITE_KEY : null });
}

const text = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  if (!ready(env)) return json({ error: '요청함이 아직 준비되지 않았어요.' }, 503);
  let input, images;
  try { ({input, images} = await parseRequest(request)); }
  catch (error) { return json({error: error instanceof UploadError ? error.message : '잘못된 요청이에요.'}, error.status || 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({error: '잘못된 요청이에요.'}, 400);

  // 사람에게는 보이지 않는 칸. 채워져 있으면 봇이므로 저장하지 않고 성공처럼 답한다.
  if (input.website) return json({ ok: true });

  const kind = Object.hasOwn(KINDS, input.kind) ? input.kind : null;
  if (!kind) return json({ error: '요청 종류를 골라 주세요.' }, 400);
  // 곡 신청 화면에는 캡처 칸이 없다. 예전 화면이나 직접 보낸 요청에 사진이 섞여 와도 저장하지 않는다.
  if (kind === 'song') images = [];
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
  const { results: recent } = await DB.prepare('SELECT id, kind, title, body FROM requests WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - WINDOW).all();
  if (recent.length + rows.length > MAX_ROWS_PER_WINDOW) {
    return json({ error: '짧은 시간에 너무 많이 보냈어요. 10분쯤 뒤에 다시 보내 주세요.' }, 429);
  }
  // 두 번 누르기·새로고침으로 같은 내용이 다시 오면 저장하지 않고 성공으로 답한다.
  const {results: recentImages} = await DB.prepare(`SELECT l.request_id, i.content_hash FROM request_image_links l
    JOIN request_images i ON i.id = l.image_id JOIN requests r ON r.id = l.request_id
    WHERE r.ip_hash = ? AND r.created_at > ?`).bind(ipHash, now - WINDOW).all();
  const hashes = new Map();
  for (const image of recentImages) { const list = hashes.get(image.request_id) || []; list.push(image.content_hash); hashes.set(image.request_id, list); }
  const signature = images.map(image => image.hash).sort().join(',');
  const seen = new Set(recent.map(r => `${r.kind}\n${r.title}\n${r.body}\n${(hashes.get(r.id) || []).sort().join(',')}`));
  const fresh = rows.filter(r => !seen.has(`${kind}\n${r.title}\n${body}\n${signature}`));
  if (!fresh.length) return json({ ok: true });

  if (images.length) {
    const {results: uploads} = await DB.prepare(`SELECT DISTINCT r.id FROM requests r JOIN request_image_links l ON l.request_id = r.id WHERE r.ip_hash = ? AND r.created_at > ?`).bind(ipHash, now - WINDOW).all();
    if (uploads.length + fresh.length > 30) return json({error: '짧은 시간에 사진을 너무 많이 보냈어요. 10분쯤 뒤에 다시 보내 주세요.'}, 429);
    const stored = await DB.prepare('SELECT COALESCE(SUM(byte_size), 0) AS bytes FROM request_images').first();
    if (stored.bytes + images.reduce((sum, image) => sum + image.bytes, 0) > 200 * 1024 * 1024) return json({error: '사진 첨부 공간이 가득 찼어요. 사진을 빼고 내용을 먼저 보내 주세요.'}, 503);
  }
  const insert = DB.prepare(`INSERT INTO requests (created_at, kind, tool, title, body, link, contact, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const statements = images.map(image => DB.prepare('INSERT INTO request_images (id, mime, byte_size, content_hash, data) VALUES (?, ?, ?, ?, ?)')
    .bind(image.id, image.mime, image.bytes, image.hash, image.data.buffer));
  for (const row of fresh) {
    statements.push(insert.bind(now, kind, tool, row.title, body, row.link, contact, ipHash));
  }
  if (images.length) {
    // 같은 트랜잭션에서 막 삽입한 요청에 연결한다. 여러 곡 신청도 사진 원본은 한 번만 저장한다.
    statements.push(DB.prepare(`INSERT INTO request_image_links (request_id, image_id)
      SELECT r.id, i.id FROM (SELECT id FROM requests WHERE ip_hash = ? AND created_at = ? ORDER BY id DESC LIMIT ?) r
      CROSS JOIN request_images i WHERE i.id IN (${images.map(() => '?').join(',')})`)
      .bind(ipHash, now, fresh.length, ...images.map(image => image.id)));
  }
  await DB.batch(statements);

  return json({ ok: true });
}
