// Temporary topology reconstructed from canonical rectangles. Never persisted.
const EPS = .001;
export { workbenchSelectionBounds as tilingBounds } from '../public/ownerSystemWorkflow/workbenchViewScale.js';
import { workbenchSelectionBounds as tilingBounds } from '../public/ownerSystemWorkflow/workbenchViewScale.js';
export function inferReceptionTiling(frames) {
  if (!frames.length) return null;
  const bounds = tilingBounds(frames);
  if (Math.abs(frames.reduce((sum, r) => sum + r.width * r.height, 0) - bounds.width * bounds.height) > EPS * Math.max(bounds.width, bounds.height)) return null;
  if (frames.length === 1) return { id: frames[0].id };
  for (const [axis, size] of [['left', 'width'], ['top', 'height']]) {
    const cuts = [...new Set(frames.map(r => r[axis] + r[size]))]
      .sort((a, b) => Math.abs(a - bounds[axis] - bounds[size] / 2) - Math.abs(b - bounds[axis] - bounds[size] / 2));
    for (const cut of cuts) {
      const before = frames.filter(r => r[axis] + r[size] <= cut + EPS), after = frames.filter(r => r[axis] >= cut - EPS);
      if (!before.length || !after.length || before.length + after.length !== frames.length) continue;
      const first = inferReceptionTiling(before), second = inferReceptionTiling(after);
      if (first && second) return { axis: axis === 'left' ? 'x' : 'y', ratio: (cut - bounds[axis]) / bounds[size], first, second };
    }
  }
  return null;
}
