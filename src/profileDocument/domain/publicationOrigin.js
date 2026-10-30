// Only exact loopback origins are development clients, never arbitrary HTTP
// hosts, LAN addresses, lookalike domains or origins containing a path.
export function isLocalPublicationOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin === value && ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}
