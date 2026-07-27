import { placementBounds } from './latticePlacementAuthoring.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const GUIDE_PRIORITY = Object.freeze({ artwork: 0, artboard: 1, grid: 2 });
const GUIDE_FRACTIONS = Object.freeze([0, 0.5, 1]);

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
    snapState: null,
    guides: [],
    activated: false,
  };
}

function guideKindEnabled(kind, options) {
  return kind === 'grid' ? options.gridSnap : options.smartGuides;
}

function resizeGuideCandidates(axis, gesture, options) {
  const candidates = [];
  if (options.smartGuides) {
    for (const placement of options.otherPlacements || []) {
      if (placement.id === gesture.placementId) continue;
      const bounds = placementBounds(placement);
      const start = axis === 'x' ? bounds.x : bounds.y;
      const size = axis === 'x' ? bounds.width : bounds.height;
      GUIDE_FRACTIONS.forEach((fraction) => candidates.push({
        axis,
        kind: 'artwork',
        position: start + (size * fraction),
        sourcePlacementId: placement.id,
      }));
    }
    GUIDE_FRACTIONS.forEach((position) => candidates.push({
      axis,
      kind: 'artboard',
      position,
      sourcePlacementId: null,
    }));
  }
  if (options.gridSnap) {
    const divisions = axis === 'x' ? options.geometry?.columns : options.geometry?.rows;
    if (Number.isSafeInteger(divisions) && divisions > 0) {
      for (let index = 0; index <= divisions; index += 1) {
        candidates.push({ axis, kind: 'grid', position: index / divisions, sourcePlacementId: null });
      }
    }
  }
  return candidates;
}

function candidateScale(candidate, gesture) {
  const startSize = candidate.axis === 'x' ? gesture.startBounds.width : gesture.startBounds.height;
  return (candidate.position - gesture.anchor[candidate.axis])
    / (gesture.signs[candidate.axis] * startSize);
}

function guideDistance(candidate, rawScale, gesture, artboard) {
  const axis = candidate.axis;
  const startSize = axis === 'x' ? gesture.startBounds.width : gesture.startBounds.height;
  const movingEdge = gesture.anchor[axis] + (gesture.signs[axis] * startSize * rawScale);
  return Math.abs(candidate.position - movingEdge) * artboard[axis === 'x' ? 'width' : 'height'];
}

function resolveResizeGuide(gesture, rawScale, minimumScale, maximumScale, artboard, options) {
  const existing = gesture.snapState;
  if (existing && guideKindEnabled(existing.kind, options)
    && guideDistance(existing, rawScale, gesture, artboard) <= options.guideReleaseThreshold) {
    return { scale: candidateScale(existing, gesture), guide: existing };
  }
  const matches = ['x', 'y'].flatMap((axis) => resizeGuideCandidates(axis, gesture, options))
    .map((candidate) => ({
      ...candidate,
      distance: guideDistance(candidate, rawScale, gesture, artboard),
      scale: candidateScale(candidate, gesture),
    }))
    .filter(({ distance, scale }) => distance <= options.guideThreshold
      && scale >= minimumScale && scale <= maximumScale)
    .sort((first, second) => first.distance - second.distance
      || GUIDE_PRIORITY[first.kind] - GUIDE_PRIORITY[second.kind]
      || first.axis.localeCompare(second.axis)
      || first.position - second.position
      || String(first.sourcePlacementId || '').localeCompare(String(second.sourcePlacementId || '')));
  const guide = matches[0] || null;
  return guide ? { scale: guide.scale, guide } : { scale: rawScale, guide: null };
}

export function updatePlacementResizeGesture(
  gesture,
  point,
  artboardRectangle,
  deadZone,
  minimumDisplayedPixels,
  guideOptions = {},
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
  const maximumScale = Math.min(maximumScaleX, maximumScaleY);
  const rawScale = clamp(projectedScale, minimumScale, maximumScale);
  const options = {
    smartGuides: false,
    gridSnap: false,
    bypass: false,
    geometry: null,
    otherPlacements: [],
    guideThreshold: 8,
    guideReleaseThreshold: 14,
    ...guideOptions,
  };
  options.guideReleaseThreshold = Math.max(options.guideThreshold, options.guideReleaseThreshold);
  const snapped = options.bypass || (!options.smartGuides && !options.gridSnap)
    ? { scale: rawScale, guide: null }
    : resolveResizeGuide(gesture, rawScale, minimumScale, maximumScale, artboard, options);
  const scale = snapped.scale;
  const width = gesture.startBounds.width * scale;
  const height = gesture.startBounds.height * scale;
  const previewBounds = {
    x: gesture.signs.x > 0 ? gesture.anchor.x : gesture.anchor.x - width,
    y: gesture.signs.y > 0 ? gesture.anchor.y : gesture.anchor.y - height,
    width,
    height,
  };
  return {
    ...gesture,
    activated: true,
    previewBounds,
    snapState: snapped.guide,
    guides: snapped.guide ? [{
      axis: snapped.guide.axis,
      kind: snapped.guide.kind,
      position: snapped.guide.position,
      sourcePlacementId: snapped.guide.sourcePlacementId,
    }] : [],
  };
}

export function finishPlacementResizeGesture(gesture, { cancelled = false } = {}) {
  return {
    committed: Boolean(gesture?.activated && !cancelled),
    bounds: { ...(cancelled ? gesture.startBounds : gesture.previewBounds) },
  };
}
