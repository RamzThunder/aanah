// 요청함(의견·오류·곡 신청) 공용 코드. 라우트가 아니라 다른 함수들이 import해서 쓴다.
//
// Cloudflare Pages 설정에서 필요한 것
//   D1 바인딩  DB                  요청과 문제은행 수정안을 저장한다. 표는 처음 쓸 때 자동으로 만든다.
//   비밀 값    ADMIN_PASSWORD      /admin 관리 페이지 비밀번호
//   (선택)     TURNSTILE_SITE_KEY / TURNSTILE_SECRET  로봇 확인. 둘 다 있을 때만 켜진다.

export const KINDS = { bug: '오류 신고', idea: '기능 제안', song: '곡 신청', etc: '기타' };
export const STATUSES = { new: '새 요청', seen: '확인함', done: '반영함', hold: '보류' };

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

let ready;
export function db(env) {
  if (!env.DB) return null;
  ready ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, kind TEXT NOT NULL, tool TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new',
      ip_hash TEXT NOT NULL DEFAULT '')`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS request_images (
      id TEXT PRIMARY KEY, mime TEXT NOT NULL, byte_size INTEGER NOT NULL,
      content_hash TEXT NOT NULL, data BLOB NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS request_image_links (
      request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      image_id TEXT NOT NULL REFERENCES request_images(id) ON DELETE CASCADE,
      PRIMARY KEY(request_id, image_id)) WITHOUT ROWID`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS request_images_link ON request_image_links (image_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS requests_ip_time ON requests (ip_hash, created_at)'),
    // 관리 페이지에서 고친 기본 문제은행 수정안. Claude가 코드(intro-quiz/bank-edits.mjs)에 반영하면 지운다.
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bank_audio_starts (
      song_id TEXT PRIMARY KEY, intro_video TEXT NOT NULL, intro_start REAL NOT NULL,
      previous_starts TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bank_edits (
      song_id TEXT PRIMARY KEY, changes TEXT NOT NULL, base TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
  ]).catch(e => { ready = undefined; throw e; });
  return ready.then(() => env.DB);
}

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? enc.encode(value) : value));

// 길이가 같은 해시끼리 비교해서 비밀번호 길이·내용이 응답 시간으로 새지 않게 한다.
export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [a, b] = await Promise.all([sha256(given), sha256(env.ADMIN_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return given.length > 0 && diff === 0;
}
