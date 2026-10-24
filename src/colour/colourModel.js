// One equilateral triangle, centred on the hue ring in a 200 × 200 coordinate space.
export const CENTRE = 100;
export const RING_RADIUS = 91;
const radius = 74;
export const TRIANGLE = Object.freeze({
  hue: { x: CENTRE + radius, y: CENTRE },
  white: { x: CENTRE - radius / 2, y: CENTRE - (radius * Math.sqrt(3)) / 2 },
  black: { x: CENTRE - radius / 2, y: CENTRE + (radius * Math.sqrt(3)) / 2 },
});
export const trianglePoints = Object.values(TRIANGLE)
  .map((p) => `${p.x},${p.y}`)
  .join(' ');
export const triangleClip = `polygon(${Object.values(TRIANGLE)
  .map((p) => `${p.x / 2}% ${p.y / 2}%`)
  .join(',')})`;
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const wrapHue = (value) => ((value % 360) + 360) % 360;

export function normaliseHex(value, short = true) {
  const hex = value.trim().replace(/^#/, '');
  if (/^[\da-f]{6}$/i.test(hex)) return '#' + hex.toLowerCase();
  if (short && /^[\da-f]{3}$/i.test(hex))
    return (
      '#' +
      [...hex]
        .map((c) => c + c)
        .join('')
        .toLowerCase()
    );
  return null;
}
export const hexRgb = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
const rgbHex = (rgb) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
export function hsvHex(h, s, v) {
  h = wrapHue(h) / 60;
  s = clamp(s);
  v = clamp(v);
  const channel = (n) => {
    const k = (n + h) % 6;
    return 255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return rgbHex([channel(5), channel(3), channel(1)]);
}
export function hexHsv(hex, hueHint = 0, saturationHint = 0) {
  const [r, g, b] = hexRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const sector =
    delta === 0
      ? null
      : max === r
        ? (g - b) / delta
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  return {
    h: sector === null ? hueHint : wrapHue(sector * 60),
    s: max === 0 ? saturationHint : delta / max,
    v: max,
  };
}
export function hsvHsl({ s, v }) {
  const l = v * (1 - s / 2);
  return { s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l };
}
export function hslHsv(h, s, l) {
  s = clamp(s);
  l = clamp(l);
  const v = l + s * Math.min(l, 1 - l);
  return { h, s: v === 0 ? 0 : 2 * (1 - l / v), v };
}
export function triangleWeights(point) {
  const hue = (point.x - TRIANGLE.white.x) / (TRIANGLE.hue.x - TRIANGLE.white.x);
  const black = (point.y - TRIANGLE.white.y) / (TRIANGLE.black.y - TRIANGLE.white.y) - hue / 2;
  return { hue, white: 1 - hue - black, black };
}
function segmentPoint(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy));
  return { x: a.x + t * dx, y: a.y + t * dy };
}
export function clampTriangle(point) {
  const weights = triangleWeights(point);
  if (Object.values(weights).every((value) => value >= 0)) return point;
  const vertices = Object.values(TRIANGLE);
  return vertices
    .map((a, i) => segmentPoint(point, a, vertices[(i + 1) % 3]))
    .sort(
      (a, b) =>
        (a.x - point.x) ** 2 + (a.y - point.y) ** 2 - (b.x - point.x) ** 2 - (b.y - point.y) ** 2,
    )[0];
}
export function pointHsv(point, hue, saturationHint = 0) {
  const weights = triangleWeights(clampTriangle(point));
  const v = clamp(1 - weights.black);
  return { h: hue, s: v < 1e-9 ? saturationHint : clamp(weights.hue / v), v: v < 1e-9 ? 0 : v };
}
export function hsvPoint({ s, v }) {
  const weights = { hue: s * v, white: (1 - s) * v, black: 1 - v };
  return Object.entries(TRIANGLE).reduce(
    (point, [key, vertex]) => ({
      x: point.x + vertex.x * weights[key],
      y: point.y + vertex.y * weights[key],
    }),
    { x: 0, y: 0 },
  );
}
export function ringPoint(hue) {
  const angle = (hue * Math.PI) / 180;
  return { x: CENTRE + RING_RADIUS * Math.sin(angle), y: CENTRE - RING_RADIUS * Math.cos(angle) };
}
export const pointHue = (point) =>
  wrapHue((Math.atan2(point.y - CENTRE, point.x - CENTRE) * 180) / Math.PI + 90);

// Paint the same affine white/hue/black mixture used by pointer selection.
// The CSS clip is derived from TRIANGLE; there is no independent visual approximation.
export function paintTriangle(canvas, hue) {
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height),
    rgb = hexRgb(hsvHex(hue, 1, 1));
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const w = triangleWeights({
        x: ((x + 0.5) * 200) / canvas.width,
        y: ((y + 0.5) * 200) / canvas.height,
      });
      const offset = (y * canvas.width + x) * 4;
      for (let c = 0; c < 3; c++) image.data[offset + c] = rgb[c] * w.hue + 255 * w.white;
      image.data[offset + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
}
