// Reads public GitHub data and turns it into one trimmed payload.
// Shared by the Vercel function (api/gh.js) and the browser fallback (src/data.js).

export const USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const API = 'https://api.github.com';
const DAY = 86400000;
const WINDOW_DAYS = 90;

export class GhError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    Object.assign(this, extra);
  }
}

async function gh(path, { token, fetchImpl = fetch } = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetchImpl(API + path, { headers });
  } catch {
    throw new GhError('network');
  }
  if (res.status === 404) throw new GhError('not_found');
  if (res.status === 403 || res.status === 429) {
    throw new GhError('rate_limited', { reset: Number(res.headers.get('x-ratelimit-reset')) || 0 });
  }
  if (!res.ok) throw new GhError('upstream', { status: res.status });
  return res.json();
}

const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

export function buildPayload(user, repos, events, now = Date.now()) {
  const list = repos
    .filter((r) => !r.private)
    .map((r) => ({
      name: r.name,
      desc: r.description || '',
      lang: r.language || null,
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      size: r.size || 0,
      pushed: r.pushed_at,
      created: r.created_at,
      fork: !!r.fork,
      archived: !!r.archived,
      url: r.html_url,
    }))
    .sort((a, b) => new Date(b.pushed) - new Date(a.pushed));

  const own = list.filter((r) => !r.fork);
  const stars = own.reduce((n, r) => n + r.stars, 0);
  const forks = own.reduce((n, r) => n + r.forks, 0);

  // Language share: primary language of each own repo, weighted by repo size.
  const weights = new Map();
  for (const r of own) {
    if (!r.lang) continue;
    weights.set(r.lang, (weights.get(r.lang) || 0) + Math.max(r.size, 1));
  }
  const total = [...weights.values()].reduce((a, b) => a + b, 0) || 1;
  const sorted = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const langs = sorted.slice(0, 7).map(([name, w]) => ({ name, share: w / total }));
  const rest = sorted.slice(7).reduce((n, [, w]) => n + w, 0);
  if (rest) langs.push({ name: 'Other', share: rest / total });

  // Activity: public events per UTC day. GitHub keeps at most the latest 300 events, so for busy
  // accounts only a recent window is known. Days outside it are null, never zero.
  const today = Date.parse(dayKey(now));
  const capped = events.length >= 300;
  const oldest = events.reduce((m, e) => Math.min(m, Date.parse(e.created_at) || m), Infinity);
  const windowStart = capped && Number.isFinite(oldest) ? dayKey(oldest) : null;
  const counts = new Map();
  for (const e of events) {
    const t = Date.parse(e.created_at);
    if (!Number.isFinite(t)) continue;
    const n = e.type === 'PushEvent' ? Math.max(1, e.payload?.size ?? 1) : 1;
    counts.set(dayKey(t), (counts.get(dayKey(t)) || 0) + n);
  }
  const days = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = dayKey(today - i * DAY);
    days.push({ d, n: windowStart && d < windowStart ? null : counts.get(d) || 0 });
  }

  return {
    user: {
      login: user.login,
      name: user.name || user.login,
      avatar: user.avatar_url,
      bio: user.bio || '',
      followers: user.followers || 0,
      following: user.following || 0,
      publicRepos: user.public_repos || 0,
      createdAt: user.created_at,
      url: user.html_url,
      type: user.type,
    },
    repos: list,
    stats: {
      stars,
      forks,
      ownRepos: own.length,
      partial: (user.public_repos || 0) > repos.length,
      forkRepos: list.length - own.length,
      langs,
      windowStart: windowStart && windowStart >= days[0].d ? windowStart : null,
    },
    days,
  };
}

export async function loadProfile(login, opts = {}) {
  const user = await gh(`/users/${login}`, opts);
  const pages = Math.min(3, Math.max(1, Math.ceil((user.public_repos || 0) / 100)));
  const chunks = await Promise.all(
    Array.from({ length: pages }, (_, i) => gh(`/users/${login}/repos?per_page=100&sort=pushed&type=owner&page=${i + 1}`, opts)),
  );
  const repos = chunks.flat();
  const events = [];
  for (let page = 1; page <= 3; page++) {
    try {
      const chunk = await gh(`/users/${login}/events/public?per_page=100&page=${page}`, opts);
      events.push(...chunk);
      if (chunk.length < 100) break;
    } catch {
      break;
    }
  }
  return buildPayload(user, repos, events);
}
