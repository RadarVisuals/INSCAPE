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
