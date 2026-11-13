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

async function latestRelease(repo, env) {
  const headers = { 'User-Agent': 'aanah.fyi-download', Accept: 'application/vnd.github+json' };
  // Cloudflare 환경 변수에 GITHUB_TOKEN을 넣어 두면 GitHub API 요청 한도가 넉넉해진다(없어도 동작).
  if (env && env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/releases/latest`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const r = await res.json();
  const tag = r.tag_name;
  return {
    tag,
    version: String(tag || '').replace(/^v/i, ''),
    published: r.published_at || null,
    assets: (r.assets || []).filter(a => INSTALLER.test(a.name)).map(a => ({
      name: a.name,
      size: a.size,
      url: `/download/${repo}/${encodeURIComponent(tag)}/${encodeURIComponent(a.name)}`,
    })),
  };
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
    try {
      const res = json(await latestRelease(repo, env));
      waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    } catch (e) {
      return json({ error: '최신 버전을 확인하지 못했습니다.' }, 502, 60);
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
