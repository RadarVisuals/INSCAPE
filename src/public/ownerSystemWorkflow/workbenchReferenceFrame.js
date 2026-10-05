import { workbenchPaintGeometry } from './workbenchPaintGeometry.js';
import { WORKBENCH_BOUNDS } from './workbenchSpace.js';

// An editor measuring guide in Workbench coordinates, never a module/container.
export const DEFAULT_REFERENCE_FRAME_SIZE = Object.freeze({ width: 1440, height: 900 });
export const WORKBENCH_REFERENCE_FRAME = Object.freeze({ left: 48, top: 48, ...DEFAULT_REFERENCE_FRAME_SIZE });
export const WORKBENCH_REFERENCE_FRAME_MAX = WORKBENCH_BOUNDS.right - WORKBENCH_REFERENCE_FRAME.left;

export function normalizeWorkbenchReferenceFrameSize(value) {
  const dimension = axis => Number.isInteger(value?.[axis]) && value[axis] >= 1 && value[axis] <= WORKBENCH_REFERENCE_FRAME_MAX
    ? value[axis] : DEFAULT_REFERENCE_FRAME_SIZE[axis];
  return Object.freeze({ width: dimension('width'), height: dimension('height') });
}

export function fitWorkbenchReferenceFrame(viewport, frame = WORKBENCH_REFERENCE_FRAME) {
  if (!(viewport.width > 0 && viewport.height > 0)) return null;
  const margin = Math.min(32, viewport.width / 4, viewport.height / 4);
  const scale = Math.min(1, (viewport.width - margin * 2) / frame.width, (viewport.height - margin * 2) / frame.height);
  return { scale, offset: {
    x: (viewport.width - frame.width * scale) / 2 - frame.left * scale,
    y: (viewport.height - frame.height * scale) / 2 - frame.top * scale,
  } };
}

// Camera limits only: authored module positions still belong to the Workbench.
// A quarter-frame margin permits edge work without an unbounded empty desktop.
export function constrainWorkbenchFrameCamera(camera, viewport, frame = WORKBENCH_REFERENCE_FRAME) {
  const fitted = fitWorkbenchReferenceFrame(viewport, frame);
  if (!fitted) return camera;
  const scale = Math.max(fitted.scale, Math.min(2, camera.scale));
  const margin = Math.min(32, viewport.width / 4, viewport.height / 4);
  const axis = (offset, start, size, available) => {
    if (size * scale <= available - 2 * margin + 1e-6) return (available - size * scale) / 2 - start * scale;
    const padding = size * .25;
    const low = available - (start + size + padding) * scale;
    const high = -(start - padding) * scale;
    return low > high ? (low + high) / 2 : Math.max(low, Math.min(high, offset));
  };
  return { scale, offset: {
    x: axis(camera.offset.x, frame.left, frame.width, viewport.width),
    y: axis(camera.offset.y, frame.top, frame.height, viewport.height),
  } };
}

export function projectWorkbenchReferenceFrame(scale, offset, density = 1, frame = WORKBENCH_REFERENCE_FRAME) {
  const pixels = workbenchPaintGeometry({ left: frame.left * scale + offset.x, top: frame.top * scale + offset.y,
    width: frame.width * scale, height: frame.height * scale }, density);
  return Object.fromEntries(Object.entries(pixels).map(([key, value]) => [key, value / density]));
}
