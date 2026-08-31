import {
  SYSTEM_WORKFLOW_GUIDE_MODES,
  SYSTEM_WORKFLOW_SURFACE_IDS,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';

export const DEFAULT_WORKBENCH_PREFERENCES = Object.freeze({
  compositionLocked: false,
  gridColor: null,
  gridMode: 'LINES',
  shortcutSnap: true,
  surfaceId: 'mist',
});

export const workbenchPreferencesStorageKey = (profileAddress) =>
  `inscape:workbench:preferences:${String(profileAddress || 'anonymous').toLowerCase()}`;

const automaticGridColorPreviews = Object.freeze({
  ash: '#c3c3c3', carbon: '#1d1e1d', graphite: '#4f5050',
  mist: '#b4b2aa', paper: '#c5c2b9', slate: '#8c8c8b',
});
export const workbenchGridColorPreview = (surfaceId) =>
  automaticGridColorPreviews[surfaceId] || automaticGridColorPreviews.mist;

const validHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function normalizeWorkbenchPreferences(value, fallbackSurfaceId = DEFAULT_WORKBENCH_PREFERENCES.surfaceId) {
  const source = value && typeof value === 'object' ? value : {};
  const safeFallbackSurface = SYSTEM_WORKFLOW_SURFACE_IDS.includes(fallbackSurfaceId)
    ? fallbackSurfaceId : DEFAULT_WORKBENCH_PREFERENCES.surfaceId;
  return Object.freeze({
    compositionLocked: typeof source.compositionLocked === 'boolean' ? source.compositionLocked : false,
    gridColor: validHexColor(source.gridColor) ? source.gridColor.toLowerCase() : null,
    gridMode: SYSTEM_WORKFLOW_GUIDE_MODES.includes(source.gridMode) ? source.gridMode : DEFAULT_WORKBENCH_PREFERENCES.gridMode,
    shortcutSnap: typeof source.shortcutSnap === 'boolean' ? source.shortcutSnap : DEFAULT_WORKBENCH_PREFERENCES.shortcutSnap,
    surfaceId: SYSTEM_WORKFLOW_SURFACE_IDS.includes(source.surfaceId) ? source.surfaceId : safeFallbackSurface,
  });
}

export function loadWorkbenchPreferences(profileAddress, fallbackSurfaceId, storage = globalThis.localStorage) {
  try {
    const stored = storage?.getItem(workbenchPreferencesStorageKey(profileAddress));
    return normalizeWorkbenchPreferences(stored ? JSON.parse(stored) : null, fallbackSurfaceId);
  } catch {
    return normalizeWorkbenchPreferences(null, fallbackSurfaceId);
  }
}

export function saveWorkbenchPreferences(profileAddress, preferences, storage = globalThis.localStorage) {
  const normalized = normalizeWorkbenchPreferences(preferences);
  try { storage?.setItem(workbenchPreferencesStorageKey(profileAddress), JSON.stringify(normalized)); }
  catch { /* Workbench preferences are optional local state. */ }
  return normalized;
}
