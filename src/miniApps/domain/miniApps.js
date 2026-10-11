export const MAX_MINI_APPS = 4;
export const MINI_APP_ID = /^miniapp:[A-Za-z0-9_-]{1,80}$/u;
const loopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

// Only declarative web destinations are saved. Loopback is a private draft aid;
// it must never become a visitor's localhost URL in a published document.
export function miniAppUrl(value, { published = false, hostOrigin, allowLocal = true } = {}) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.origin === hostOrigin) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback(url.hostname) && !published)) return null;
    if ((published || !allowLocal) && loopback(url.hostname)) return null;
    return url;
  } catch { return null; }
}

export function validMiniApps(items, published = false) {
  if (!Array.isArray(items) || items.length > MAX_MINI_APPS) return false;
  const ids = new Set();
  const keys = ['id', 'name', 'url', ...(!published ? ['visibility'] : [])];
  return items.every(item => {
    if (!item || Object.keys(item).length !== keys.length || !keys.every(key => Object.hasOwn(item, key))
      || !MINI_APP_ID.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(item.name)
      || !(item.url === '' && !published) && !miniAppUrl(item.url, { published })
      || !published && !['PRIVATE', 'PUBLIC'].includes(item.visibility)) return false;
    ids.add(item.id); return true;
  });
}

export function projectMiniApps(items) {
  const result = items.filter(item => item.visibility === 'PUBLIC').map(({ visibility, ...item }) => ({ ...item }));
  if (!validMiniApps(result, true)) throw new TypeError('Each public mini app needs a public HTTPS URL.');
  return result;
}

export function restoreMiniApps(published = [], local = []) {
  // A previous publication without mini apps must not erase local additions.
  // If combining both exceeds the bound, validation rejects the restore in full.
  return [...published.map(item => ({ ...item, visibility: 'PUBLIC' })),
    ...local.filter(item => !published.some(other => other.id === item.id)).map(item => ({ ...item, visibility: 'PRIVATE' }))];
}
