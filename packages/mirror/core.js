export const formats = { landscape: [1600, 900], portrait: [900, 1600], square: [1000, 1000] };
export const limits = { distance: [-1000, 1000], x: [-1, 1], y: [-1, 1], scale: [0.05, 4], rotation: [-180, 180] };
export const labels = { distance: 'Spiegelafstand', x: 'Positie X', y: 'Positie Y', scale: 'Schaal', rotation: 'Assetrotatie · graden' };
export function defaults() {
  return { version: 1, format: 'landscape', assetRef: null, axis: 'vertical', flipHorizontal: false, parameters: Object.fromEntries(
    Object.keys(limits).map((key, i) => [key, { base: key === 'scale' ? 1 : 0, enabled: false,
      amplitude: key === 'distance' ? 120 : key === 'rotation' ? 30 : key === 'scale' ? 0.15 : 0.12,
      speed: 0.08 + i * 0.013, wave: 'sine', seed: 137 + i * 719 }])) };
}
export function validate(value) {
  const fail = message => { throw new Error(`Ongeldige instellingen: ${message}`); };
  if (!value || value.version !== 1) fail('versie moet 1 zijn.');
  if (!Object.hasOwn(formats, value.format)) fail('onbekend Stage-formaat.');
  if (value.assetRef !== null && (typeof value.assetRef !== 'string' || value.assetRef.length > 2048)) fail('bronreferentie moet tekst of null zijn.');
  const axis = value.axis === undefined ? 'vertical' : value.axis;
  const flipHorizontal = value.flipHorizontal === undefined ? false : value.flipHorizontal;
  const rotation = value.rotation === undefined ? 0 : value.rotation;
  if (!['vertical', 'horizontal'].includes(axis) || typeof flipHorizontal !== 'boolean' || !Number.isFinite(rotation) || rotation < -180 || rotation > 180) fail('ongeldige as, flip of rotatie.');
  const result = { version: 1, format: value.format, assetRef: value.assetRef, parameters: {}, axis, flipHorizontal };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const p = key === 'rotation' && value.parameters?.rotation === undefined
      ? { ...defaults().parameters.rotation, base: rotation } : value.parameters?.[key];
    if (!p) fail(`${labels[key]} ontbreekt.`);
    for (const [field, low, high] of [['base', min, max], ['amplitude', 0, max - min], ['speed', 0.001, 2], ['seed', 0, 2147483647]]) {
      if (!Number.isFinite(p[field]) || p[field] < low || p[field] > high) fail(`${labels[key]} / ${field}: verwacht ${low} tot ${high}.`);
    }
    if (!Number.isInteger(p.seed) || typeof p.enabled !== 'boolean' || !['sine', 'noise'].includes(p.wave)) fail(`${labels[key]}: ongeldige automatisering.`);
    result.parameters[key] = Object.fromEntries(['base', 'enabled', 'amplitude', 'speed', 'wave', 'seed'].map(k => [k, p[k]]));
  }
  return result;
}
const hash = (n, seed) => { let v = Math.imul(n ^ seed, 374761393); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967295 * 2 - 1; };
export function noise(t, seed) {
  const n = Math.floor(t), f = t - n, blend = f * f * (3 - 2 * f);
  return hash(n, seed) * (1 - blend) + hash(n + 1, seed) * blend;
}
export function evaluate(settings, time) {
  return Object.fromEntries(Object.entries(settings.parameters).map(([key, p]) => {
    const wave = p.wave === 'noise' ? noise(time * p.speed, p.seed) : Math.sin(time * p.speed * Math.PI * 2 + p.seed * 0.01);
    const [min, max] = limits[key];
    return [key, Math.max(min, Math.min(max, p.base + (p.enabled ? wave * p.amplitude : 0)))];
  }));
}
export function geometry(width, height, values, format) {
  const unit = Math.min(650 / width, 700 / height);
  const w = width * unit, h = height * unit;
  const [sw, sh] = formats[format];
  return { w, h, sourceX: -w - values.distance, mirrorX: w + values.distance,
    axisX: sw * (0.5 + values.x / 2), axisY: sh * (0.5 + values.y / 2), scale: values.scale };
}
// Sprite centres and reflected transforms in Stage-aligned local coordinates.
export function mirrorTransforms(w, h, distance, axis, rotation, flipHorizontal) {
  const horizontal = axis === 'horizontal', angle = rotation * Math.PI / 180;
  const offset = (horizontal ? h : w) / 2 + distance;
  const sx = flipHorizontal ? -1 : 1;
  return {
    source: { x: horizontal ? 0 : -offset, y: horizontal ? -offset : 0, rotation: angle, sx, sy: 1 },
    mirror: { x: horizontal ? 0 : offset, y: horizontal ? offset : 0,
      rotation: -angle, sx: horizontal ? sx : -sx, sy: horizontal ? -1 : 1 },
  };
}
export function fit(width, height, format, dpr = 1) {
  const [w, h] = formats[format], zoom = Math.max(0, Math.min(width / w, height / h));
  const cssWidth = w * zoom, cssHeight = h * zoom;
  return { width: cssWidth, height: cssHeight, zoom,
    resolution: Math.min(Math.max(1, dpr), 2, 4096 / Math.max(1, cssWidth, cssHeight)) };
}
export class Clock {
  time = 0; last = null;
  step(now, running) { if (running && this.last !== null) this.time += Math.min(0.1, Math.max(0, (now - this.last) / 1000)); this.last = running ? now : null; return this.time; }
  reset() { this.time = 0; this.last = null; }
}
