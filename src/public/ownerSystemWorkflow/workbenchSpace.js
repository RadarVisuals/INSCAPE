// Placement coordinates retain their existing origin and storage meaning.
// The authored area guides placement and grid painting, never camera movement.
import { WORKBENCH_BOUNDS } from '../../systemWorkflow/domain/workbenchArea.js';
export { WORKBENCH_BOUNDS, WORKBENCH_WIDTH, WORKBENCH_HEIGHT } from '../../systemWorkflow/domain/workbenchArea.js';

export function clampWorkbenchPosition(position, size, bounds = WORKBENCH_BOUNDS) {
  return {
    left: Math.max(bounds.left, Math.min(bounds.right - size.width, position.left)),
    top: Math.max(bounds.top, Math.min(bounds.bottom - size.height, position.top)),
  };
}

export function projectWorkbenchBounds(scale = 1, offset = { x: 0, y: 0 }, bounds = WORKBENCH_BOUNDS) {
  return { left: bounds.left * scale + offset.x, top: bounds.top * scale + offset.y,
    right: bounds.right * scale + offset.x, bottom: bounds.bottom * scale + offset.y };
}

// Screen input becomes authored position only after removing the temporary
// camera. Use exact coordinates; paint rounding must not enter saved layouts.
export function unprojectWorkbenchPosition(position, scale = 1, offset = { x: 0, y: 0 }) {
  return { left: (position.left - offset.x) / scale, top: (position.top - offset.y) / scale };
}
