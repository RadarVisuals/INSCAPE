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
  if (value?.curation) return { curation: true };
  if (value?.writing) return { writing: true };
  const moduleId = value?.target?.moduleId;
  return {
    ...(value?.canvas === true ? { canvas: true } : {}),
    ...((value?.reception === true || value?.reception === 'published') ? { reception: value.reception } : {}),
    ...(/^(text|image):./u.test(moduleId) ? { target: { moduleId: moduleId.slice(0, 160) } } : {}),
  };
}

// Route intent is independent of permission. A profile URL can render either
// its public publication or its authorized Workbench; the URL grants no rights.
export function readApplicationRoute(locationLike) {
  const params = new URLSearchParams(locationLike?.search || '');
  const address = normalizeProfileAddress(params.get('view'));
  const gallery = params.get('tab') === 'gallery';
  return address ? { kind: 'profile', address, ...profileIntent({ editor: params.get('editor'), workId: params.get('work'),
    newComposition: params.get('new') === '1', curation: params.get('tab') === 'curation', writing: params.get('tab') === 'writing', canvas: gallery || params.get('canvas') === '1',
    reception: gallery || params.get('reception') === 'published' ? 'published' : params.get('reception') === '1',
    target: { moduleId: params.get('module') } }) }
    : { kind: 'home' };
}

export function applicationRouteUrl(locationLike, route) {
  const url = new URL(locationLike.href);
  for (const key of ['view', 'profile', 'canvas', 'module', 'grid', 'reception', 'editor', 'work', 'tab', 'new']) url.searchParams.delete(key);
  if (route.kind === 'profile') {
    url.searchParams.set('view', route.address);
    const intent = profileIntent(route);
    if (intent.editor) url.searchParams.set('editor', 'studio');
    if (intent.editor === 'reception') url.searchParams.set('work', 'reception');
    if (intent.curation) url.searchParams.set('tab', 'curation');
    if (intent.writing) url.searchParams.set('tab', 'writing');
    if (intent.newComposition) url.searchParams.set('new', '1');
    if (intent.workId) url.searchParams.set('work', intent.workId);
    if (intent.canvas && intent.reception === 'published') url.searchParams.set('tab', 'gallery');
    else {
      if (intent.canvas) url.searchParams.set('canvas', '1');
      if (intent.reception) url.searchParams.set('reception', intent.reception === 'published' ? 'published' : '1');
    }
    if (intent.target) url.searchParams.set('module', intent.target.moduleId);
  }
  return url.pathname + url.search + url.hash;
}

export function resolveApplicationDestination(route, authority) {
  const connected = normalizeProfileAddress(authority.profileAddress);
  const settled = authority.status === 'complete';
  if (route.kind === 'home' && !settled) return {
    kind: connected ? 'pending' : 'entry', address: null,
  };
  const address = route.kind === 'profile' ? normalizeProfileAddress(route.address)
    : normalizeProfileAddress(authority.signedInAddress) || connected;
  if (!address) return { kind: 'entry', address: null };
  const intent = profileIntent(route);
  if (!Object.keys(intent).length) return { kind: 'public', address, reception: 'published' };
  if (intent.writing) return { kind: 'public', address, writing: true };
  const works = intent.canvas && !intent.target;
  const ownerSurface = !intent.target && (!intent.reception || works && intent.reception !== 'published');
  const owner = ownerSurface && settled && resolveOwnerAuthoringEnabled({
    ownershipVerified: authority.ownershipVerified, verifiedOwnerProfileAddress: connected,
    workspaceProfileAddress: connected, viewedProfileAddress: address,
  });
  if (intent.curation) return owner ? { kind: 'curation', address } : { kind: 'public', address, reception: 'published' };
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
// when switching documents in Studio.
export function studioOrigin(previous, address, saved) {
  if (previous?.kind === 'home') return 'Profile';
  if (previous?.kind !== 'profile' || previous.address !== address) return 'Gallery';
  if (previous.editor) return saved === 'Profile' ? 'Profile' : 'Gallery';
  return previous.canvas || previous.writing ? 'Gallery' : 'Profile';
}

export function disconnectRoute(route, destination, signedInAddress) {
  const ownProfile = destination.kind === 'public' && destination.address === normalizeProfileAddress(signedInAddress);
  if (route.kind === 'home' || ownProfile || ['workbench', 'curation'].includes(destination.kind)) {
    return { kind: 'home' };
  }
  return route;
}
