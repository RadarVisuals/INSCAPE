const STORAGE_KEY = 'underneath.actor-presets.v1';

export const ACTOR_PRESET_STATE_KEYS = [
  'floatSpeed',
  'floatAmpX',
  'floatAmpY',
  'floatRotation',
  'flyMinScale',
  'flyMaxScale',
  'flyHoverPause',
  'flyTiltBias',
  'eyelidTravel',
  'blinkInterval',
  'blinkSpeed',
  'autoBlink',
  'eyelidManualProgress',
  'pupilWander',
  'pupilSaccade',
  'pupilMouseInfluence',
  'searchlightActive',
  'searchlightWidth',
  'searchlightLength',
  'searchlightRadius',
  'searchlightColorR',
  'searchlightColorG',
  'searchlightColorB',
  'auraOpacity',
  'auraScale',
  'auraBlur',
  'auraPulseSpeed',
  'auraColorR',
  'auraColorG',
  'auraColorB',
  'cavernLightIntensity',
  'particleCount',
  'particleSpeed',
  'particleWind',
  'particleSway',
  'particleSize',
  'particleOpacity',
  'fogOpacity',
  'fogSpeed',
  'fogColorR',
  'fogColorG',
  'fogColorB',
  'fogSwaySpeed',
  'fogSwayAmp',
  'scanlineOpacity',
  'vignetteOpacity'
];

function readPresets() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[ActorPresets] Could not read saved presets:', error);
    return [];
  }
}

function persistPresets(presets) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.warn('[ActorPresets] Could not persist presets:', error);
  }
}

function createPresetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `actor-preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const createActorPresetSlice = (set, get) => ({
  actorPresets: readPresets(),

  saveActorPreset: (requestedName) => {
    const name = requestedName.trim();
    if (!name) return null;

    const state = get();
    const values = Object.fromEntries(ACTOR_PRESET_STATE_KEYS.map((key) => [key, state[key]]));
    const timestamp = new Date().toISOString();
    const existing = state.actorPresets.find((preset) => preset.name.toLowerCase() === name.toLowerCase());
    const savedPreset = existing
      ? { ...existing, name, updatedAt: timestamp, renderConfig: state.renderConfig, values }
      : { id: createPresetId(), name, createdAt: timestamp, updatedAt: timestamp, renderConfig: state.renderConfig, values };
    const actorPresets = existing
      ? state.actorPresets.map((preset) => preset.id === existing.id ? savedPreset : preset)
      : [...state.actorPresets, savedPreset];

    persistPresets(actorPresets);
    set({ actorPresets });
    return savedPreset.id;
  },

  applyActorPreset: (presetId) => {
    const preset = get().actorPresets.find((candidate) => candidate.id === presetId);
    if (!preset?.renderConfig || !preset?.values) return false;
    const currentActorId = get().renderConfig.actor.id;
    get().applyRenderConfig({
      ...preset.renderConfig,
      actor: { ...preset.renderConfig.actor, id: currentActorId }
    });
    get().applyRenderParameters(preset.values);
    return true;
  },

  deleteActorPreset: (presetId) => {
    const actorPresets = get().actorPresets.filter((preset) => preset.id !== presetId);
    persistPresets(actorPresets);
    set({ actorPresets });
  }
});
