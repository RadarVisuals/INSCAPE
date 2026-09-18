export const EDGE_SNAP_DISTANCE = 8;
// Rectangles use viewport pixels; gaps measure visible boundaries, not editor chrome.
export function nearestModuleEdge(rect, targets, axis, side, value, gap = 0) {
  let result = null, distance = EDGE_SNAP_DISTANCE + .001;
  const horizontal = axis === 'x';
  const low = horizontal ? 'left' : 'top';
  const acrossLow = horizontal ? 'top' : 'left', acrossSize = horizontal ? 'height' : 'width';
  for (const target of targets) {
    if (rect[acrossLow] > target[acrossLow] + target[acrossSize] + gap + EDGE_SNAP_DISTANCE
      || target[acrossLow] > rect[acrossLow] + rect[acrossSize] + gap + EDGE_SNAP_DISTANCE) continue;
    const end = target[low] + target[horizontal ? 'width' : 'height'];
    const values = side === low ? [target[low], end + gap] : [end, target[low] - gap];
    for (const next of values) if (Math.abs(next - value) < distance) { distance = Math.abs(next - value); result = next; }
  }
  return result;
}
export function snapModulePosition(rect, targets, gap = 0) {
  const result = {};
  for (const [axis, low, high, size] of [['x', 'left', 'right', 'width'], ['y', 'top', 'bottom', 'height']]) {
    const start = nearestModuleEdge(rect, targets, axis, low, rect[low], gap);
    const end = nearestModuleEdge(rect, targets, axis, high, rect[low] + rect[size], gap);
    if (start !== null || end !== null) result[low] = start !== null && (end === null || Math.abs(start - rect[low]) <= Math.abs(end - rect[low] - rect[size])) ? start : end - rect[size];
  }
  return result;
}
