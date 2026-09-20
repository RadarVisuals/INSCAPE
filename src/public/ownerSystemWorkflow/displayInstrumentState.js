export const initialDisplayInstruments = Object.freeze({
  active: null, layers: 'closed', metadata: 'closed',
});

export function validDisplayInstruments(value) {
  return value && Object.keys(value).length === 3 && [null, 'layers', 'metadata'].includes(value.active)
    && ['attached', 'detached', 'closed'].includes(value.layers) && ['attached', 'detached', 'closed'].includes(value.metadata);
}

// Older attached settings are read as independent windows; authored data is unchanged.
export function normalizeDisplayInstruments(value) {
  const state = validDisplayInstruments(value) ? value : initialDisplayInstruments;
  return { active: null, layers: state.active === 'layers' || state.layers === 'detached' ? 'detached' : 'closed',
    metadata: state.active === 'metadata' || state.metadata === 'detached' ? 'detached' : 'closed' };
}
export function transitionDisplayInstruments(value, { type, instrument }) {
  if (!['layers', 'metadata'].includes(instrument)) return value;
  const state = normalizeDisplayInstruments(value);
  if (type === 'close' || type === 'toggle' && state[instrument] === 'detached') return { ...state, [instrument]: 'closed' };
  if (['toggle', 'open', 'attach', 'detach'].includes(type)) return { ...state, [instrument]: 'detached' };
  return state;
}
export function validInstrumentWindows(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([id, rect]) => ['layers', 'metadata'].includes(id) && rect
      && Object.keys(rect).length === 4 && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(rect[key]))
      && rect.width >= 240 && rect.height >= 180 && rect.width <= 10000 && rect.height <= 10000
      && Math.abs(rect.left) <= 10000 && Math.abs(rect.top) <= 10000);
}
