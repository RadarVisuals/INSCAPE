// Used only by development error boundaries. Production evidence keeps enums.
export function developmentErrorDetails(error) {
  const clean = text => text
    .replace(/(?:https?|file):\/\/[^\s)]+/giu, url => {
      const source = url.split(/[?#]/u)[0].split('/').at(-1);
      const line = url.match(/:\d+(?::\d+)?$/u)?.[0] || '';
      return /\.(?:[cm]?js|jsx|tsx?)(?::\d+){0,2}$/iu.test(source) ? source + (source.endsWith(line) ? '' : line) : '[url omitted]';
    })
    .replace(/0x[0-9a-f]{40,}/giu, '[hex omitted]')
    .replace(/\b(?:authorization|token|secret|jwt|signature|calldata|password|api[_-]?key)\s*[:=]\s*\S+/giu, '[private value omitted]');
  const message = typeof error?.message === 'string' ? clean(error.message).slice(0, 600) : 'Error details unavailable';
  const stack = typeof error?.stack === 'string' ? error.stack.split('\n').slice(1, 7).map(line => clean(line).slice(0, 220)).join('\n') : '';
  return [message, stack].filter(Boolean).join('\n');
}
