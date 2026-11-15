// 웹 도구들의 '마지막 업데이트 날짜'와 '버전'을 GitHub에서 읽어 내준다.
//
//   /api/updated   →  { "omr": { "updated": "2026-11-01", "version": "2.3.5" }, ... }   (1시간 캐시)
//
// 한 레포에 도구가 여러 개 있는 경우(forClass)가 있어서, 도구마다 자기 파일이 마지막으로 바뀐 날짜를 쓴다.
// 레포의 커밋 Atom 피드(github.com/.../commits/<브랜치>/<파일>.atom)를 읽기 때문에 GitHub API 횟수 제한에 걸리지 않는다.
// 새 웹 도구를 추가하면 TOOLS에 index.html의 id와 같은 이름으로 한 줄 추가하면 된다.
// paths를 비워 두면 레포 전체의 마지막 커밋 날짜를 쓴다.
//
// 버전: 도구 HTML <head>의 <meta name="aanah:version" content="X.Y.Z">를 읽는다(모든 레포 공통 규칙).
//       page에 적은 파일, 없으면 paths의 첫 파일, 그것도 없으면 index.html에서 찾는다.
//       meta가 없으면 legacy 정규식(예전 화면 버전 표시)으로 한 번 더 찾고, 둘 다 없으면 버전은 비워 둔다.

const OWNER = 'RamzThunder';
const TOOLS = {
  forclass: { repo: 'forClass', paths: ['index.html', 'shared-roster.js', 'roster-manager.js', 'google-drive-sync.js'] },
  omr: { repo: 'forClass', paths: ['omr-grader.html'], legacy: /id="appVersionText">v(\d+(?:\.\d+)+)</ },
  writing: { repo: 'forClass', paths: ['argument-writing-grader.html'] },
  speaking: { repo: 'forClass', paths: ['logical-speaking-grader.html'], legacy: /id="appVersion">v(\d+(?:\.\d+)+)</ },
  roulette: { repo: 'forClass', paths: ['논리적인 말하기 수행평가 돌려돌려돌림판.html'] },
  escape: { repo: 'gugeo', paths: [], page: 'index.html' },
  jjirashy: { repo: 'jjirashy', paths: ['jjirasi_sticker_maker.html'], legacy: /class="ver">v(\d+(?:\.\d+)+)</ },
};
const BRANCH = 'main';
const HOUR = 3600;
const META = /<meta\s+name=["']aanah:version["']\s+content=["']v?(\d+(?:\.\d+)+)["']/i;
const UA = { 'User-Agent': 'aanah.fyi-updated' };

const json = (body, maxAge = HOUR) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
});

// 피드에서 가장 최근 커밋 시각(첫 번째 <entry>의 <updated>)을 읽는다.
async function lastCommit(repo, path) {
  const file = path ? '/' + path.split('/').map(encodeURIComponent).join('/') : '';
  const res = await fetch(`https://github.com/${OWNER}/${repo}/commits/${BRANCH}${file}.atom`, { headers: UA });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const xml = await res.text();
  const m = xml.match(/<entry>[\s\S]*?<updated>([^<]+)<\/updated>/);
  if (!m) throw new Error('no commits');
  return Date.parse(m[1]);
}

async function readVersion(repo, path, legacy) {
  const file = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`https://raw.githubusercontent.com/${OWNER}/${repo}/${BRANCH}/${file}`, { headers: UA });
  if (!res.ok) throw new Error(`raw ${res.status}`);
  const html = await res.text();
  const m = html.match(META) || (legacy && html.match(legacy));
  return m ? m[1] : null;
}

// 학교 기준으로 날짜가 바뀌도록 한국 시간(UTC+9)으로 날짜를 만든다.
const kstDate = t => new Date(t + 9 * HOUR * 1000).toISOString().slice(0, 10);

async function collect() {
  const jobs = new Map(); // 같은 파일을 두 번 읽지 않게 한다.
  const one = (repo, path) => {
    const key = `${repo}/${path}`;
    if (!jobs.has(key)) jobs.set(key, lastCommit(repo, path).catch(() => NaN));
    return jobs.get(key);
  };
  const out = {};
  await Promise.all(Object.entries(TOOLS).map(async ([id, { repo, paths, page, legacy }]) => {
    const [times, ver] = await Promise.all([
      Promise.all((paths.length ? paths : ['']).map(p => one(repo, p))),
      readVersion(repo, page || paths[0] || 'index.html', legacy).catch(() => null),
    ]);
    const latest = Math.max(...times.filter(Number.isFinite));
    const item = {};
    if (Number.isFinite(latest)) item.updated = kstDate(latest);
    if (ver) item.version = ver;
    if (Object.keys(item).length) out[id] = item;
  }));
  return out;
}

export async function onRequest({ request, waitUntil }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const cache = caches.default;
  const url = new URL(request.url);
  const cacheKey = new Request(url.origin + url.pathname + '?v=2', { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  // 마지막으로 성공한 결과를 일주일 동안 따로 보관해 두고, GitHub를 못 읽을 때 빈 자리를 채운다.
  // (보관 키는 응답 모양이 바뀌면 v 숫자를 올린다)
  const staleKey = new Request(cacheKey.url + '&stale=1', { method: 'GET' });
  const fresh = await collect();
  const staleRes = await cache.match(staleKey);
  const stale = staleRes ? await staleRes.json().catch(() => ({})) : {};
  const data = {};
  for (const id of Object.keys(TOOLS)) {
    const item = { ...(stale[id] && typeof stale[id] === 'object' ? stale[id] : {}), ...fresh[id] };
    if (Object.keys(item).length) data[id] = item;
  }
  const complete = Object.keys(TOOLS).every(id => fresh[id] && fresh[id].updated);

  const res = json(data, complete ? HOUR : 60);
  const saves = [cache.put(cacheKey, res.clone())];
  if (Object.keys(fresh).length) saves.push(cache.put(staleKey, json(data, 7 * 86400)));
  waitUntil(Promise.all(saves));
  return res;
}
