// aanah.fyi/<경로>/ 로 들어온 요청을 GitHub Pages(ramzthunder.github.io)에서 가져와 보여준다.
// 주소창은 aanah.fyi 그대로 유지된다. 실행 범위는 _routes.json에서 정한다.
// 새 도구를 연결하려면 PREFIXES와 _routes.json 두 곳에 경로를 추가하면 된다.

const UPSTREAM = 'https://ramzthunder.github.io';
const PREFIXES = ['/forClass', '/jjirashy', '/dida-releases'];

const PASS_REQUEST_HEADERS = ['accept', 'accept-language', 'if-none-match', 'if-modified-since', 'range'];
const DROP_RESPONSE_HEADERS = ['set-cookie', 'via', 'x-github-request-id', 'x-fastly-request-id', 'x-served-by', 'x-cache', 'x-cache-hits', 'x-timer', 'x-proxy-cache'];

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const matched = PREFIXES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'));
  if (!matched) return next();

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const headers = new Headers();
  for (const name of PASS_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream;
  try {
    upstream = await fetch(UPSTREAM + url.pathname + url.search, { method: request.method, headers, redirect: 'manual' });
  } catch {
    return new Response('잠시 연결이 안 됩니다. 조금 뒤 새로고침해 주세요.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const response = new Response(upstream.body, upstream);
  for (const name of DROP_RESPONSE_HEADERS) response.headers.delete(name);

  // GitHub Pages가 /forClass → /forClass/ 처럼 넘길 때 주소가 github.io로 바뀌지 않게 한다.
  const location = response.headers.get('location');
  if (location) {
    const target = new URL(location, UPSTREAM);
    if (target.origin === UPSTREAM) response.headers.set('location', target.pathname + target.search + target.hash);
  }
  return response;
}
