export const DISPLAY_CANVAS_LIMITS = Object.freeze({ minimum: 1, maximum: 512 });
const dimension = value => Number.isSafeInteger(value)
  && value >= DISPLAY_CANVAS_LIMITS.minimum && value <= DISPLAY_CANVAS_LIMITS.maximum;
const gcd = (a, b) => b ? gcd(b, a % b) : a;

export function displayPreset(geometry) {
  if (geometry?.columns === 32 && geometry?.rows === 18) return 'LANDSCAPE';
  if (geometry?.columns === 18 && geometry?.rows === 32) return 'PORTRAIT';
  return 'CUSTOM';
}

export function isDisplayFormat(artboard, geometry) {
  if (!artboard || !geometry || Array.isArray(artboard) || Array.isArray(geometry)
    || Object.keys(artboard).length !== 2 || Object.keys(geometry).length !== 2
    || !dimension(geometry.columns) || !dimension(geometry.rows)) return false;
  const divisor = gcd(geometry.columns, geometry.rows);
  return artboard.aspectWidth === geometry.columns / divisor && artboard.aspectHeight === geometry.rows / divisor;
}

// The existing geometry remains authoritative; artboard is its reduced ratio.
// Old 32x18 / 18x32 documents already use exactly this representation.
export function displayFormat(size) {
  const { width, height } = size === 'LANDSCAPE' ? { width: 32, height: 18 }
    : size === 'PORTRAIT' ? { width: 18, height: 32 } : size || {};
  if (!dimension(width) || !dimension(height)) throw new TypeError('Choose whole canvas dimensions from 1 to 512 units.');
  const divisor = gcd(width, height);
  return { artboard: { aspectWidth: width / divisor, aspectHeight: height / divisor }, geometry: { columns: width, rows: height } };
}
