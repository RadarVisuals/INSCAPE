import { placementBounds } from './latticePlacementAuthoring.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const PLACEMENT_RESIZE_CORNERS = Object.freeze(['nw', 'ne', 'se', 'sw']);

const CORNER_SIGNS = Object.freeze({
  nw: Object.freeze({ x: -1, y: -1 }),
  ne: Object.freeze({ x: 1, y: -1 }),
  se: Object.freeze({ x: 1, y: 1 }),
  sw: Object.freeze({ x: -1, y: 1 }),
});

function assertPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('Placement resizing requires a finite pointer point');
  }
  return point;
}

function assertArtboardRectangle(rectangle) {
  if (!rectangle
    || !Number.isFinite(rectangle.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle.height) || rectangle.height <= 0) {
    throw new TypeError('Placement resizing requires a projected artboard rectangle');
  }
  return rectangle;
}

function assertCorner(corner) {
  if (!PLACEMENT_RESIZE_CORNERS.includes(corner)) {
    throw new TypeError('Placement resizing requires a canonical corner');
  }
  return corner;
}

export function createPlacementResizeGesture(placement, corner, point, artboardRectangle) {
  const startBounds = placementBounds(placement);
  const artboard = assertArtboardRectangle(artboardRectangle);
  const signs = CORNER_SIGNS[assertCorner(corner)];
  const origin = assertPoint(point);
  const anchor = {
    x: signs.x > 0 ? startBounds.x : startBounds.x + startBounds.width,
    y: signs.y > 0 ? startBounds.y : startBounds.y + startBounds.height,
  };
  const startVector = {
    x: signs.x * startBounds.width * artboard.width,
    y: signs.y * startBounds.height * artboard.height,
  };
  return {
    placementId: placement.id,
    corner,
    signs,
    anchor,
    origin: { ...origin },
    startVector,
    startBounds: { ...startBounds },
    previewBounds: { ...startBounds },
    activated: false,
  };
}

export function updatePlacementResizeGesture(
  gesture,
  point,
  artboardRectangle,
  deadZone,
  minimumDisplayedPixels,
) {
  const artboard = assertArtboardRectangle(artboardRectangle);
  const currentPoint = assertPoint(point);
  if (!Number.isFinite(deadZone) || deadZone < 0
    || !Number.isFinite(minimumDisplayedPixels) || minimumDisplayedPixels <= 0) {
    throw new TypeError('Placement resizing requires valid interaction limits');
  }
  const delta = {
    x: currentPoint.x - gesture.origin.x,
    y: currentPoint.y - gesture.origin.y,
  };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };

  const currentVector = {
    x: gesture.startVector.x + delta.x,
    y: gesture.startVector.y + delta.y,
  };
  const vectorLengthSquared = (gesture.startVector.x ** 2) + (gesture.startVector.y ** 2);
  const projectedScale = (
    (currentVector.x * gesture.startVector.x)
    + (currentVector.y * gesture.startVector.y)
  ) / vectorLengthSquared;
  const startWidthPixels = gesture.startBounds.width * artboard.width;
  const startHeightPixels = gesture.startBounds.height * artboard.height;
  const minimumScale = minimumDisplayedPixels / Math.min(startWidthPixels, startHeightPixels);
  const maximumScaleX = gesture.signs.x > 0
    ? (1 - gesture.anchor.x) / gesture.startBounds.width
    : gesture.anchor.x / gesture.startBounds.width;
  const maximumScaleY = gesture.signs.y > 0
    ? (1 - gesture.anchor.y) / gesture.startBounds.height
    : gesture.anchor.y / gesture.startBounds.height;
  const scale = clamp(projectedScale, minimumScale, Math.min(maximumScaleX, maximumScaleY));
  const width = gesture.startBounds.width * scale;
  const height = gesture.startBounds.height * scale;
  const previewBounds = {
    x: gesture.signs.x > 0 ? gesture.anchor.x : gesture.anchor.x - width,
    y: gesture.signs.y > 0 ? gesture.anchor.y : gesture.anchor.y - height,
    width,
    height,
  };
  return { ...gesture, activated: true, previewBounds };
}

export function finishPlacementResizeGesture(gesture, { cancelled = false } = {}) {
  return {
    committed: Boolean(gesture?.activated && !cancelled),
    bounds: { ...(cancelled ? gesture.startBounds : gesture.previewBounds) },
  };
}
