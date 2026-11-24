// 관리 페이지(/admin) API. 모든 요청에 Authorization: Bearer <ADMIN_PASSWORD>가 필요하다.
//   GET    /api/admin/requests             → { requests, kakao }
//   PATCH  /api/admin/requests  {id,status} → 처리 상태 변경
//   DELETE /api/admin/requests?id=3         → 삭제
//   POST   /api/admin/requests  {action:'kakao-login'} → 카카오 로그인 주소
//   POST   /api/admin/requests  {action:'kakao-test'}  → 테스트 메시지 보내기
import { STATUSES, ADMIN_PATH, json, db, isAdmin, makeState, kakaoRedirect, kakaoStatus, sendKakao } from '../_lib.js';

export async function onRequest({ request, env }) {
  if (!env.DB || !env.ADMIN_PASSWORD) return json({ error: '요청함 설정(D1·관리자 비밀번호)이 아직 없어요.' }, 503);
  if (!(await isAdmin(request, env))) return json({ error: '비밀번호가 맞지 않아요.' }, 401);
  const DB = await db(env);

  if (request.method === 'GET') {
    const { results } = await DB.prepare(`SELECT id, created_at, kind, tool, title, body, link, contact, status, notified
      FROM requests ORDER BY created_at DESC LIMIT 1000`).all();
    return json({ requests: results, kakao: { configured: !!env.KAKAO_REST_KEY, ...(await kakaoStatus(DB)) } });
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

  if (request.method === 'POST') {
    const { action } = await request.json().catch(() => ({}));
    if (!env.KAKAO_REST_KEY) return json({ error: 'KAKAO_REST_KEY가 설정되지 않았어요.' }, 400);
    if (action === 'kakao-login') {
      const url = new URL('https://kauth.kakao.com/oauth/authorize');
      url.search = new URLSearchParams({
        client_id: env.KAKAO_REST_KEY, redirect_uri: kakaoRedirect(request), response_type: 'code',
        scope: 'talk_message', state: await makeState(env),
      });
      return json({ url: url.href });
    }
    if (action === 'kakao-test') {
      try {
        const r = await sendKakao(env, DB, '[아나] 테스트 알림이에요. 새 요청이 오면 이렇게 알려 드릴게요.', new URL(ADMIN_PATH, request.url).href);
        return r.sent ? json({ ok: true }) : json({ error: r.skipped }, 400);
      } catch (e) {
        return json({ error: e.message }, 502);
      }
    }
    return json({ error: '알 수 없는 동작이에요.' }, 400);
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
