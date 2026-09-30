import { USER_RE, GhError, loadProfile } from '../lib/gh.js';

export { USER_RE };

// Prefers the serverless endpoint (edge cached, optional token). Falls back to
// calling the public GitHub API straight from the browser when it is unavailable.
export async function fetchProfile(login) {
  let res;
  try {
    res = await fetch(`/api/gh?u=${encodeURIComponent(login)}`, { headers: { Accept: 'application/json' } });
  } catch {
    res = null;
  }
  const isJson = res && (res.headers.get('content-type') || '').includes('application/json');
  if (res && isJson) {
    const body = await res.json();
    if (res.ok) return body;
    throw new GhError(body.error || 'upstream', { reset: body.reset || 0 });
  }
  return loadProfile(login);
}
