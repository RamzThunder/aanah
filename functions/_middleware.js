// aanah.fyi/<경로>/ 로 들어온 요청을 GitHub Pages(ramzthunder.github.io)에서 가져와 보여준다.
// 주소창은 aanah.fyi 그대로 유지된다. 실행 범위는 _routes.json에서 정한다.
// 새 도구를 연결하려면 PREFIXES와 _routes.json 두 곳에 경로를 추가하면 된다.

const UPSTREAM = 'https://ramzthunder.github.io';
const PREFIXES = ['/forClass', '/jjirashy', '/dida-releases'];

// 하단에 "아나!에서 다른 도구 보기" 링크를 붙일 페이지. 화면을 꽉 채우는 채점 도구·돌림판은 레이아웃이 깨져서 뺐다.
// 값이 'footer'면 페이지에 이미 있는 하단 줄(footer .wrap) 끝에 이어 붙이고, 'body'면 본문 맨 아래에 한 줄 추가한다.
// tool은 의견 보내기 폼에서 미리 선택될 도구 이름(폼 선택지와 글자가 똑같아야 한다).
const FORCLASS = '평가 도구 모음 (메인)';
const AANAH_LINK_PAGES = {
  '/forClass/': { spot: 'footer', tool: FORCLASS },
  '/forClass/index.html': { spot: 'footer', tool: FORCLASS },
  '/forClass/privacy.html': { spot: 'body', tool: FORCLASS },
  '/forClass/terms.html': { spot: 'body', tool: FORCLASS },
  '/jjirashy/jjirasi_sticker_maker.html': { spot: 'body', tool: '찌라시 스티커 생성기' },
  '/dida-releases/': { spot: 'body', tool: '디다' },
  '/dida-releases/index.html': { spot: 'body', tool: '디다' },
  '/dida-releases/privacy.html': { spot: 'body', tool: '디다' },
  '/dida-releases/terms.html': { spot: 'body', tool: '디다' },
};
const FEEDBACK_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSf3LzumGBb5t9QskyB-CtbIGP41AC6S4h2uGFizKO3KOKcw4w/viewform';
const FEEDBACK_TOOL_ENTRY = 'entry.1162952170';

function feedbackLink(tool, style) {
  const href = `${FEEDBACK_FORM}?usp=pp_url&${FEEDBACK_TOOL_ENTRY}=${encodeURIComponent(tool)}`;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${style}">의견 보내기</a>`;
}
function footerLinks(tool) {
  return ' · <a href="/" style="text-decoration:underline">아나!에서 다른 도구 보기</a>'
    + ' · ' + feedbackLink(tool, 'text-decoration:underline');
}
function bodyLinks(tool) {
  const a = 'color:inherit;text-decoration:underline';
  return '<div style="margin:40px auto 28px;padding:0 16px;text-align:center;font:13px/1.6 system-ui,-apple-system,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;color:#8a94a6">'
    + `<a href="/" style="${a}">아나!에서 다른 도구 보기 →</a> · ${feedbackLink(tool, a)}</div>`;
}

const PASS_REQUEST_HEADERS = ['accept', 'accept-language', 'if-none-match', 'if-modified-since', 'range'];
const DROP_RESPONSE_HEADERS = ['set-cookie', 'via', 'x-github-request-id', 'x-fastly-request-id', 'x-served-by', 'x-cache', 'x-cache-hits', 'x-timer', 'x-proxy-cache'];

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const matched = PREFIXES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'));
  if (!matched) return next();

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const spot = AANAH_LINK_PAGES[url.pathname];
  const headers = new Headers();
  for (const name of PASS_REQUEST_HEADERS) {
    // 링크를 붙이는 페이지는 브라우저 캐시 확인(304)을 넘기지 않는다. 넘기면 링크 없는 옛 사본이 계속 쓰인다.
    if (spot && (name === 'if-none-match' || name === 'if-modified-since' || name === 'range')) continue;
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

  if (spot && response.status === 200 && (response.headers.get('content-type') || '').includes('text/html')) {
    response.headers.delete('etag');
    response.headers.delete('last-modified');
    response.headers.delete('content-length');
    let done = false;
    const rewriter = new HTMLRewriter();
    if (spot.spot === 'footer') {
      rewriter.on('footer .wrap', { element(el) { if (!done) { el.append(footerLinks(spot.tool), { html: true }); done = true; } } });
    }
    // footer를 못 찾았거나 'body'면 본문 맨 아래에 붙인다.
    rewriter.on('body', { element(el) { el.onEndTag(end => { if (!done) { end.before(bodyLinks(spot.tool), { html: true }); done = true; } }); } });
    return rewriter.transform(response);
  }
  return response;
}
