const DEVELOPMENT_DIAGNOSTICS = typeof __DEVELOPMENT_DIAGNOSTICS__ !== 'undefined' && __DEVELOPMENT_DIAGNOSTICS__ === true;

export function installDevelopmentGlobal(name, value, target = globalThis.window, enabled = DEVELOPMENT_DIAGNOSTICS) {
  if (!enabled || !target) return false;
  target[name] = value;
  return true;
}

export function removeDevelopmentGlobal(name, value, target = globalThis.window, enabled = DEVELOPMENT_DIAGNOSTICS) {
  if (!enabled || !target || target[name] !== value) return false;
  delete target[name];
  return true;
}

export function developmentLog(...values) {
  if (DEVELOPMENT_DIAGNOSTICS) console.log(...values);
}

function boundedMessage(error) {
  const message = typeof error?.message === 'string' ? error.message.replace(/0x[0-9a-f]{16,}/giu, '[hex omitted]') : '';
  return message.slice(0, 160);
}

export function reportControlledError(code, error) {
  const message = boundedMessage(error);
  console.error(`[${code}]${message ? ` ${message}` : ''}`);
}

export { DEVELOPMENT_DIAGNOSTICS };
