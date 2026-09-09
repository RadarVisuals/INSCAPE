export function resolveVisitorGridDragDestination({ activeIndex, deltaX, deltaY, lastIndex, viewportWidth }) {
  if (![activeIndex, deltaX, deltaY, lastIndex, viewportWidth].every(Number.isFinite)
    || !Number.isInteger(activeIndex) || !Number.isInteger(lastIndex) || lastIndex < 0
    || activeIndex < 0 || activeIndex > lastIndex || viewportWidth <= 0) return null;
  const horizontal = Math.abs(deltaX);
  if (horizontal <= Math.abs(deltaY) * 1.35) return null;
  const threshold = Math.min(120, Math.max(64, viewportWidth * .08));
  if (horizontal < threshold) return null;
  if (deltaX < 0 && activeIndex < lastIndex) return activeIndex + 1;
  if (deltaX > 0 && activeIndex > 0) return activeIndex - 1;
  return null;
}
