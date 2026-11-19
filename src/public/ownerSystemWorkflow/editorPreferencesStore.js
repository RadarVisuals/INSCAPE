import { isRecord } from '../../recordValidation.js';
import { createLocalPreferencesStore } from './localPreferencesStore.js';
import { createToolDockLayout, changeToolDock, integrateLibraryDockLayout, toolIsVisible, validToolDockLayout, validToolFrame } from './workbenchToolDockState.js';
import { defaultBrowserPreferences, validBrowserPreferences } from '../../lattice/browser/browserPreferences.js';
import { emptySideDock, validSideDock } from './workbenchSideDockState.js';

export const editorPreferencesKey = profile => `inscape:editor-preferences:v1:${profile.toLowerCase()}`;
const position = value => value === null || Boolean(value && ['left', 'top'].every(key => Number.isFinite(value[key]) && Math.abs(value[key]) <= 100000)
  && (value.width === undefined && value.height === undefined || validToolFrame(value)));
const positions = value => isRecord(value) && Object.keys(value).length <= 16
  && Object.entries(value).every(([id, frame]) => id.length <= 128 && position(frame));
const validators = {
  lastShape: value => value == null || ['shape', 'shape-grid'].includes(value),
  lastCanvasId: value => value == null || typeof value === 'string' && value.length <= 128,
  creationBar: value => value == null || typeof value === 'boolean',
  colourPickers: value => value == null || Array.isArray(value) && value.length <= 16 && value.every(label => typeof label === 'string' && label.length <= 40) && new Set(value).size === value.length,
  library: validBrowserPreferences, docks: validToolDockLayout,
  textOpen: value => value === null || typeof value === 'boolean',
  navigator: position, keeper: positions,
  sideDock: validSideDock,
};
const defaults = width => {
  const docks = createToolDockLayout(width);
  const [layers, inspector] = docks.groups;
  const sideDock = docks.hidden.includes('Layers') ? emptySideDock() : {
    leftWidth: layers.frame.width, width: inspector.frame.width,
    items: [
      { id: `tools:${layers.id}`, side: 'left', height: layers.frame.height },
      { id: 'Navigator', side: 'left', height: 120 },
      { id: `tools:${inspector.id}`, side: 'right', height: inspector.frame.height },
    ],
  };
  return { lastShape: null, lastCanvasId: null, creationBar: true, colourPickers: [], library: defaultBrowserPreferences(), docks,
    textOpen: null, navigator: null, keeper: {}, sideDock };
};

// One profile-local owner for editor preferences. No composition content or camera
// state is stored here. Sections expose stable snapshots to their actual controls.
export function createEditorPreferencesStore({ profile, storage, canSave = () => true, width = 1440, delay = 120 }) {
  const sections = new Map();
  const record = createLocalPreferencesStore({ key: editorPreferencesKey(profile), storage, canSave, delay,
    initial: defaults(width), encode: value => JSON.stringify({ version: 1, value: { ...value, docks: { ...value.docks, focusRequest: undefined } } }),
    decode(serialized) {
      const saved = JSON.parse(serialized);
      if (saved.version !== 1 || !saved.value) throw Error('Invalid preferences');
      const docks = integrateLibraryDockLayout(saved.value.docks, saved.value.libraryWindow);
      if (!docks || Object.keys(validators).some(name => name !== 'docks' && !validators[name](saved.value[name]))) throw Error('Invalid preferences');
      const value = Object.fromEntries(Object.keys(validators).map(name => [name, saved.value[name]]));
      const libraryGroup = docks.groups.find(group => group.panes.some(pane => pane.tabs.includes('Library')));
      const sideDock = value.sideDock ? { ...value.sideDock, items: value.sideDock.items.map(item => docks !== saved.value.docks && item.id === 'Library'
        ? { ...item, id: `tools:${libraryGroup.id}` } : item).filter((item, index, items) => items.findIndex(other => other.id === item.id) === index) } : emptySideDock();
      return { ...value, lastShape: value.lastShape ?? null, lastCanvasId: value.lastCanvasId ?? null,
        colourPickers: value.colourPickers ?? [], sideDock, creationBar: value.creationBar ?? true, docks: { ...docks, activeGroup: null, focusRequest: undefined } };
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
      layersVisible: () => toolIsVisible(getSnapshot().docks, 'Layers'), libraryVisible: () => toolIsVisible(getSnapshot().docks, 'Library'), infoVisible: () => toolIsVisible(getSnapshot().docks, 'Inspector'),
      change: action => update('docks', layout => changeToolDock(layout, action)) },
  };
}
