export const DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG = Object.freeze({
  horizontalMargin: 48,
  verticalMargin: 40,
  verticalArtworkScale: 0.72,
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

export function focusViewerPresentationDimensions(entry) {
  const dimensions = entry?.focusDimensions;
  if (!(dimensions?.width > 0 && dimensions?.height > 0)) return dimensions;
  const quarterTurns = entry?.placement?.transform?.quarterTurns || 0;
  return quarterTurns % 2 === 1
    ? Object.freeze({ width: dimensions.height, height: dimensions.width })
    : dimensions;
}

export function focusedViewerRectangle(originRectangle, viewport, config = DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG) {
  const origin = normalizeViewerRectangle(originRectangle, 'originRectangle');
  const viewportWidth = finitePositive(Number(viewport?.width), 'viewport.width');
  const viewportHeight = finitePositive(Number(viewport?.height), 'viewport.height');
  const horizontalMargin = Math.max(0, Number(config?.horizontalMargin));
  const verticalMargin = Math.max(0, Number(config?.verticalMargin));
  const verticalArtworkScale = Number(config?.verticalArtworkScale);
  if (!Number.isFinite(horizontalMargin) || !Number.isFinite(verticalMargin)) throw new TypeError('viewer margins must be finite');
  if (!Number.isFinite(verticalArtworkScale) || verticalArtworkScale <= 0 || verticalArtworkScale > 1) throw new TypeError('verticalArtworkScale must be between zero and one');

  const availableWidth = Math.max(1, viewportWidth - (horizontalMargin * 2));
  const availableHeight = Math.max(1, viewportHeight - (verticalMargin * 2)) * verticalArtworkScale;
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
