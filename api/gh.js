import { USER_RE, GhError, loadProfile } from '../lib/gh.js';

const TTL = 5 * 60 * 1000;
const cache = new Map();

export default async function handler(req, res) {
  const login = String(req.query?.u ?? '').trim();
  if (!USER_RE.test(login)) {
    return res.status(400).json({ error: 'invalid_username' });
  }

  const key = login.toLowerCase();
  const hit = cache.get(key);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  if (hit && Date.now() - hit.at < TTL) return res.status(200).json(hit.data);

  try {
    const data = await loadProfile(login, { token: process.env.GITHUB_TOKEN });
    cache.set(key, { at: Date.now(), data });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return res.status(200).json(data);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    if (err instanceof GhError) {
      const status = err.code === 'not_found' ? 404 : err.code === 'rate_limited' ? 429 : 502;
      return res.status(status).json({ error: err.code, reset: err.reset || 0 });
    }
    return res.status(500).json({ error: 'server_error' });
  }
}
