// 카카오 로그인에서 돌아오는 주소. 카카오 개발자 콘솔의 Redirect URI에 https://aanah.fyi/api/kakao/callback 을 등록한다.
import { ADMIN_PATH, db, checkState, connectKakao, kakaoRedirect } from '../_lib.js';

const back = (request, result) => Response.redirect(new URL(`${ADMIN_PATH}?kakao=${result}`, request.url).href, 302);

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  if (!env.DB || !env.KAKAO_REST_KEY) return back(request, 'unconfigured');
  if (!(await checkState(env, params.get('state')))) return back(request, 'expired');
  const code = params.get('code');
  if (!code) return back(request, 'denied');
  try {
    await connectKakao(env, await db(env), code, kakaoRedirect(request));
    return back(request, 'connected');
  } catch (e) {
    console.error(e.message);
    return back(request, 'failed');
  }
}
