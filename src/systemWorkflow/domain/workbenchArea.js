// Authored work area, independent from the camera and module geometry.
export const WORKBENCH_WIDTH = 2000;
export const WORKBENCH_HEIGHT = 4000;
export const DEFAULT_WORKBENCH_AREA = Object.freeze({ left: 0, top: 0, width: WORKBENCH_WIDTH, height: WORKBENCH_HEIGHT });
export const MIN_WORKBENCH_SIZE = 1;
export const MAX_WORKBENCH_SIZE = 16384;
// Finite editing space, independent of the visible canvas. Crossing a canvas
// edge crops the presentation; it must not push authored objects back inside.
export const WORKBENCH_EDITING_BOUNDS = Object.freeze({
  left: -MAX_WORKBENCH_SIZE, top: -MAX_WORKBENCH_SIZE,
  right: MAX_WORKBENCH_SIZE, bottom: MAX_WORKBENCH_SIZE,
});
export function validWorkbenchArea(area) {
  if (!area || typeof area !== 'object' || Array.isArray(area)
    || Object.keys(area).some(key => !['left', 'top', 'width', 'height'].includes(key))) return false;
  if (!['width', 'height'].every(key => Number.isInteger(area[key]) && area[key] >= MIN_WORKBENCH_SIZE && area[key] <= MAX_WORKBENCH_SIZE)) return false;
  return [['left', 'width'], ['top', 'height']].every(([axis, size]) => {
    const start = Object.hasOwn(area, axis) ? area[axis] : 0;
    return Number.isInteger(start) && start >= -MAX_WORKBENCH_SIZE && start + area[size] <= MAX_WORKBENCH_SIZE;
  });
}
// Origin is optional and defaults to zero; content stays in world coordinates.
export const workbenchArea = presentation => presentation?.area
  ? { left: 0, top: 0, ...presentation.area } : DEFAULT_WORKBENCH_AREA;
export const workbenchAreaBounds = (area = DEFAULT_WORKBENCH_AREA) => {
  const { left, top, width, height } = workbenchArea({ area });
  const insetX = Math.min(8, width / 2), insetY = Math.min(8, height / 2);
  return { left: left + insetX, top: top + insetY, right: left + width - insetX, bottom: top + height - insetY };
};
export const WORKBENCH_BOUNDS = Object.freeze(workbenchAreaBounds());
export function resizeWorkbenchArea(area, edge, delta) {
  const original = workbenchArea({ area });
  const axis = (start, size, movement, leading, trailing) => {
    const end = start + size, clamp = (value, low, high) => Math.max(low, Math.min(high, Math.round(value)));
    if (leading) {
      const next = clamp(start + movement, Math.max(-MAX_WORKBENCH_SIZE, end - MAX_WORKBENCH_SIZE), end - MIN_WORKBENCH_SIZE);
      return [next, end - next];
    }
    if (trailing) return [start, clamp(end + movement, start + MIN_WORKBENCH_SIZE, Math.min(MAX_WORKBENCH_SIZE, start + MAX_WORKBENCH_SIZE)) - start];
    return [start, size];
  };
  const [left, width] = axis(original.left, original.width, delta.x, edge.includes('w'), edge.includes('e'));
  const [top, height] = axis(original.top, original.height, delta.y, edge.includes('n'), edge.includes('s'));
  return { left, top, width, height };
}
// Enclose the exact object frames, rounded outward only to whole work pixels.
export function fitWorkbenchArea(frames) {
  const valid = frames.filter(frame => frame && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(frame[key]))
    && frame.width > 0 && frame.height > 0);
  if (!valid.length) return null;
  const left = Math.floor(Math.min(...valid.map(frame => frame.left))), top = Math.floor(Math.min(...valid.map(frame => frame.top)));
  const width = Math.ceil(Math.max(...valid.map(frame => frame.left + frame.width))) - left;
  const height = Math.ceil(Math.max(...valid.map(frame => frame.top + frame.height))) - top;
  const area = { left, top, width, height };
  if (!validWorkbenchArea(area)) throw new Error('This content extends beyond the maximum canvas bounds.');
  return area;
}
