// 요청함(의견·오류·곡 신청) 공용 코드. 라우트가 아니라 다른 함수들이 import해서 쓴다.
//
// Cloudflare Pages 설정에서 필요한 것
//   D1 바인딩  DB                  요청과 카카오 토큰을 저장한다. 표는 처음 쓸 때 자동으로 만든다.
//   비밀 값    ADMIN_PASSWORD      /admin 관리 페이지 비밀번호
//   비밀 값    KAKAO_REST_KEY      카카오 개발자 앱의 REST API 키 (없으면 카톡 알림을 건너뛴다)
//   비밀 값    KAKAO_CLIENT_SECRET 카카오 앱에서 Client Secret을 켰을 때만
//   (선택)     TURNSTILE_SITE_KEY / TURNSTILE_SECRET  로봇 확인. 둘 다 있을 때만 켜진다.

export const KINDS = { bug: '오류 신고', idea: '기능 제안', song: '곡 신청', etc: '기타' };
export const STATUSES = { new: '새 요청', seen: '확인함', done: '반영함', hold: '보류' };
export const ADMIN_PATH = '/admin';

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
      contact TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', notified INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT NOT NULL DEFAULT '')`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS requests_ip_time ON requests (ip_hash, created_at)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS kakao_token (
      id INTEGER PRIMARY KEY CHECK (id = 1), access_token TEXT NOT NULL, access_expires INTEGER NOT NULL,
      refresh_token TEXT NOT NULL, refresh_expires INTEGER NOT NULL)`),
  ]).catch(e => { ready = undefined; throw e; });
  return ready.then(() => env.DB);
}

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

// 길이가 같은 해시끼리 비교해서 비밀번호 길이·내용이 응답 시간으로 새지 않게 한다.
export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [a, b] = await Promise.all([sha256(given), sha256(env.ADMIN_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return given.length > 0 && diff === 0;
}

// 카카오 로그인 왕복에 쓰는 state. 관리자만 만들 수 있고 10분 동안 유효하다.
export async function makeState(env) {
  const ts = Date.now().toString(36);
  return `${ts}.${await hmac(env.ADMIN_PASSWORD, 'kakao:' + ts)}`;
}
export async function checkState(env, state) {
  const [ts, sig] = String(state || '').split('.');
  if (!ts || !sig || !env.ADMIN_PASSWORD) return false;
  if (Date.now() - parseInt(ts, 36) > 10 * 60 * 1000) return false;
  return sig === await hmac(env.ADMIN_PASSWORD, 'kakao:' + ts);
}

export const kakaoRedirect = request => new URL('/api/kakao/callback', request.url).href;

async function kakaoToken(env, params) {
  const body = new URLSearchParams({ client_id: env.KAKAO_REST_KEY, ...params });
  if (env.KAKAO_CLIENT_SECRET) body.set('client_secret', env.KAKAO_CLIENT_SECRET);
  const res = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`카카오 토큰 발급 실패: ${data.error_description || data.error || res.status}`);
  return data;
}

async function saveToken(DB, data, previous) {
  const now = Date.now();
  const row = {
    access_token: data.access_token,
    access_expires: now + (data.expires_in || 0) * 1000,
    // 갱신 응답에는 refresh_token이 만료가 가까울 때만 새로 온다.
    refresh_token: data.refresh_token || previous.refresh_token,
    refresh_expires: data.refresh_token ? now + (data.refresh_token_expires_in || 0) * 1000 : previous.refresh_expires,
  };
  await DB.prepare(`INSERT INTO kakao_token (id, access_token, access_expires, refresh_token, refresh_expires) VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, access_expires = excluded.access_expires,
    refresh_token = excluded.refresh_token, refresh_expires = excluded.refresh_expires`)
    .bind(row.access_token, row.access_expires, row.refresh_token, row.refresh_expires).run();
  return row;
}

export async function connectKakao(env, DB, code, redirectUri) {
  const data = await kakaoToken(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  return saveToken(DB, data, {});
}

export async function kakaoStatus(DB) {
  const row = await DB.prepare('SELECT refresh_expires FROM kakao_token WHERE id = 1').first();
  return row ? { connected: row.refresh_expires > Date.now(), refreshExpires: row.refresh_expires } : { connected: false };
}

// 나에게 보내기. 본문은 카카오 제한(200자)에 맞춰 자른다.
export async function sendKakao(env, DB, text, url) {
  if (!env.KAKAO_REST_KEY) return { skipped: '카카오 키가 설정되지 않았어요.' };
  let token = await DB.prepare('SELECT * FROM kakao_token WHERE id = 1').first();
  if (!token || token.refresh_expires <= Date.now()) return { skipped: '카카오 연결이 필요해요.' };
  if (token.access_expires - 60_000 <= Date.now()) {
    token = await saveToken(DB, await kakaoToken(env, { grant_type: 'refresh_token', refresh_token: token.refresh_token }), token);
  }
  const template = {
    object_type: 'text',
    text: text.length > 200 ? text.slice(0, 199) + '…' : text,
    link: { web_url: url, mobile_web_url: url },
    button_title: '관리 페이지 열기',
  };
  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${token.access_token}` },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  });
  if (!res.ok) throw new Error(`카카오 전송 실패: ${res.status} ${await res.text()}`);
  return { sent: true };
}

export function notificationText(r) {
  const lines = [`[아나] 새 요청 · ${KINDS[r.kind]}`, `도구: ${r.tool}`];
  // 긴 본문이 잘려도 보낸 분은 보이도록 본문보다 앞에 둔다.
  if (r.contact) lines.push(`보낸 분: ${r.contact}`);
  if (r.title) lines.push(r.title);
  if (r.body) lines.push(r.body);
  return lines.join('\n');
}
