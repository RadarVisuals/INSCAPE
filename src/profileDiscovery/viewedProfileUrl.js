import { normalizeProfileAddress } from '../library/config.js';

export function resolveExplicitViewedProfile(locationLike) {
  try { return normalizeProfileAddress(new URLSearchParams(locationLike?.search || '').get('view')); }
  catch { return null; }
}

export function resolveViewedProfile(locationLike, connectedProfileAddress) {
  const connected = normalizeProfileAddress(connectedProfileAddress);
  return resolveExplicitViewedProfile(locationLike) || connected;
}

export function createViewedProfileUrl(locationLike, address, connectedProfileAddress) {
  const url = new URL(locationLike?.href || String(locationLike), globalThis.location?.origin || 'http://localhost');
  const viewed = normalizeProfileAddress(address); const connected = normalizeProfileAddress(connectedProfileAddress);
  if (!viewed || viewed === connected) url.searchParams.delete('view'); else url.searchParams.set('view', viewed);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createSelectedProfileUrl(locationLike, address) {
  const url = new URL(locationLike?.href || String(locationLike), globalThis.location?.origin || 'http://localhost');
  const viewed = normalizeProfileAddress(address);
  if (viewed) url.searchParams.set('view', viewed); else url.searchParams.delete('view');
  return `${url.pathname}${url.search}${url.hash}`;
}
