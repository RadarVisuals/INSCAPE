import { normalizeProfileAddress } from '../library/config.js';
import { resolveOwnerAuthoringEnabled } from '../public/publicAccess.js';

// Route intent is independent of permission. A profile URL can render either
// its public publication or its authorized Workbench; the URL grants no rights.
export function readApplicationRoute(locationLike, historyState = null) {
  const params = new URLSearchParams(locationLike?.search || '');
  if (params.has('discover')) {
    const saved = historyState?.inscapeReturnRoute;
    const address = normalizeProfileAddress(saved?.address);
    const returnTo = saved?.kind === 'profile' && address ? { kind: 'profile', address }
      : saved?.kind === 'home' ? { kind: 'home', fallbackAddress: normalizeProfileAddress(saved.fallbackAddress) } : null;
    return { kind: 'discover', returnTo };
  }
  const address = normalizeProfileAddress(params.get('view'));
  return address ? { kind: 'profile', address }
    : { kind: 'home', fallbackAddress: normalizeProfileAddress(params.get('profile')) };
}

export function applicationRouteUrl(locationLike, route) {
  const url = new URL(locationLike.href);
  for (const key of ['view', 'profile', 'discover']) url.searchParams.delete(key);
  if (route.kind === 'discover') url.searchParams.set('discover', '');
  if (route.kind === 'profile') url.searchParams.set('view', route.address);
  if (route.kind === 'home' && route.fallbackAddress) url.searchParams.set('profile', route.fallbackAddress);
  return url.pathname + url.search + url.hash;
}

export function resolveApplicationDestination(route, authority) {
  if (route.kind === 'discover') return { kind: 'discover', address: null };
  const connected = normalizeProfileAddress(authority.profileAddress);
  const settled = authority.status === 'complete';
  if (route.kind === 'home' && !settled) return {
    kind: connected || route.fallbackAddress ? 'pending' : 'entry', address: null,
  };
  const address = route.kind === 'profile' ? normalizeProfileAddress(route.address)
    : connected || route.fallbackAddress;
  if (!address) return { kind: 'entry', address: null };
  const owner = settled && resolveOwnerAuthoringEnabled({
    ownershipVerified: authority.ownershipVerified, verifiedOwnerProfileAddress: connected,
    workspaceProfileAddress: connected, viewedProfileAddress: address,
  });
  return { kind: owner ? 'workbench' : 'public', address };
}

export function disconnectRoute(route, destination) {
  // Discover loses its private return destination when the session ends.
  return destination.kind === 'workbench'
    ? { kind: 'discover', returnTo: null } : route;
}
