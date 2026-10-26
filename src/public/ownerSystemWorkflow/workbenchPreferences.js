import {
  SYSTEM_WORKFLOW_GUIDE_MODES,
  SYSTEM_WORKFLOW_SURFACE_IDS,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createLocalPreferencesStore } from './localPreferencesStore.js';

export const DEFAULT_WORKBENCH_PREFERENCES = Object.freeze({
  chromeNoise: true,
  compositionLocked: false,
  dockVisible: true,
  gridColor: null,
  gridSpacing: 24,
  gridMode: 'LINES',
  shortcutSnap: true,
  edgeSnap: true,
  moduleGap: 0,
  surfaceId: 'mist',
  galleryCardSize: 2,
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
    galleryCardSize: [1, 2, 3].includes(source.galleryCardSize) ? source.galleryCardSize : 2,
    edgeSnap: typeof source.edgeSnap === 'boolean' ? source.edgeSnap : true,
    moduleGap: Number.isFinite(source.moduleGap) && source.moduleGap >= 0 && source.moduleGap <= 128 ? source.moduleGap : 0,
    chromeNoise: typeof source.chromeNoise === 'boolean' ? source.chromeNoise : true,
    compositionLocked: typeof source.compositionLocked === 'boolean' ? source.compositionLocked : false,
    dockVisible: typeof source.dockVisible === 'boolean' ? source.dockVisible : true,
    gridSpacing: Number.isFinite(source.gridSpacing) && source.gridSpacing >= 8 && source.gridSpacing <= 512 ? source.gridSpacing : 24,
    gridColor: validHexColor(source.gridColor) ? source.gridColor.toLowerCase() : null,
    gridMode: SYSTEM_WORKFLOW_GUIDE_MODES.includes(source.gridMode) ? source.gridMode : DEFAULT_WORKBENCH_PREFERENCES.gridMode,
    shortcutSnap: typeof source.shortcutSnap === 'boolean' ? source.shortcutSnap : DEFAULT_WORKBENCH_PREFERENCES.shortcutSnap,
    surfaceId: SYSTEM_WORKFLOW_SURFACE_IDS.includes(source.surfaceId) ? source.surfaceId : safeFallbackSurface,
  });
}

export function loadWorkbenchPreferences(profileAddress, fallbackSurfaceId, storage = globalThis.localStorage, fresh = false) {
  const stored = storage.getItem(workbenchPreferencesStorageKey(profileAddress));
  return stored === null ? normalizeWorkbenchPreferences(fresh ? { gridMode: 'NONE' } : null, fallbackSurfaceId)
    : decodeWorkbenchPreferences(stored, fallbackSurfaceId);
}

export function saveWorkbenchPreferences(profileAddress, preferences, storage = globalThis.localStorage) {
  const normalized = normalizeWorkbenchPreferences(preferences);
  storage.setItem(workbenchPreferencesStorageKey(profileAddress), JSON.stringify(normalized));
  return normalized;
}

function decodeWorkbenchPreferences(serialized, fallbackSurfaceId) {
  const value = JSON.parse(serialized);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid preferences');
  return normalizeWorkbenchPreferences(value, fallbackSurfaceId);
}

export function createWorkbenchPreferencesStore({ profile, storage, fallbackSurfaceId, fresh, canSave }) {
  const record = createLocalPreferencesStore({
    key: workbenchPreferencesStorageKey(profile), storage, canSave, delay: 0,
    label: 'Workbench', initializeMissing: true,
    initial: normalizeWorkbenchPreferences(fresh ? { gridMode: 'NONE' } : null, fallbackSurfaceId),
    decode: serialized => decodeWorkbenchPreferences(serialized, fallbackSurfaceId),
  });
  return { ...record, update: change => record.update(current =>
    normalizeWorkbenchPreferences(typeof change === 'function' ? change(current) : change, fallbackSurfaceId)) };
}
