// Authored work area, independent from the camera and module geometry.
export const WORKBENCH_WIDTH = 2000;
export const WORKBENCH_HEIGHT = 4000;
export const DEFAULT_WORKBENCH_AREA = Object.freeze({ width: WORKBENCH_WIDTH, height: WORKBENCH_HEIGHT });
export const MIN_WORKBENCH_SIZE = 256;
export const MAX_WORKBENCH_SIZE = 16384;
export const WORKBENCH_CONTENT_MARGIN = 48;
export const validWorkbenchArea = area => Boolean(area && typeof area === 'object' && !Array.isArray(area)
  && Object.keys(area).length === 2 && ['width', 'height'].every(key => Number.isInteger(area[key])
    && area[key] >= MIN_WORKBENCH_SIZE && area[key] <= MAX_WORKBENCH_SIZE));
export const workbenchArea = presentation => presentation?.area || DEFAULT_WORKBENCH_AREA;
export const workbenchAreaBounds = (area = DEFAULT_WORKBENCH_AREA) => ({ left: 8, top: 8, right: area.width - 8, bottom: area.height - 8 });
export const WORKBENCH_BOUNDS = Object.freeze(workbenchAreaBounds());
export function resizeWorkbenchArea(area, edge, delta) {
  const size = value => Math.max(MIN_WORKBENCH_SIZE, Math.min(MAX_WORKBENCH_SIZE, Math.round(value)));
  return { width: size(area.width + (edge.includes('e') ? delta.x : 0)),
    height: size(area.height + (edge.includes('s') ? delta.y : 0)) };
}
// The origin stays fixed. Fit changes only the right and bottom boundaries.
export function fitWorkbenchArea(frames, margin = WORKBENCH_CONTENT_MARGIN) {
  const valid = frames.filter(frame => frame && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(frame[key]))
    && frame.width > 0 && frame.height > 0);
  if (!valid.length) return null;
  const width = Math.max(...valid.map(frame => frame.left + frame.width)) + margin;
  const height = Math.max(...valid.map(frame => frame.top + frame.height)) + margin;
  if (width > MAX_WORKBENCH_SIZE || height > MAX_WORKBENCH_SIZE) throw new Error('This content extends beyond the maximum canvas size.');
  return { width: Math.max(MIN_WORKBENCH_SIZE, Math.ceil(width)), height: Math.max(MIN_WORKBENCH_SIZE, Math.ceil(height)) };
}
