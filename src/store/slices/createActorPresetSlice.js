import { decodeRenderConfigDocument, parseRenderConfigDocument } from '../../config/renderConfigDocument.js';
import { reportControlledError } from '../../diagnostics.js';

const STORAGE_KEY = 'underneath.actor-presets.v1';

function normalizePreset(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !candidate.name.trim()) return null;
  const decoded = decodeRenderConfigDocument(candidate.renderConfig);
  if (!decoded.ok) return null;
  return {
    id: candidate.id,
    name: candidate.name.trim(),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : null,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
    renderConfig: decoded.value
  };
}

export function decodeActorPresets(source) {
  let parsed;
  try {
    parsed = typeof source === 'string' ? JSON.parse(source) : source;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizePreset).filter(Boolean);
}

function readPresets() {
  if (typeof window === 'undefined') return [];
  try {
    return decodeActorPresets(window.localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    reportControlledError('actor-presets-read', error);
    return [];
  }
}

function persistPresets(presets) {
  if (typeof window === 'undefined') return;
  try {
    const safePresets = presets.map(normalizePreset).filter(Boolean);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safePresets));
  } catch (error) {
    reportControlledError('actor-presets-write', error);
  }
}

function createPresetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `actor-preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const createActorPresetSlice = (set, get) => ({
  actorPresets: [],

  loadActorPresets: () => set({ actorPresets: readPresets() }),

  saveActorPreset: (requestedName) => {
    const name = requestedName.trim();
    if (!name) return null;

    const state = get();
    const renderConfig = parseRenderConfigDocument(state.renderConfig);
    const timestamp = new Date().toISOString();
    const existing = state.actorPresets.find((preset) => preset.name.toLowerCase() === name.toLowerCase());
    const savedPreset = existing
      ? { ...existing, name, updatedAt: timestamp, renderConfig }
      : { id: createPresetId(), name, createdAt: timestamp, updatedAt: timestamp, renderConfig };
    const actorPresets = existing
      ? state.actorPresets.map((preset) => preset.id === existing.id ? savedPreset : preset)
      : [...state.actorPresets, savedPreset];

    persistPresets(actorPresets);
    set({ actorPresets });
    return savedPreset.id;
  },

  applyActorPreset: (presetId) => {
    const preset = get().actorPresets.find((candidate) => candidate.id === presetId);
    const decoded = decodeRenderConfigDocument(preset?.renderConfig);
    if (!decoded.ok) return false;
    const currentActorId = get().renderConfig.actor.id;
    get().applyRenderConfig({
      ...decoded.value,
      actor: { ...decoded.value.actor, id: currentActorId }
    });
    return true;
  },

  deleteActorPreset: (presetId) => {
    const actorPresets = get().actorPresets.filter((preset) => preset.id !== presetId);
    persistPresets(actorPresets);
    set({ actorPresets });
  }
});
