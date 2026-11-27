// Cell dimensions belong to the shape, independently of camera and snap targets.
// Older partial-cell patches are preserved until an explicit size/spacing edit.
export function wholeGridCells(size, spacing, maximum = 7992) {
  const count = Math.max(1, Math.ceil(size / spacing - 1e-9));
  return Math.min(count, Math.max(1, Math.floor(maximum / spacing + 1e-9))) * spacing;
}

export function gridShapeFrame(frame, spacing, { edge = 'se', bounds } = {}) {
  const next = { ...frame };
  for (const [size, start, end, before, after] of [
    ['width', 'left', 'right', 'w', 'e'], ['height', 'top', 'bottom', 'n', 's'],
  ]) {
    if (!edge.includes(before) && !edge.includes(after)) continue;
    const reverse = edge.includes(before), anchor = frame[start] + (reverse ? frame[size] : 0);
    const maximum = bounds ? reverse ? anchor - bounds[start] : bounds[end] - anchor : 7992;
    // A full cell needs room on both sides of its anchor. At a constrained edge,
    // stop at the last complete cell rather than producing a clipped fragment.
    if (maximum < spacing) continue;
    next[size] = wholeGridCells(frame[size], spacing, maximum);
    next[start] = reverse ? anchor - next[size] : anchor;
  }
  return next;
}
