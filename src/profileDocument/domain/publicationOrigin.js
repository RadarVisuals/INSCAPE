export const DEVELOPMENT_PUBLICATION_SERVICE = 'https://deploy-preview-5--enterinscape.netlify.app';

export function localPublicationServiceOrigin(value = DEVELOPMENT_PUBLICATION_SERVICE) {
  const service = new URL(value);
  if (service.protocol !== 'https:' || service.origin !== value)
    throw new TypeError('The local publication service must be an HTTPS origin.');
  return service.origin;
}

// Only exact loopback origins are development clients, never arbitrary HTTP
// hosts, LAN addresses, lookalike domains or origins containing a path.
export function isLocalPublicationOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin === value && ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}
