import {json, db, isAdmin} from '../../_lib.js';

export async function onRequest({request, env, params}) {
  if (!env.DB || !env.ADMIN_PASSWORD) return json({error: '요청함이 아직 준비되지 않았어요.'}, 503);
  if (!(await isAdmin(request, env))) return json({error: '비밀번호가 맞지 않아요.'}, 401);
  if (!['GET', 'HEAD'].includes(request.method)) return json({error: 'Method Not Allowed'}, 405);
  if (!/^[a-f0-9-]{36}$/.test(params.id)) return json({error: '사진을 찾을 수 없어요.'}, 404);
  const DB = await db(env);
  const row = await DB.prepare(`SELECT i.mime, i.data, i.byte_size FROM request_images i
    WHERE i.id = ? AND EXISTS (SELECT 1 FROM request_image_links l WHERE l.image_id = i.id)`).bind(params.id).first();
  if (!row) return json({error: '사진을 찾을 수 없어요.'}, 404);
  return new Response(request.method === 'HEAD' ? null : new Uint8Array(row.data), {headers: {
    'content-type': row.mime, 'content-length': String(row.byte_size), 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff', 'content-disposition': `inline; filename="capture.${row.mime === 'image/webp' ? 'webp' : 'jpg'}"`,
  }});
}
