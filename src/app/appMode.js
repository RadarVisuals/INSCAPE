export const APPLICATION_MODES = Object.freeze({
  PUBLIC: 'public',
  ATELIER: 'atelier'
});

export function resolveApplicationMode(locationLike = {}) {
  const search = typeof locationLike === 'string'
    ? new URL(locationLike, 'https://underneath.local').search
    : locationLike.search ?? '';
  const requestedMode = new URLSearchParams(search).get('mode');

  return requestedMode === APPLICATION_MODES.ATELIER
    ? APPLICATION_MODES.ATELIER
    : APPLICATION_MODES.PUBLIC;
}

export function createApplicationModeUrl(locationLike, mode) {
  const url = new URL(
    typeof locationLike === 'string' ? locationLike : locationLike.href,
    'https://underneath.local'
  );

  if (mode === APPLICATION_MODES.ATELIER) {
    url.searchParams.set('mode', APPLICATION_MODES.ATELIER);
  } else {
    url.searchParams.delete('mode');
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
