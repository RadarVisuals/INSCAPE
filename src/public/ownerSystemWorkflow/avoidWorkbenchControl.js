// Companion windows may overlap artwork, but must leave its recovery control
// reachable. Keep the user's position unless it actually covers that control.
export function avoidWorkbenchControl(frame, control, bounds, gap = 8, minimumHeight = 64) {
  const overlaps = candidate => candidate.left < control.right + gap
    && candidate.left + candidate.width > control.left - gap
    && candidate.top < control.bottom + gap && candidate.top + candidate.height > control.top - gap;
  if (!overlaps(frame)) return frame;
  const candidates = [
    { ...frame, top: control.bottom + gap },
    { ...frame, top: control.top - gap - frame.height },
    { ...frame, left: control.left - gap - frame.width },
    { ...frame, left: control.right + gap },
  ].filter(candidate => candidate.left >= bounds.left && candidate.top >= bounds.top
    && candidate.left + candidate.width <= bounds.right && candidate.top + candidate.height <= bounds.bottom);
  candidates.sort((a, b) => Math.hypot(a.left - frame.left, a.top - frame.top) - Math.hypot(b.left - frame.left, b.top - frame.top));
  if (candidates.length) return candidates[0];
  // On narrow screens use the existing internal scroll area below/above the
  // controls instead of covering another button with the complete tool window.
  const below = bounds.bottom - control.bottom - gap, above = control.top - gap - bounds.top;
  if (below >= minimumHeight && below >= above) return { ...frame, top: control.bottom + gap, height: Math.min(frame.height, below) };
  if (above >= minimumHeight) return { ...frame, top: bounds.top, height: Math.min(frame.height, above) };
  return frame;
}
