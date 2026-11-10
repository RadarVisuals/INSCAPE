import { createLocalPreferencesStore } from './localPreferencesStore.js';
import { createToolDockLayout, changeToolDock, consolidateCurrentToolDockLayout, toolIsVisible, validToolDockLayout, validToolFrame } from './workbenchToolDockState.js';
import { defaultBrowserPreferences, validBrowserPreferences } from '../../lattice/browser/browserPreferences.js';
import { emptySideDock, validSideDock } from './workbenchSideDockState.js';

export const editorPreferencesKey = profile => `inscape:editor-preferences:v1:${profile.toLowerCase()}`;
const position = value => value === null || Boolean(value && ['left', 'top'].every(key => Number.isFinite(value[key]) && Math.abs(value[key]) <= 100000)
  && (value.width === undefined && value.height === undefined || validToolFrame(value)));
const positions = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 16
  && Object.entries(value).every(([id, frame]) => id.length <= 128 && position(frame));
const validators = {
  lastShape: value => value == null || ['shape', 'shape-grid'].includes(value),
  lastCanvasId: value => value == null || typeof value === 'string' && value.length <= 128,
  creationBar: value => value == null || typeof value === 'boolean',
  colourPickers: value => value == null || Array.isArray(value) && value.length <= 16 && value.every(label => typeof label === 'string' && label.length <= 40) && new Set(value).size === value.length,
  libraryWindow: value => value == null || Boolean(value && typeof value.detached === 'boolean' && validToolFrame(value.frame)),
  library: validBrowserPreferences, docks: validToolDockLayout,
  textOpen: value => value === null || typeof value === 'boolean',
  navigator: position, keeper: positions,
  sideDock: validSideDock,
};
const defaults = width => {
  const docks = createToolDockLayout(width);
  const [layers, inspector] = docks.groups;
  const sideDock = docks.hidden.length ? emptySideDock() : {
    leftWidth: layers.frame.width, width: inspector.frame.width,
    items: [
      { id: `tools:${layers.id}`, side: 'left', height: layers.frame.height },
      { id: 'Navigator', side: 'left', height: 120 },
      { id: `tools:${inspector.id}`, side: 'right', height: inspector.frame.height },
    ],
  };
  return { lastShape: null, lastCanvasId: null, creationBar: true, colourPickers: [], libraryWindow: null, library: defaultBrowserPreferences(), docks,
    textOpen: null, navigator: null, keeper: {}, sideDock };
};

// One profile-local owner for editor preferences. No composition content or camera
// state is stored here. Sections expose stable snapshots to their actual controls.
export function createEditorPreferencesStore({ profile, storage, canSave = () => true, width = 1440, delay = 120 }) {
  const sections = new Map();
  const record = createLocalPreferencesStore({ key: editorPreferencesKey(profile), storage, canSave, delay,
    initial: defaults(width), encode: value => JSON.stringify({ version: 1, value }),
    decode(serialized) {
      const saved = JSON.parse(serialized);
      if (saved.version !== 1 || !saved.value) throw Error('Invalid preferences');
      const docks = consolidateCurrentToolDockLayout(saved.value.docks);
      if (!docks || Object.keys(validators).some(name => name !== 'docks' && !validators[name](saved.value[name]))) throw Error('Invalid preferences');
      const value = Object.fromEntries(Object.keys(validators).map(name => [name, saved.value[name]]));
      return { ...value, lastShape: value.lastShape ?? null, lastCanvasId: value.lastCanvasId ?? null,
        colourPickers: value.colourPickers ?? [], sideDock: value.sideDock ?? emptySideDock(), creationBar: value.creationBar ?? true, docks: { ...docks, activeGroup: null } };
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
      layersVisible: () => toolIsVisible(getSnapshot().docks, 'Layers'), infoVisible: () => toolIsVisible(getSnapshot().docks, 'Inspector'),
      change: action => update('docks', layout => changeToolDock(layout, action)) },
  };
}
