// Shared persistence mechanics for the two existing, separately keyed preference
// records. Their callers own the format, defaults and allowed changes.
export function createLocalPreferencesStore({ key, storage, initial, decode, encode = JSON.stringify,
  canSave = () => true, delay = 120, label = 'editor', initializeMissing = false }) {
  const listeners = new Set();
  let value = initial, baseline = null, dirty = false, blocked = false, timer = null, disposed = false, error = null;
  try {
    if (!storage?.getItem) throw Error('Unavailable storage');
    baseline = storage.getItem(key) ?? null;
    if (baseline !== null) {
      if (baseline.length > 64000) throw Error('Too large');
      value = decode(baseline);
    } else dirty = initializeMissing;
  } catch { blocked = true; error = `Your saved ${label} preferences could not be read. Their stored copy has been kept.`; }
  const notify = () => listeners.forEach(listener => listener());
  const report = message => { if (error !== message) { error = message; notify(); } };
  const flush = (replace = false) => {
    clearTimeout(timer); timer = null;
    if (disposed || blocked && !replace) return false;
    if (!dirty && !replace) return true;
    if (!canSave()) { report(`Your ${label} preferences could not be saved because this editor no longer has write access.`); return false; }
    try {
      if (!storage?.setItem) throw Error('Unavailable storage');
      if (!replace && (storage.getItem(key) ?? null) !== baseline) {
        blocked = true; report(`Your ${label} preferences changed in another window. Your current settings are still open.`); return false;
      }
      const serialized = encode(value);
      if (serialized.length > 64000) throw Error('Preferences too large');
      storage.setItem(key, serialized); baseline = serialized; dirty = false; blocked = false; report(null); return true;
    } catch { report(`Your ${label} preferences could not be saved. Keep this window open and retry.`); return false; }
  };
  return {
    getSnapshot: () => value, getError: () => error,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(change) {
      if (disposed) return;
      const next = typeof change === 'function' ? change(value) : change;
      if (JSON.stringify(next) === JSON.stringify(value)) return;
      value = next; dirty = true; notify();
      clearTimeout(timer);
      if (delay === 0) flush(); else timer = setTimeout(() => flush(), delay);
    },
    flush, retry: () => flush(true),
    resume() { disposed = false; },
    dispose() { flush(); clearTimeout(timer); disposed = true; listeners.clear(); },
  };
}
