import { normalizeProfileAddress } from '../library/config.js';

export function resolveViewedProfile(locationLike, connectedProfileAddress) {
  const connected = normalizeProfileAddress(connectedProfileAddress);
  try { return normalizeProfileAddress(new URLSearchParams(locationLike?.search || '').get('view')) || connected; }
  catch { return connected; }
}

export function createViewedProfileUrl(locationLike, address, connectedProfileAddress) {
  const url = new URL(locationLike?.href || String(locationLike), globalThis.location?.origin || 'http://localhost');
  const viewed = normalizeProfileAddress(address); const connected = normalizeProfileAddress(connectedProfileAddress);
  if (!viewed || viewed === connected) url.searchParams.delete('view'); else url.searchParams.set('view', viewed);
  return `${url.pathname}${url.search}${url.hash}`;
}
