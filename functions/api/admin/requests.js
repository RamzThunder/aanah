// 관리 페이지(/admin) API. 모든 요청에 Authorization: Bearer <ADMIN_PASSWORD>가 필요하다.
//   GET    /api/admin/requests             → { requests }
//   PATCH  /api/admin/requests  {id,status} → 처리 상태 변경
//   DELETE /api/admin/requests?id=3         → 삭제
import { STATUSES, json, db, isAdmin } from '../_lib.js';

export async function onRequest({ request, env }) {
  if (!env.DB || !env.ADMIN_PASSWORD) return json({ error: '요청함 설정(D1·관리자 비밀번호)이 아직 없어요.' }, 503);
  if (!(await isAdmin(request, env))) return json({ error: '비밀번호가 맞지 않아요.' }, 401);
  const DB = await db(env);

  if (request.method === 'GET') {
    const { results } = await DB.prepare(`SELECT id, created_at, kind, tool, title, body, link, contact, status
      FROM requests ORDER BY created_at DESC LIMIT 1000`).all();
    return json({ requests: results });
  }

  if (request.method === 'PATCH') {
    const { id, status } = await request.json().catch(() => ({}));
    if (!Number.isInteger(id) || !Object.hasOwn(STATUSES, status)) return json({ error: '잘못된 요청이에요.' }, 400);
    await DB.prepare('UPDATE requests SET status = ? WHERE id = ?').bind(status, id).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE') {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id)) return json({ error: '잘못된 요청이에요.' }, 400);
    await DB.prepare('DELETE FROM requests WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
