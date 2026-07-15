import { DEFAULT_RENDER_CONFIG, RENDER_CONFIG_VERSION } from './renderConfig.defaults.js';
import { RENDER_PARAMETER_DEFINITIONS } from './renderConfig.schema.js';

function cloneDefaults() {
  return {
    schemaVersion: RENDER_CONFIG_VERSION,
    actor: {
      id: DEFAULT_RENDER_CONFIG.actor.id,
      geometry: { ...DEFAULT_RENDER_CONFIG.actor.geometry },
      warp: { ...DEFAULT_RENDER_CONFIG.actor.warp },
      motion: { ...DEFAULT_RENDER_CONFIG.actor.motion },
      eyes: { ...DEFAULT_RENDER_CONFIG.actor.eyes },
      aura: { ...DEFAULT_RENDER_CONFIG.actor.aura, color: [...DEFAULT_RENDER_CONFIG.actor.aura.color] },
      searchlight: { ...DEFAULT_RENDER_CONFIG.actor.searchlight, color: [...DEFAULT_RENDER_CONFIG.actor.searchlight.color] }
    },
    scene: {
      background: {
        ...DEFAULT_RENDER_CONFIG.scene.background,
        patternWarp: { ...DEFAULT_RENDER_CONFIG.scene.background.patternWarp }
      },
      atmosphere: {
        particles: { ...DEFAULT_RENDER_CONFIG.scene.atmosphere.particles },
        fog: { ...DEFAULT_RENDER_CONFIG.scene.atmosphere.fog, color: [...DEFAULT_RENDER_CONFIG.scene.atmosphere.fog.color] }
      }
    },
    phenomena: {
      veins: { ...DEFAULT_RENDER_CONFIG.phenomena.veins, color: [...DEFAULT_RENDER_CONFIG.phenomena.veins.color], source: [...DEFAULT_RENDER_CONFIG.phenomena.veins.source] },
      weather: { ...DEFAULT_RENDER_CONFIG.phenomena.weather, color: [...DEFAULT_RENDER_CONFIG.phenomena.weather.color] },
      shedSkin: { ...DEFAULT_RENDER_CONFIG.phenomena.shedSkin, color: [...DEFAULT_RENDER_CONFIG.phenomena.shedSkin.color] }
    }
  };
}

function getAtPath(value, path) {
  return path.reduce((current, segment) => current?.[segment], value);
}

function setAtPath(value, path, nextValue) {
  let current = value;
  for (let index = 0; index < path.length - 1; index += 1) current = current[path[index]];
  current[path[path.length - 1]] = nextValue;
}

export function normalizeRenderParameter(definition, value, fallback) {
  if (definition.type === 'boolean') return typeof value === 'boolean' ? value : fallback;
  if (definition.type === 'enum') return definition.values.includes(value) ? value : fallback;
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  // Some authored defaults intentionally predate and sit outside their editor range.
  // Preserve those defaults during normalization without allowing new invalid edits.
  if (numericValue === fallback) return fallback;
  const clamped = Math.max(definition.min, Math.min(definition.max, numericValue));
  return definition.integer ? Math.round(clamped) : clamped;
}

export function normalizeRenderConfig(candidate = {}) {
  const normalized = cloneDefaults();
  for (const definition of Object.values(RENDER_PARAMETER_DEFINITIONS)) {
    const supplied = getAtPath(candidate, definition.path);
    const fallback = getAtPath(normalized, definition.path);
    setAtPath(normalized, definition.path, normalizeRenderParameter(definition, supplied, fallback));
  }
  return normalized;
}

export function createRenderConfigFromFlatState(state = {}) {
  const candidate = cloneDefaults();
  for (const [key, definition] of Object.entries(RENDER_PARAMETER_DEFINITIONS)) {
    if (Object.prototype.hasOwnProperty.call(state, key)) setAtPath(candidate, definition.path, state[key]);
  }
  return normalizeRenderConfig(candidate);
}

export function toFlatRenderParameters(config, root = null) {
  const normalized = normalizeRenderConfig(config);
  return Object.fromEntries(
    Object.entries(RENDER_PARAMETER_DEFINITIONS)
      .filter(([, definition]) => root === null || definition.path[0] === root)
      .map(([key, definition]) => [key, getAtPath(normalized, definition.path)])
  );
}

export function updateRenderConfigParameter(config, key, value) {
  const definition = RENDER_PARAMETER_DEFINITIONS[key];
  if (!definition) return null;
  const normalized = normalizeRenderConfig(config);
  const fallback = getAtPath(normalized, definition.path);
  const nextValue = normalizeRenderParameter(definition, value, fallback);
  setAtPath(normalized, definition.path, nextValue);
  return { renderConfig: normalized, value: nextValue };
}
