export const EDGE_SNAP_DISTANCE = 10;
export const EDGE_RELEASE_DISTANCE = 18;
const identity = target => target.id ?? target;
const sameTarget = (a, b) => a && b && identity(a) === identity(b);
// Rectangles use viewport pixels; gaps measure visible boundaries, not editor chrome.
export function moduleEdgeMatch(rect, targets, axis, side, value, gap = 0, previous = null) {
  const candidates = [];
  const horizontal = axis === 'x';
  const low = horizontal ? 'left' : 'top';
  const acrossLow = horizontal ? 'top' : 'left', acrossSize = horizontal ? 'height' : 'width';
  for (const target of targets) {
    if (rect[acrossLow] > target[acrossLow] + target[acrossSize] + gap + EDGE_RELEASE_DISTANCE
      || target[acrossLow] > rect[acrossLow] + rect[acrossSize] + gap + EDGE_RELEASE_DISTANCE) continue;
    const end = target[low] + target[horizontal ? 'width' : 'height'];
    const values = side === low ? [[target[low], target[low], 'edge'], [end, end + gap, 'gap']]
      : [[end, end, 'edge'], [target[low], target[low] - gap, 'gap']];
    for (const [targetEdge, next, kind] of values) candidates.push({ axis, side, value: next, target, targetEdge, kind, gap, distance: Math.abs(next - value) });
  }
  // The active target wins until deliberately released, even if another edge
  // becomes nearer. Target identity survives fresh DOM measurements.
  const retained = candidates.find(match => previous?.side === side && previous.kind === match.kind
    && sameTarget(previous.target, match.target) && match.distance <= EDGE_RELEASE_DISTANCE);
  return retained || candidates.filter(match => match.distance <= EDGE_SNAP_DISTANCE)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}
export function modulePositionMatch(rect, targets, gap = 0, previous = {}) {
  const position = {}, matches = {};
  for (const [axis, low, high, size] of [['x', 'left', 'right', 'width'], ['y', 'top', 'bottom', 'height']]) {
    const start = moduleEdgeMatch(rect, targets, axis, low, rect[low], gap, previous[axis]);
    const end = moduleEdgeMatch(rect, targets, axis, high, rect[low] + rect[size], gap, previous[axis]);
    const candidates = [start, end].filter(Boolean);
    const match = candidates.find(item => previous[axis]?.side === item.side && previous[axis]?.kind === item.kind
      && sameTarget(previous[axis]?.target, item.target)) || candidates.sort((a, b) => a.distance - b.distance)[0];
    if (match) { matches[axis] = match; position[low] = match.value - (match.side === high ? rect[size] : 0); }
  }
  return { position, matches };
}

export function gridEdgeMatch(axis, side, value, origin = 0, step = 24, previous = null) {
  const retained = previous?.kind === 'grid' && previous.side === side
    && Math.abs(value - previous.value) <= EDGE_RELEASE_DISTANCE;
  return { axis, side, kind: 'grid', value: retained ? previous.value : origin + Math.round((value - origin) / step) * step };
}

export const nearestModuleEdge = (rect, targets, axis, side, value, gap = 0) =>
  moduleEdgeMatch(rect, targets, axis, side, value, gap)?.value ?? null;
export const snapModulePosition = (rect, targets, gap = 0) => modulePositionMatch(rect, targets, gap).position;
