import { useSyncExternalStore } from 'react';

export const INTERFACE_THEME_KEY = 'inscape:interface-theme';
export const INTERFACE_PALETTE_KEY = 'inscape:interface-palette';
export const interfacePalettes = Object.freeze({
  charcoal: 'Charcoal',
  oxblood: 'Oxblood',
  saffron: 'Saffron',
  'storm-glass': 'Storm Glass',
  'brass-ink': 'Brass & Ink',
});
const preferences = {
  mode: { key: INTERFACE_THEME_KEY, fallback: 'dark', valid: value => ['dark', 'light'].includes(value) },
  palette: { key: INTERFACE_PALETTE_KEY, fallback: 'charcoal', valid: value => Object.hasOwn(interfacePalettes, value) },
};

// Interface preferences belong to the device, independently of the artwork or profile.
export function createInterfaceThemeStore({ storage, target, events } = {}) {
  const listeners = new Set();
  const errors = {};
  let snapshot = { mode: 'dark', palette: 'charcoal', error: null };
  function refresh() {
    snapshot = { ...snapshot, error: errors.mode || errors.palette || null };
    if (target) {
      target.dataset.interfaceTheme = snapshot.mode;
      target.dataset.palette = snapshot.palette;
    }
    listeners.forEach(listener => listener());
  }
  for (const [name, pref] of Object.entries(preferences)) {
    try {
      const stored = storage.getItem(pref.key);
      if (pref.valid(stored)) snapshot[name] = stored;
    } catch { errors[name] = 'Appearance could not be loaded on this device.'; }
  }
  refresh();
  function sync(event) {
    if (event.storageArea && event.storageArea !== storage) return;
    const entries = Object.entries(preferences).filter(([, pref]) => event.key === null || event.key === pref.key);
    if (!entries.length) return;
    for (const [name, pref] of entries) {
      snapshot = { ...snapshot, [name]: pref.valid(event.newValue) ? event.newValue : pref.fallback };
      delete errors[name];
    }
    refresh();
  }
  events?.addEventListener('storage', sync);
  function save(name, value) {
    try {
      storage.setItem(preferences[name].key, value);
      delete errors[name];
    } catch { errors[name] = 'Appearance changed, but could not be saved on this device. Select it again to retry.'; }
    snapshot = { ...snapshot, [name]: value };
    refresh();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    setMode(mode) {
      if (!preferences.mode.valid(mode)) throw new TypeError('Choose Dark or Light.');
      save('mode', mode);
    },
    setPalette(palette) {
      if (!preferences.palette.valid(palette)) throw new TypeError('Choose an Inscape palette.');
      save('palette', palette);
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
