export const DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG = Object.freeze({
  horizontalMargin: 48,
  verticalMargin: 40,
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

export function viewerTransform(originRectangle, destinationRectangle) {
  const origin = normalizeViewerRectangle(originRectangle, 'originRectangle');
  const destination = normalizeViewerRectangle(destinationRectangle, 'destinationRectangle');
  const originCenterX = origin.left + (origin.width / 2);
  const originCenterY = origin.top + (origin.height / 2);
  const destinationCenterX = destination.left + (destination.width / 2);
  const destinationCenterY = destination.top + (destination.height / 2);
  const scale = destination.width / origin.width;
  return Object.freeze({
    x: destinationCenterX - originCenterX,
    y: destinationCenterY - originCenterY,
    scale,
  });
}
