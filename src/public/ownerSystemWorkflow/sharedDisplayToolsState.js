import { validInstrumentWindows } from './displayInstrumentState.js';
export const defaultSharedTools = () => ({ layers: false, metadata: false, windows: {} });
export function validSharedTools(value) {
  return value && Object.keys(value).every(key => ['layers', 'metadata', 'appearance', 'windows', 'targetId'].includes(key))
    && (value.targetId === undefined || value.targetId === null || typeof value.targetId === 'string')
    && (value.appearance === undefined || typeof value.appearance === 'boolean')
    && typeof value.layers === 'boolean' && typeof value.metadata === 'boolean' && validInstrumentWindows(value.windows, ['layers', 'metadata', 'appearance']);
}
export function restoreSharedTools(views = {}) {
  if (validSharedTools(views['workbench:tools'])) return views['workbench:tools'];
  return defaultSharedTools();
}
