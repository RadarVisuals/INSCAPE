const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function assertBounds(bounds) {
  if (!bounds
    || !Number.isFinite(bounds.x) || bounds.x < 0 || bounds.x > 1
    || !Number.isFinite(bounds.y) || bounds.y < 0 || bounds.y > 1
    || !Number.isFinite(bounds.width) || bounds.width <= 0 || bounds.width > 1
    || !Number.isFinite(bounds.height) || bounds.height <= 0 || bounds.height > 1
    || bounds.x + bounds.width > 1
    || bounds.y + bounds.height > 1) {
    throw new TypeError('Placement authoring requires finite normalized bounds');
  }
  return bounds;
}

function assertArtboardRectangle(rectangle) {
  if (!rectangle
    || !Number.isFinite(rectangle.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle.height) || rectangle.height <= 0) {
    throw new TypeError('Placement authoring requires a projected artboard rectangle');
  }
  return rectangle;
}

export function placementBounds(placement) {
  return assertBounds({
    x: placement?.x,
    y: placement?.y,
    width: placement?.width,
    height: placement?.height,
  });
}

export function createPlacementGesture(placement, point) {
  const startBounds = placementBounds(placement);
  return {
    placementId: placement.id,
    origin: { x: point.x, y: point.y },
    startBounds: { ...startBounds },
    previewBounds: { ...startBounds },
    activated: false,
  };
}

export function updatePlacementGesture(gesture, point, artboardRectangle, deadZone) {
  assertArtboardRectangle(artboardRectangle);
  const delta = {
    x: point.x - gesture.origin.x,
    y: point.y - gesture.origin.y,
  };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };

  const previewBounds = {
    ...gesture.startBounds,
    x: clamp(
      gesture.startBounds.x + (delta.x / artboardRectangle.width),
      0,
      1 - gesture.startBounds.width,
    ),
    y: clamp(
      gesture.startBounds.y + (delta.y / artboardRectangle.height),
      0,
      1 - gesture.startBounds.height,
    ),
  };
  return { ...gesture, activated: true, previewBounds };
}

export function finishPlacementGesture(gesture, { cancelled = false } = {}) {
  return {
    committed: Boolean(gesture?.activated && !cancelled),
    bounds: { ...(cancelled ? gesture.startBounds : gesture.previewBounds) },
  };
}

export function nudgePlacementByPixels(placement, delta, artboardRectangle) {
  const bounds = placementBounds(placement);
  assertArtboardRectangle(artboardRectangle);
  return {
    ...bounds,
    x: clamp(bounds.x + (delta.x / artboardRectangle.width), 0, 1 - bounds.width),
    y: clamp(bounds.y + (delta.y / artboardRectangle.height), 0, 1 - bounds.height),
  };
}
