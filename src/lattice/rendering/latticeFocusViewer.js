export const DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG = Object.freeze({
  horizontalMargin: 48,
  verticalMargin: 40,
  browseDuration: 240,
  swipeThreshold: 48,
  swipeDominance: 1.25,
  wheelAccumulationThreshold: 80,
  wheelCooldown: 320,
});

function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} must be a positive finite number`);
  return value;
}

export function normalizeViewerRectangle(rectangle, label = 'rectangle') {
  if (!rectangle || typeof rectangle !== 'object') throw new TypeError(`${label} is required`);
  const left = Number(rectangle.left);
  const top = Number(rectangle.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) throw new TypeError(`${label} position must be finite`);
  return Object.freeze({
    left,
    top,
    width: finitePositive(Number(rectangle.width), `${label}.width`),
    height: finitePositive(Number(rectangle.height), `${label}.height`),
  });
}

export function focusedViewerRectangle(originRectangle, viewport, config = DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG) {
  const origin = normalizeViewerRectangle(originRectangle, 'originRectangle');
  const viewportWidth = finitePositive(Number(viewport?.width), 'viewport.width');
  const viewportHeight = finitePositive(Number(viewport?.height), 'viewport.height');
  const horizontalMargin = Math.max(0, Number(config?.horizontalMargin));
  const verticalMargin = Math.max(0, Number(config?.verticalMargin));
  if (!Number.isFinite(horizontalMargin) || !Number.isFinite(verticalMargin)) throw new TypeError('viewer margins must be finite');

  const availableWidth = Math.max(1, viewportWidth - (horizontalMargin * 2));
  const availableHeight = Math.max(1, viewportHeight - (verticalMargin * 2));
  const scale = Math.min(availableWidth / origin.width, availableHeight / origin.height);
  const width = origin.width * scale;
  const height = origin.height * scale;

  return Object.freeze({
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
    width,
    height,
  });
}

export function orderedFocusViewerEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError('viewer entries must be an array');
  return [...entries].sort((left, right) => {
    const leftOrder = Number(left?.placement?.navigationOrder);
    const rightOrder = Number(right?.placement?.navigationOrder);
    if (!Number.isSafeInteger(leftOrder) || !Number.isSafeInteger(rightOrder)) {
      throw new TypeError('viewer entry navigationOrder must be a safe integer');
    }
    return leftOrder - rightOrder
      || String(left.placement.id).localeCompare(String(right.placement.id));
  });
}

export function focusViewerDestination(entries, currentPlacementId, direction) {
  const ordered = orderedFocusViewerEntries(entries);
  if (!ordered.length) return null;
  if (direction !== -1 && direction !== 1) throw new TypeError('viewer navigation direction must be -1 or 1');
  const currentIndex = ordered.findIndex(({ placement }) => placement.id === currentPlacementId);
  if (currentIndex < 0) throw new RangeError('current viewer placement is not present');
  return ordered[(currentIndex + direction + ordered.length) % ordered.length];
}
