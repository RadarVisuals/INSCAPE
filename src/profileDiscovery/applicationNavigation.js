import { normalizeProfileAddress } from '../library/config.js';
import { resolveOwnerAuthoringEnabled } from '../public/publicAccess.js';

function profileIntent(value) {
  if (value?.editor === 'studio') {
    if (value.workId === 'reception') return { editor: 'reception' };
    if (!value.workId) return { editor: 'studio', ...(value.newComposition === true && { newComposition: true }) };
    return profileIntent({ editor: 'canvas', workId: value.workId });
  }
  if (value?.editor === 'canvas') {
    return /^workbench:[A-Za-z0-9_-]{1,80}$/u.test(value.workId)
      ? { editor: 'canvas', workId: value.workId } : { canvas: true, reception: 'published' };
  }
  if (value?.editor === 'reception') return { editor: 'reception' };
  if (value?.writing) return { writing: true };
  return {
    ...(value?.canvas === true ? { canvas: true } : {}),
    ...((value?.reception === true || value?.reception === 'published') ? { reception: value.reception } : {}),
    ...(value?.target?.moduleId ? { target: { moduleId: String(value.target.moduleId).slice(0, 160),
      ...(value.target.gridId ? { gridId: String(value.target.gridId).slice(0, 160) } : {}) } } : {}),
  };
}

// Route intent is independent of permission. A profile URL can render either
// its public publication or its authorized Workbench; the URL grants no rights.
export function readApplicationRoute(locationLike, historyState = null) {
  const params = new URLSearchParams(locationLike?.search || '');
  if (params.has('discover')) {
    const saved = historyState?.inscapeReturnRoute;
    const address = normalizeProfileAddress(saved?.address);
    const returnTo = saved?.kind === 'profile' && address ? { kind: 'profile', address, ...profileIntent(saved) }
      : saved?.kind === 'home' ? { kind: 'home', fallbackAddress: normalizeProfileAddress(saved.fallbackAddress) } : null;
    return { kind: 'discover', returnTo };
  }
  const address = normalizeProfileAddress(params.get('view'));
  const gallery = params.get('tab') === 'gallery';
  return address ? { kind: 'profile', address, ...profileIntent({ editor: params.get('editor'), workId: params.get('work'),
    newComposition: params.get('new') === '1', writing: params.get('tab') === 'writing', canvas: gallery || params.get('canvas') === '1',
    reception: gallery || params.get('reception') === 'published' ? 'published' : params.get('reception') === '1',
    target: { moduleId: params.get('module'), gridId: params.get('grid') } }) }
    : { kind: 'home', fallbackAddress: normalizeProfileAddress(params.get('profile')) };
}

export function applicationRouteUrl(locationLike, route) {
  const url = new URL(locationLike.href);
  for (const key of ['view', 'profile', 'discover', 'canvas', 'module', 'grid', 'reception', 'editor', 'work', 'tab', 'new']) url.searchParams.delete(key);
  if (route.kind === 'discover') url.searchParams.set('discover', '');
  if (route.kind === 'profile') {
    url.searchParams.set('view', route.address);
    const intent = profileIntent(route);
    if (intent.editor) url.searchParams.set('editor', 'studio');
    if (intent.editor === 'reception') url.searchParams.set('work', 'reception');
    if (intent.writing) url.searchParams.set('tab', 'writing');
    if (intent.newComposition) url.searchParams.set('new', '1');
    if (intent.workId) url.searchParams.set('work', intent.workId);
    if (intent.canvas && intent.reception === 'published') url.searchParams.set('tab', 'gallery');
    else {
      if (intent.canvas) url.searchParams.set('canvas', '1');
      if (intent.reception) url.searchParams.set('reception', intent.reception === 'published' ? 'published' : '1');
    }
    if (intent.target) {
      url.searchParams.set('module', intent.target.moduleId);
      if (intent.target.gridId) url.searchParams.set('grid', intent.target.gridId);
    }
  }
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
  const intent = profileIntent(route);
  if (intent.writing) return { kind: 'public', address, writing: true };
  const works = intent.canvas && !intent.target;
  const ownerSurface = !intent.target && (!intent.reception || works && intent.reception !== 'published');
  const owner = ownerSurface && settled && resolveOwnerAuthoringEnabled({
    ownershipVerified: authority.ownershipVerified, verifiedOwnerProfileAddress: connected,
    workspaceProfileAddress: connected, viewedProfileAddress: address,
  });
  if (intent.editor === 'canvas') return owner ? { kind: 'workbench', address, worksEditorId: intent.workId }
    : { kind: 'public', address, reception: 'published', canvas: true };
  if (intent.editor === 'studio') return owner ? { kind: 'workbench', address, ...(intent.newComposition && { newComposition: true }) }
    : { kind: 'public', address, reception: 'published' };
  return { kind: owner ? 'workbench' : 'public', address,
    ...(owner ? intent.editor === 'reception' ? { receptionEditorRequested: true }
      : works ? { canvas: true } : {}
      : intent.editor === 'reception' ? { reception: true } : intent) };
}

// This is a return destination, never an authoring capability. Keep the origin
// when switching documents or visiting Discover over an open Studio.
export function studioOrigin(previous, address, saved) {
  if (previous?.kind === 'discover') return studioOrigin(previous.returnTo, address, saved);
  if (previous?.kind !== 'profile' || previous.address !== address) return 'Gallery';
  if (previous.editor) return saved === 'Profile' ? 'Profile' : 'Gallery';
  return previous.canvas || previous.writing ? 'Gallery' : 'Profile';
}

export function disconnectRoute(route, destination) {
  // Discover loses its private return destination when the session ends.
  return destination.kind === 'workbench'
    ? { kind: 'discover', returnTo: null } : route;
}
