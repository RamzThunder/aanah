// 설치 앱 다운로드를 aanah.fyi 주소로 내준다. 학교 업무망처럼 GitHub 파일 서버·API가 막히거나 느린 곳을 위한 것.
//
//   /download/<레포>/latest.json        최신 릴리즈 버전과 설치 파일 목록 (10분 캐시)
//   /download/<레포>/<태그>/<파일이름>    설치 파일 (Cloudflare에 7일 캐시, 'latest' 태그는 10분)
//
// 아무 레포나 중계하지 않도록 RELEASE_REPOS에 적힌 레포의 .exe/.msi/.dmg만 내준다.

const OWNER = 'RamzThunder';
const RELEASE_REPOS = ['whattime-releases', 'PanDeckI', 'BLANKing_releases', 'dida-releases'];
const INSTALLER = /\.(exe|msi|dmg)$/i;
const TEN_MIN = 600;
const WEEK = 604800;

const notFound = () => new Response('찾는 파일이 없습니다.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const json = (body, status = 200, maxAge = TEN_MIN) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
});

const UA = { 'User-Agent': 'aanah.fyi-download' };

function shape(repo, tag, published, assets) {
  return {
    tag,
    version: String(tag || '').replace(/^v/i, ''),
    published: published || null,
    assets: assets.filter(a => INSTALLER.test(a.name)).map(a => ({
      name: a.name,
      size: a.size || null,
      url: `/download/${repo}/${encodeURIComponent(tag)}/${encodeURIComponent(a.name)}`,
    })),
  };
}

// 1순위: GitHub API. 로그인 없이 쓰면 Cloudflare 서버 IP끼리 한도(시간당 60회)를 나눠 써서 자주 막힌다.
// Cloudflare 환경 변수에 GITHUB_TOKEN을 넣어 두면 한도가 넉넉해진다(없어도 아래 2순위로 동작).
async function fromApi(repo, env) {
  const headers = { ...UA, Accept: 'application/vnd.github+json' };
  if (env && env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/releases/latest`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const r = await res.json();
  return shape(repo, r.tag_name, r.published_at, r.assets || []);
}

// 2순위: 릴리즈 웹페이지에서 직접 읽기(횟수 제한 없음).
// /releases/latest 가 /releases/tag/<태그> 로 넘겨주는 걸로 태그를 알아내고, 파일 목록 조각에서 파일 이름을 뽑는다.
async function fromPages(repo) {
  const head = await fetch(`https://github.com/${OWNER}/${repo}/releases/latest`, { headers: UA, redirect: 'manual' });
  const m = (head.headers.get('location') || '').match(/\/releases\/tag\/([^/?#]+)/);
  if (!m) throw new Error('latest tag not found');
  const tag = decodeURIComponent(m[1]);
  const res = await fetch(`https://github.com/${OWNER}/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`, { headers: UA });
  if (!res.ok) throw new Error(`assets page ${res.status}`);
  const html = await res.text();
  const prefix = `/${OWNER}/${repo}/releases/download/${tag}/`;
  const names = new Set();
  for (const m2 of html.matchAll(/href="([^"]+)"/g)) {
    const href = m2[1].replace(/&amp;/g, '&');
    if (href.startsWith(prefix)) names.add(decodeURIComponent(href.slice(prefix.length)));
  }
  if (!names.size) throw new Error('no assets found');
  return shape(repo, tag, null, [...names].map(name => ({ name })));
}

async function latestRelease(repo, env) {
  try { return await fromApi(repo, env); } catch { return await fromPages(repo); }
}

export async function onRequest({ request, env, waitUntil, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const parts = [].concat(params.path || []);
  const repo = parts[0];
  if (!RELEASE_REPOS.includes(repo)) return notFound();

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + new URL(request.url).pathname, { method: 'GET' });

  // 최신 버전 정보
  if (parts.length === 2 && parts[1] === 'latest.json') {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    // 마지막으로 성공한 결과를 하루 동안 따로 보관해 두고, GitHub가 둘 다 안 될 때 그걸 내준다.
    const staleKey = new Request(cacheKey.url + '?stale=1', { method: 'GET' });
    try {
      const data = await latestRelease(repo, env);
      const res = json(data);
      waitUntil(Promise.all([cache.put(cacheKey, res.clone()), cache.put(staleKey, json(data, 200, 86400))]));
      return res;
    } catch (e) {
      const stale = await cache.match(staleKey);
      if (stale) return new Response(stale.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
      return json({ error: '최신 버전을 확인하지 못했습니다.' }, 503, 60);
    }
  }

  // 설치 파일
  if (parts.length !== 3) return notFound();
  const [, tag, name] = parts;
  if (!/^[\w.\-]+$/.test(tag) || name.includes('/') || !INSTALLER.test(name)) return notFound();

  const hit = await cache.match(new Request(cacheKey.url, { headers: request.headers }));
  if (hit) return hit;

  const source = tag === 'latest'
    ? `https://github.com/${OWNER}/${repo}/releases/latest/download/${encodeURIComponent(name)}`
    : `https://github.com/${OWNER}/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
  const upstream = await fetch(source, { redirect: 'follow', headers: { 'User-Agent': 'aanah.fyi-download' } });
  if (!upstream.ok) return upstream.status === 404 ? notFound() : new Response('잠시 받을 수 없습니다. 조금 뒤 다시 시도해 주세요.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const headers = new Headers({
    'content-type': 'application/octet-stream',
    'content-disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
    'cache-control': `public, max-age=${tag === 'latest' ? TEN_MIN : WEEK}`,
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('content-length', length);

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  // 받은 파일을 사용자에게 보내면서 동시에 Cloudflare 캐시에 저장한다(다음 사람부터는 GitHub에 안 감).
  const [toUser, toCache] = upstream.body.tee();
  waitUntil(cache.put(cacheKey, new Response(toCache, { headers })));
  return new Response(toUser, { status: 200, headers });
}
