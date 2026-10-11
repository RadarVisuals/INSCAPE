const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const WORKBENCH_RESIZE_EDGES = [['nw', 'top left'], ['n', 'top'], ['ne', 'top right'], ['e', 'right'],
  ['se', ''], ['s', 'bottom'], ['sw', 'bottom left'], ['w', 'left']];

// Centre screen-sized targets on their visible marks. On tiny surfaces, leave
// the middle available for movement while keeping the entire mark clickable.
// Targets may move inward at a viewport boundary; offscreen edges stay offscreen.
export function workbenchResizeControl(edge, screen, viewport) {
  const x = edge.includes('w') ? 0 : edge.includes('e') ? screen.width : screen.width / 2;
  const y = edge.includes('n') ? 0 : edge.includes('s') ? screen.height : screen.height / 2;
  const inset = span => Math.min(14, Math.max(4, span / 4));
  const outsideX = edge.includes('w') ? 28 - inset(screen.width) : edge.includes('e') ? inset(screen.width) : 14;
  const outsideY = edge.includes('n') ? 28 - inset(screen.height) : edge.includes('s') ? inset(screen.height) : 14;
  const reachable = (point, outside, limit) => point < 0 || point > limit ? point - outside : Math.max(0, Math.min(limit - 28, point - outside));
  const left = reachable(screen.left + x, outsideX, viewport.width) - screen.left;
  const top = reachable(screen.top + y, outsideY, viewport.height) - screen.top;
  return { left, top, '--resize-mark-x': `${x - left - 4}px`, '--resize-mark-y': `${y - top - 4}px` };
}

export function resizeWorkbenchWindow(frame, edge, delta, minimum, bounds, snap) {
  const next = { ...frame };
  for (const [axis, key, start, end, before, after] of [
    ['x', 'width', 'left', 'right', 'w', 'e'], ['y', 'height', 'top', 'bottom', 'n', 's'],
  ]) {
    const reverse = edge.includes(before);
    if (!reverse && !edge.includes(after)) continue;
    const anchor = frame[start] + (reverse ? frame[key] : 0);
    const moving = frame[start] + (reverse ? 0 : frame[key]) + delta[axis];
    const snapped = snap?.(axis, reverse ? start : end, moving) ?? moving;
    const available = Math.max(1, reverse ? anchor - bounds[start] : bounds[end] - anchor);
    next[key] = Math.min(available, Math.max(Math.min(minimum[key], available), reverse ? anchor - snapped : snapped - anchor));
    next[start] = reverse ? anchor - next[key] : anchor;
  }
  return next;
}

export function clampOwnerSystemWorkflowWindowPosition(position, size, viewport, margin = 8) {
  const safeMargin = Math.max(0, finite(margin, 8));
  const width = Math.max(1, finite(viewport?.width, 1));
  const height = Math.max(1, finite(viewport?.height, 1));
  const windowWidth = Math.max(1, finite(size?.width, 1));
  const windowHeight = Math.max(1, finite(size?.height, 1));
  const maximumX = Math.max(safeMargin, width - windowWidth - safeMargin);
  const maximumY = Math.max(safeMargin, height - windowHeight - safeMargin);
  return Object.freeze({
    x: Math.min(maximumX, Math.max(safeMargin, finite(position?.x, safeMargin))),
    y: Math.min(maximumY, Math.max(safeMargin, finite(position?.y, safeMargin))),
  });
}

export function clampOwnerSystemWorkflowWindowHeight(candidate, top, viewportHeight, {
  margin = 8,
  minimum = 68,
} = {}) {
  const safeMargin = Math.max(0, finite(margin, 8));
  const minimumHeight = Math.max(68, finite(minimum, 68));
  const available = Math.max(68, finite(viewportHeight, 700) - finite(top, 0) - safeMargin);
  return Math.min(available, Math.max(Math.min(minimumHeight, available), finite(candidate, minimumHeight)));
}

export function presentationBoardAdjacentWindowGeometry(board, viewport, {
  chromeGutter = 6,
  margin = 8,
  width = 320,
} = {}) {
  const gutter = Math.max(0, finite(chromeGutter, 6));
  const height = Math.max(68, finite(board?.height, 68) + gutter);
  const position = clampOwnerSystemWorkflowWindowPosition({
    x: finite(board?.right, margin) + (2 * gutter),
    y: finite(board?.top, margin),
  }, { height, width }, viewport, margin);
  return Object.freeze({ height, position });
}
