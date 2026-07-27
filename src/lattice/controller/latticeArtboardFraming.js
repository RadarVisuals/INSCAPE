import { clampLatticeArtboardOffset } from '../rendering/latticeGeometry.js';

function assertPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('Artboard framing requires a finite pointer point');
  }
  return point;
}

function assertBounds(bounds) {
  if (!bounds
    || !Number.isFinite(bounds.x) || bounds.x < 0
    || !Number.isFinite(bounds.y) || bounds.y < 0) {
    throw new TypeError('Artboard framing requires non-negative overflow bounds');
  }
  return bounds;
}

export function createArtboardFramingGesture(offset, point, bounds) {
  const boundedOffset = clampLatticeArtboardOffset(offset, assertBounds(bounds));
  return {
    origin: { ...assertPoint(point) },
    startOffset: { ...boundedOffset },
    previewOffset: { ...boundedOffset },
    activated: false,
  };
}

export function updateArtboardFramingGesture(gesture, point, bounds, deadZone) {
  const currentPoint = assertPoint(point);
  const limits = assertBounds(bounds);
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw new TypeError('Artboard framing requires a non-negative dead zone');
  }
  const delta = {
    x: currentPoint.x - gesture.origin.x,
    y: currentPoint.y - gesture.origin.y,
  };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };
  return {
    ...gesture,
    activated: true,
    previewOffset: clampLatticeArtboardOffset({
      x: gesture.startOffset.x + delta.x,
      y: gesture.startOffset.y + delta.y,
    }, limits),
  };
}

export function finishArtboardFramingGesture(gesture, { cancelled = false } = {}) {
  return {
    committed: Boolean(gesture?.activated && !cancelled),
    offset: { ...(cancelled ? gesture.startOffset : gesture.previewOffset) },
  };
}
