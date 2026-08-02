export const MODUL8R_MODULE_ORDER = Object.freeze(['library', 'activity', 'people', 'layers']);

export const MODUL8R_MODULE_LABELS = Object.freeze({
  activity: 'ACTIVITY',
  layers: 'LAYERS',
  library: 'LIBRARY',
  people: 'PEOPLE',
});

export const DEFAULT_MODUL8R_OPEN_MODULE = 'library';

export function isModul8rModuleId(value) {
  return MODUL8R_MODULE_ORDER.includes(value);
}

export function createModul8rShellState({
  masterExpanded = true,
  openModule = DEFAULT_MODUL8R_OPEN_MODULE,
} = {}) {
  if (openModule !== null && !isModul8rModuleId(openModule)) {
    throw new TypeError(`Unknown MODUL-8R module: ${String(openModule)}`);
  }
  return Object.freeze({ masterExpanded: Boolean(masterExpanded), openModule });
}

export function toggleModul8rMaster(state) {
  return createModul8rShellState({
    masterExpanded: !state.masterExpanded,
    openModule: state.openModule,
  });
}

export function toggleModul8rModule(state, moduleId) {
  if (!isModul8rModuleId(moduleId)) return state;
  return createModul8rShellState({
    masterExpanded: state.masterExpanded,
    openModule: state.openModule === moduleId ? null : moduleId,
  });
}
