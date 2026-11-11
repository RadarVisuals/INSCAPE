import { useSyncExternalStore } from 'react';

export const INTERFACE_THEME_KEY = 'inscape:interface-theme';
const modes = new Set(['dark', 'light']);

// One device preference, independent of profiles, authored content and portals.
export function createInterfaceThemeStore({ storage, target, events } = {}) {
  const listeners = new Set();
  let snapshot = { mode: 'dark', error: null };
  const apply = () => { if (target) target.dataset.interfaceTheme = snapshot.mode; };
  const emit = () => { apply(); listeners.forEach(listener => listener()); };
  try {
    if (!storage) throw new Error('Storage unavailable');
    const stored = storage.getItem(INTERFACE_THEME_KEY);
    if (modes.has(stored)) snapshot = { mode: stored, error: null };
  } catch { snapshot = { ...snapshot, error: 'Appearance could not be loaded on this device.' }; }
  apply();
  const sync = event => {
    if (event.key !== INTERFACE_THEME_KEY && event.key !== null) return;
    snapshot = { mode: modes.has(event.newValue) ? event.newValue : 'dark', error: null }; emit();
  };
  events?.addEventListener('storage', sync);
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    setMode(mode) {
      if (!modes.has(mode)) throw new TypeError('Choose Dark or Light.');
      let error = null;
      try { if (!storage) throw new Error('Storage unavailable'); storage.setItem(INTERFACE_THEME_KEY, mode); }
      catch { error = 'Appearance changed, but could not be saved on this device. Select it again to retry.'; }
      snapshot = { mode, error }; emit();
    },
    dispose: () => { events?.removeEventListener('storage', sync); listeners.clear(); },
  };
}

let storage;
try { storage = globalThis.localStorage; } catch { /* The session still has a usable theme. */ }
export const interfaceTheme = createInterfaceThemeStore({ storage, target: globalThis.document?.documentElement, events: globalThis.window });
export function useInterfaceTheme() {
  return useSyncExternalStore(interfaceTheme.subscribe, interfaceTheme.getSnapshot, interfaceTheme.getSnapshot);
}
