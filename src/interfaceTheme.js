import { useSyncExternalStore } from 'react';

export const INTERFACE_THEME_KEY = 'inscape:interface-theme';
export const EDITOR_COLORS_KEY = 'inscape:editor-colors';
const modes = new Set(['dark', 'light']);
const colorNames = ['panel', 'workspace', 'accent'];
const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const emptyColors = () => ({ dark: {}, light: {} });

function readColors(value) {
  if (value === null) return emptyColors();
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Invalid editor colors');
  return Object.fromEntries([...modes].map(mode => [mode, Object.fromEntries(colorNames
    .filter(name => validColor(parsed[mode]?.[name])).map(name => [name, parsed[mode][name].toLowerCase()]))]));
}

// Pick whichever neutral ink gives the stronger contrast against a custom fill.
export function editorColorInk(color) {
  const channels = color.slice(1).match(/../g).map(hex => parseInt(hex, 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return luminance > .179 ? '#000000' : '#ffffff';
}

// Device preferences only: never serialized into a profile, draft or publication.
export function createInterfaceThemeStore({ storage, target, events } = {}) {
  const listeners = new Set();
  let snapshot = { mode: 'dark', error: null, colors: emptyColors(), colorError: null };
  const apply = () => {
    if (!target) return;
    target.dataset.interfaceTheme = snapshot.mode;
    const colors = snapshot.colors[snapshot.mode];
    const properties = { ...colors, ink: colors.panel && editorColorInk(colors.panel),
      'on-accent': colors.accent && editorColorInk(colors.accent) };
    for (const name of [...colorNames, 'ink', 'on-accent']) {
      if (properties[name]) target.style?.setProperty(`--editor-custom-${name}`, properties[name]);
      else target.style?.removeProperty(`--editor-custom-${name}`);
    }
  };
  const emit = () => { apply(); listeners.forEach(listener => listener()); };
  try {
    if (!storage) throw new Error('Storage unavailable');
    const stored = storage.getItem(INTERFACE_THEME_KEY);
    if (modes.has(stored)) snapshot.mode = stored;
  } catch { snapshot.error = 'Appearance could not be loaded on this device.'; }
  try {
    if (!storage) throw new Error('Storage unavailable');
    snapshot.colors = readColors(storage.getItem(EDITOR_COLORS_KEY));
  } catch { snapshot.colorError = 'Editor colors could not be loaded on this device. Reset colors to restore the defaults.'; }
  apply();
  const sync = event => {
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key === INTERFACE_THEME_KEY || event.key === null) {
      snapshot = { ...snapshot, mode: modes.has(event.newValue) ? event.newValue : 'dark', error: null };
    } else if (event.key !== EDITOR_COLORS_KEY) return;
    if (event.key === EDITOR_COLORS_KEY || event.key === null) {
      try { snapshot = { ...snapshot, colors: readColors(event.newValue), colorError: null }; }
      catch { snapshot = { ...snapshot, colorError: 'Editor colors from another window could not be loaded.' }; }
    }
    emit();
  };
  events?.addEventListener('storage', sync);
  const saveColors = colors => {
    let colorError = null;
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(EDITOR_COLORS_KEY, JSON.stringify(colors));
    } catch { colorError = 'Colors changed, but could not be saved on this device.'; }
    snapshot = { ...snapshot, colors, colorError }; emit();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    setMode(mode) {
      if (!modes.has(mode)) throw new TypeError('Choose Dark or Light.');
      let error = null;
      try { if (!storage) throw new Error('Storage unavailable'); storage.setItem(INTERFACE_THEME_KEY, mode); }
      catch { error = 'Appearance changed, but could not be saved on this device. Select it again to retry.'; }
      snapshot = { ...snapshot, mode, error }; emit();
    },
    setColor(name, value) {
      if (!colorNames.includes(name) || !validColor(value)) throw new TypeError('Choose a valid editor color.');
      saveColors({ ...snapshot.colors, [snapshot.mode]: { ...snapshot.colors[snapshot.mode], [name]: value.toLowerCase() } });
    },
    resetColors() { saveColors({ ...snapshot.colors, [snapshot.mode]: {} }); },
    retryColors() { saveColors(snapshot.colors); },
    dispose: () => { events?.removeEventListener('storage', sync); listeners.clear(); },
  };
}

let storage;
try { storage = globalThis.localStorage; } catch { /* The session still has a usable theme. */ }
export const interfaceTheme = createInterfaceThemeStore({ storage, target: globalThis.document?.documentElement, events: globalThis.window });
export function useInterfaceTheme() {
  return useSyncExternalStore(interfaceTheme.subscribe, interfaceTheme.getSnapshot, interfaceTheme.getSnapshot);
}
