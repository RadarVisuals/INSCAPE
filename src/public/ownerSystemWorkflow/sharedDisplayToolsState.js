import { normalizeDisplayInstruments, validInstrumentWindows } from './displayInstrumentState.js';
export const defaultSharedTools = () => ({ layers: false, metadata: false, windows: {} });
export function validSharedTools(value) {
  return value && Object.keys(value).every(key => ['layers', 'metadata', 'windows', 'targetId'].includes(key))
    && (value.targetId === undefined || value.targetId === null || typeof value.targetId === 'string')
    && typeof value.layers === 'boolean' && typeof value.metadata === 'boolean' && validInstrumentWindows(value.windows);
}
export function restoreSharedTools(views = {}) {
  if (validSharedTools(views['workbench:tools'])) return views['workbench:tools'];
  const result = defaultSharedTools();
  for (const view of Object.values(views)) {
    const state = normalizeDisplayInstruments(view?.instruments);
    for (const id of ['layers', 'metadata']) {
      result[id] ||= state[id] === 'detached';
      if (!result.windows[id] && validInstrumentWindows(view?.instrumentWindows)) result.windows[id] = view.instrumentWindows[id];
    }
  }
  for (const id of ['layers', 'metadata']) if (!result.windows[id]) delete result.windows[id];
  return result;
}
