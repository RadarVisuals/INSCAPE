// Placement coordinates retain their existing origin and storage meaning.
// The larger area is a window-placement boundary, not a rendered canvas.
export const WORKBENCH_SIZE = 8000;
export const WORKBENCH_BOUNDS = Object.freeze({ left: 8, top: 8, right: WORKBENCH_SIZE - 8, bottom: WORKBENCH_SIZE - 8 });

export function clampWorkbenchPosition(position, size) {
  return {
    left: Math.max(WORKBENCH_BOUNDS.left, Math.min(WORKBENCH_BOUNDS.right - size.width, position.left)),
    top: Math.max(WORKBENCH_BOUNDS.top, Math.min(WORKBENCH_BOUNDS.bottom - size.height, position.top)),
  };
}

export function projectWorkbenchBounds(scale = 1, offset = { x: 0, y: 0 }) {
  return { left: WORKBENCH_BOUNDS.left * scale + offset.x, top: WORKBENCH_BOUNDS.top * scale + offset.y,
    right: WORKBENCH_BOUNDS.right * scale + offset.x, bottom: WORKBENCH_BOUNDS.bottom * scale + offset.y };
}
