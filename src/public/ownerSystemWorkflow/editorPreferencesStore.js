import { createLocalPreferencesStore } from './localPreferencesStore.js';
import { createToolDockLayout, changeToolDock, toolIsVisible, validToolDockLayout, validToolFrame } from './workbenchToolDockState.js';
import { defaultBrowserPreferences, validBrowserPreferences } from '../../lattice/browser/browserPreferences.js';

export const editorPreferencesKey = profile => `inscape:editor-preferences:v1:${profile.toLowerCase()}`;
const position = value => value === null || Boolean(value && ['left', 'top'].every(key => Number.isFinite(value[key]) && Math.abs(value[key]) <= 100000));
const positions = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 16
  && Object.entries(value).every(([id, frame]) => id.length <= 128 && position(frame));
const validators = {
  library: validBrowserPreferences, docks: validToolDockLayout, textFrame: value => value === null || validToolFrame(value),
  textOpen: value => value === null || typeof value === 'boolean', textSection: value => ['format', 'article'].includes(value),
  navigator: position, keeper: positions, sidebar: value => value === null || typeof value === 'boolean',
};
const defaults = width => ({ library: defaultBrowserPreferences(), docks: createToolDockLayout(width),
  textFrame: null, textOpen: null, textSection: 'format', navigator: null, keeper: {}, sidebar: null });

// One profile-local owner for editor preferences. No composition content or camera
// state is stored here. Sections expose stable snapshots to their actual controls.
export function createEditorPreferencesStore({ profile, storage, canSave = () => true, width = 1440, delay = 120 }) {
  const sections = new Map();
  const record = createLocalPreferencesStore({ key: editorPreferencesKey(profile), storage, canSave, delay,
    initial: defaults(width), encode: value => JSON.stringify({ version: 1, value }),
    decode(serialized) {
      const saved = JSON.parse(serialized);
      if (saved.version !== 1 || !saved.value || Object.keys(validators).some(name => !validators[name](saved.value[name]))) throw Error('Invalid preferences');
      const value = Object.fromEntries(Object.keys(validators).map(name => [name, saved.value[name]]));
      return { ...value, docks: { ...value.docks, activeGroup: null } };
    },
  });
  const { subscribe, getSnapshot } = record;
  const update = (name, change) => record.update(value => {
    const next = typeof change === 'function' ? change(value[name]) : change;
    return validators[name]?.(next) ? { ...value, [name]: next } : value;
  });
  return {
    ...record, update,
    section(name) {
      if (!sections.has(name)) sections.set(name, { subscribe, getSnapshot: () => getSnapshot()[name], update: change => update(name, change) });
      return sections.get(name);
    },
    ref(name) { return { get current() { return getSnapshot()[name]; }, set current(next) { update(name, next); } }; },
    tools: { subscribe, getSnapshot: () => getSnapshot().docks,
      layersVisible: () => toolIsVisible(getSnapshot().docks, 'Layers'), infoVisible: () => toolIsVisible(getSnapshot().docks, 'Info'),
      change: action => update('docks', layout => changeToolDock(layout, action)) },
  };
}
