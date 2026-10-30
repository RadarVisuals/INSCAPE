import { normalizeProfileAddress } from '../library/config.js';

const held = new Map();
const requests = new Map();
export const profileEditorLockName = profile => `inscape:profile-editor:${normalizeProfileAddress(profile)}`;

// Browser locks coordinate tabs in the same origin/storage partition. They are
// not wallet authority and do not synchronize other browsers or devices.
export function acquireProfileEditor(profile, locks = globalThis.navigator?.locks) {
  const address = normalizeProfileAddress(profile);
  if (!address) throw new TypeError('A valid profile address is required');
  let release, settle;
  const record = { cancelled: false, finished: null };
  const existing = requests.get(address) || new Set();
  const releases = [...existing].filter(item => item.cancelled).map(item => item.finished);
  existing.add(record); requests.set(address, existing);
  const token = { beforeRelease: new Set() };
  const ready = new Promise(resolve => { settle = resolve; });
  const stop = () => {
    record.cancelled = true;
    if (held.get(address) === token) {
      // Pending local preferences must flush while their originating editor still owns the lease.
      for (const flush of token.beforeRelease) { try { flush(); } catch { /* Release must still complete. */ } }
      token.beforeRelease.clear(); held.delete(address);
    }
    release?.(); settle('released');
  };
  // Route changes may request again before the browser completes our previous
  // release. Await cancelled requests in this page, never a live editor or a
  // competing tab. React's effect remount must not report a false tab conflict.
  record.finished = Promise.resolve().then(async () => {
    await Promise.all(releases);
    if (record.cancelled) return;
    if (!locks?.request) { settle('unsupported'); return; }
    try {
      await locks.request(profileEditorLockName(address), { mode: 'exclusive', ifAvailable: true }, lock => {
        if (record.cancelled) return;
        if (!lock) { settle('busy'); return; }
        held.set(address, token);
        settle('editing');
        return new Promise(resolve => { release = resolve; });
      });
    } catch { settle('unavailable'); stop(); }
  }).finally(() => { existing.delete(record); if (!existing.size && requests.get(address) === existing) requests.delete(address); });
  return { ready, stop };
}

export function captureProfileDraftWriteAccess(profile, storage) {
  // Injected repositories remain independently owned (unit tests and fixtures).
  // Every production store uses the actual browser Storage object.
  try {
    if (typeof window === 'undefined' || storage !== window.localStorage) return () => true;
  } catch { return () => false; }
  const address = normalizeProfileAddress(profile), token = held.get(address);
  // A later editor for this profile must never reauthorize an old store.
  return () => Boolean(token) && held.get(address) === token;
}

export function beforeProfileEditorRelease(profile, callback) {
  const token = held.get(normalizeProfileAddress(profile));
  token?.beforeRelease.add(callback);
  return () => token?.beforeRelease.delete(callback);
}
