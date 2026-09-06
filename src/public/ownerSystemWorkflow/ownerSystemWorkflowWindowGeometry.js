const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

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
