// 관리 페이지 '문제은행' 탭 API. 기본 문제은행 수정안을 반영 대기로 저장한다.
// 모든 요청에 Authorization: Bearer <ADMIN_PASSWORD>가 필요하다.
//   GET    /api/admin/bank                         → { edits: [{ song_id, changes, base, updated_at }] }
//   PUT    /api/admin/bank  { edits: [{ id, changes, base }] }  → 저장(changes가 비면 그 곡의 수정안을 지운다)
//   DELETE /api/admin/bank?id=song-12              → 그 곡의 수정안 취소
import { json, db, isAdmin } from '../_lib.js';

export const BANK_FIELDS = ['title', 'artist', 'year', 'genre', 'work', 'introVideo', 'introStart', 'shortformStart', 'answerVideo', 'answerStart', 'checked'];
const ID = /^[\w-]{1,40}$/;
const MAX_BATCH = 300;

const okValue = v => v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 200);
function clean(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!BANK_FIELDS.includes(k) || !okValue(v)) return null;
    out[k] = v;
  }
  return out;
}

export async function onRequest({ request, env }) {
  if (!env.DB || !env.ADMIN_PASSWORD) return json({ error: '요청함 설정(D1·관리자 비밀번호)이 아직 없어요.' }, 503);
  if (!(await isAdmin(request, env))) return json({ error: '비밀번호가 맞지 않아요.' }, 401);
  const DB = await db(env);

  if (request.method === 'GET') {
    const { results } = await DB.prepare('SELECT song_id, changes, base, updated_at FROM bank_edits ORDER BY updated_at DESC').all();
    return json({ edits: results.map(r => ({ ...r, changes: JSON.parse(r.changes), base: JSON.parse(r.base) })) });
  }

  if (request.method === 'PUT') {
    const { edits } = await request.json().catch(() => ({}));
    if (!Array.isArray(edits) || !edits.length || edits.length > MAX_BATCH) return json({ error: '잘못된 요청이에요.' }, 400);
    const now = Date.now(), statements = [];
    for (const e of edits) {
      const changes = clean(e?.changes), base = clean(e?.base);
      if (!ID.test(String(e?.id)) || !changes || !base) return json({ error: '잘못된 수정안이에요.' }, 400);
      statements.push(Object.keys(changes).length
        ? DB.prepare(`INSERT INTO bank_edits (song_id, changes, base, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(song_id) DO UPDATE SET changes = excluded.changes, base = excluded.base, updated_at = excluded.updated_at`)
            .bind(e.id, JSON.stringify(changes), JSON.stringify(base), now)
        : DB.prepare('DELETE FROM bank_edits WHERE song_id = ?').bind(e.id));
    }
    await DB.batch(statements);
    return json({ ok: true });
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (!ID.test(String(id))) return json({ error: '잘못된 요청이에요.' }, 400);
    await DB.prepare('DELETE FROM bank_edits WHERE song_id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
