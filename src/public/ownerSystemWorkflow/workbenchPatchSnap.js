import { gridEdgeMatch } from './workbenchEdgeSnap.js';

// Geometry here is in screen coordinates. Patch spacing follows the same
// authored transform as its painted lines; camera zoom never rounds world units.
export function resolveWorkbenchGrid(point, patches, fallback, previousId = null) {
  const contains = (p, margin = 0) => point.x >= p.left - margin && point.y >= p.top - margin
    && point.x <= p.left + p.width + margin && point.y <= p.top + p.height + margin;
  // Last painted wins inside overlaps. Retain only just outside a boundary,
  // without preventing deliberate entry into a different patch.
  const direct = patches.findLast(p => contains(p));
  if (direct) return direct;
  const retained = patches.find(p => p.id === previousId && contains(p, Math.min(4, p.step / 4)));
  return retained || fallback;
}

export function workbenchGridMatch(grid, axis, side, value, previous) {
  if (!grid || !Number.isFinite(grid.step) || grid.step <= 0) return null;
  const origin = axis === 'x' ? grid.left : grid.top;
  const retained = previous?.gridId === grid.id && previous.step === grid.step && previous.origin === origin ? previous : null;
  return { ...gridEdgeMatch(axis, side, value, origin, grid.step, retained),
    gridId: grid.id, step: grid.step, origin,
    ...(grid.patch ? { patch: grid, cellSize: grid.cellSize } : {}) };
}

// Edge attraction must not cover several grid cells when zoomed out.
export function limitWorkbenchEdge(match, grid) {
  return match && (!grid || match.distance <= Math.min(10, grid.step * .35)) ? match : null;
}
