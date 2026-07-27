const MAT_KEYS = Object.freeze(['enabled', 'color', 'inset']);
const INSET_KEYS = Object.freeze(['top', 'right', 'bottom', 'left']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const ARTWORK_MAT_INSET_MAX = 0.45;
export const ARTWORK_MAT_PRESET_IDS = Object.freeze({ NONE: 'NONE', DOSSIER: 'DOSSIER', CAPTION: 'CAPTION' });
export const DEFAULT_ARTWORK_MAT = Object.freeze({
  enabled: false,
  color: '#090a0a',
  inset: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
});
export const DEFAULT_ARTWORK_BACKING = Object.freeze({ enabled: false, color: '#d8d4ca' });

const PRESETS = Object.freeze({
  [ARTWORK_MAT_PRESET_IDS.NONE]: DEFAULT_ARTWORK_MAT,
  [ARTWORK_MAT_PRESET_IDS.DOSSIER]: Object.freeze({ enabled: true, color: '#d8d4ca', inset: Object.freeze({ top: 0.06, right: 0, bottom: 0.07, left: 0 }) }),
  [ARTWORK_MAT_PRESET_IDS.CAPTION]: Object.freeze({ enabled: true, color: '#090a0a', inset: Object.freeze({ top: 0.06, right: 0, bottom: 0.16, left: 0 }) }),
});

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

export function normalizeArtworkMat(value) {
  if (!exactKeys(value, MAT_KEYS) || typeof value.enabled !== 'boolean'
    || typeof value.color !== 'string' || !HEX_COLOR.test(value.color)
    || !exactKeys(value.inset, INSET_KEYS)) {
    throw new TypeError('Artwork mat requires enabled, six-digit color, and four canonical insets');
  }
  const inset = Object.fromEntries(INSET_KEYS.map((edge) => {
    const amount = value.inset[edge];
    if (!Number.isFinite(amount)) throw new TypeError('Artwork mat insets must be finite');
    return [edge, clamp(amount, 0, ARTWORK_MAT_INSET_MAX)];
  }));
  return { enabled: value.enabled, color: value.color.toLowerCase(), inset };
}

export function normalizeArtworkBacking(value) {
  if (!exactKeys(value, ['enabled', 'color']) || typeof value.enabled !== 'boolean'
    || typeof value.color !== 'string' || !HEX_COLOR.test(value.color)) {
    throw new TypeError('Artwork backing requires enabled and a six-digit color');
  }
  return { enabled: value.enabled, color: value.color.toLowerCase() };
}

export function resolveArtworkMatPreset(presetId) {
  const preset = PRESETS[presetId];
  if (!preset) throw new TypeError('Unknown artwork mat preset');
  return normalizeArtworkMat(preset);
}

export function projectArtworkMat(placementRectangle, value) {
  if (!placementRectangle
    || !Number.isFinite(placementRectangle.left) || !Number.isFinite(placementRectangle.top)
    || !Number.isFinite(placementRectangle.width) || placementRectangle.width <= 0
    || !Number.isFinite(placementRectangle.height) || placementRectangle.height <= 0) {
    throw new TypeError('Artwork mat projection requires a positive placement rectangle');
  }
  const mat = normalizeArtworkMat(value);
  if (!mat.enabled) return { mat, backplateRectangle: null, mediaOpeningRectangle: placementRectangle };
  return {
    mat,
    backplateRectangle: placementRectangle,
    mediaOpeningRectangle: {
      left: placementRectangle.left + (placementRectangle.width * mat.inset.left),
      top: placementRectangle.top + (placementRectangle.height * mat.inset.top),
      width: placementRectangle.width * (1 - mat.inset.left - mat.inset.right),
      height: placementRectangle.height * (1 - mat.inset.top - mat.inset.bottom),
    },
  };
}
