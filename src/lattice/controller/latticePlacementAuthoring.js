const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const GUIDE_PRIORITY = Object.freeze({ artwork: 0, artboard: 1, grid: 2 });
const ANCHOR_FRACTIONS = Object.freeze([0, 0.5, 1]);

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
    snapState: { x: null, y: null },
    guides: [],
    activated: false,
  };
}

function guideKindEnabled(kind, options) {
  return kind === 'grid' ? options.gridSnap : options.smartGuides;
}

function axisCandidates(axis, gesture, options) {
  const candidates = [];
  if (options.smartGuides) {
    for (const placement of options.otherPlacements || []) {
      if (placement.id === gesture.placementId) continue;
      const bounds = placementBounds(placement);
      const start = axis === 'x' ? bounds.x : bounds.y;
      const size = axis === 'x' ? bounds.width : bounds.height;
      ANCHOR_FRACTIONS.forEach((fraction) => candidates.push({
        kind: 'artwork',
        position: start + (size * fraction),
        sourcePlacementId: placement.id,
      }));
    }
    ANCHOR_FRACTIONS.forEach((fraction, anchorIndex) => candidates.push({
      allowedAnchorIndex: anchorIndex,
      kind: 'artboard',
      position: fraction,
      sourcePlacementId: null,
    }));
  }
  if (options.gridSnap) {
    const divisions = axis === 'x' ? options.geometry?.columns : options.geometry?.rows;
    if (Number.isSafeInteger(divisions) && divisions > 0) {
      for (let index = 0; index <= divisions; index += 1) {
        candidates.push({
          kind: 'grid',
          position: index / divisions,
          sourcePlacementId: null,
        });
      }
    }
  }
  return candidates;
}

function guideComparison(first, second) {
  return first.distance - second.distance
    || GUIDE_PRIORITY[first.kind] - GUIDE_PRIORITY[second.kind]
    || first.position - second.position
    || first.anchorIndex - second.anchorIndex
    || String(first.sourcePlacementId || '').localeCompare(String(second.sourcePlacementId || ''));
}

function acquireAxisGuide(axis, rawStart, size, gesture, options, axisPixels) {
  const matches = [];
  for (const candidate of axisCandidates(axis, gesture, options)) {
    ANCHOR_FRACTIONS.forEach((fraction, anchorIndex) => {
      if (candidate.allowedAnchorIndex !== undefined && candidate.allowedAnchorIndex !== anchorIndex) return;
      const snappedStart = candidate.position - (size * fraction);
      if (snappedStart < 0 || snappedStart > 1 - size) return;
      const distance = Math.abs(snappedStart - rawStart) * axisPixels;
      if (distance > options.guideThreshold) return;
      matches.push({
        ...candidate,
        anchorFraction: fraction,
        anchorIndex,
        distance,
        snappedStart,
      });
    });
  }
  return matches.sort(guideComparison)[0] || null;
}

function resolveAxisGuide(axis, rawStart, size, gesture, options, axisPixels) {
  const existing = gesture.snapState?.[axis];
  if (existing && guideKindEnabled(existing.kind, options)) {
    const rawAnchor = rawStart + (size * existing.anchorFraction);
    const releaseDistance = Math.abs(existing.position - rawAnchor) * axisPixels;
    if (releaseDistance <= options.guideReleaseThreshold) {
      return { start: existing.position - (size * existing.anchorFraction), guide: existing };
    }
  }
  const acquired = acquireAxisGuide(axis, rawStart, size, gesture, options, axisPixels);
  return acquired
    ? { start: acquired.snappedStart, guide: acquired }
    : { start: rawStart, guide: null };
}

export function updatePlacementGesture(
  gesture,
  point,
  artboardRectangle,
  deadZone,
  guideOptions = {},
) {
  assertArtboardRectangle(artboardRectangle);
  const delta = {
    x: point.x - gesture.origin.x,
    y: point.y - gesture.origin.y,
  };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };

  const rawBounds = {
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
  options.guideReleaseThreshold = Math.max(
    options.guideThreshold,
    options.guideReleaseThreshold,
  );
  if (options.bypass || (!options.smartGuides && !options.gridSnap)) {
    return {
      ...gesture,
      activated: true,
      previewBounds: rawBounds,
      snapState: { x: null, y: null },
      guides: [],
    };
  }

  const horizontal = Math.abs(delta.x) > Number.EPSILON
    ? resolveAxisGuide('x', rawBounds.x, rawBounds.width, gesture, options, artboardRectangle.width)
    : { start: rawBounds.x, guide: null };
  const vertical = Math.abs(delta.y) > Number.EPSILON
    ? resolveAxisGuide('y', rawBounds.y, rawBounds.height, gesture, options, artboardRectangle.height)
    : { start: rawBounds.y, guide: null };
  const snapState = { x: horizontal.guide, y: vertical.guide };
  return {
    ...gesture,
    activated: true,
    previewBounds: { ...rawBounds, x: horizontal.start, y: vertical.start },
    snapState,
    guides: Object.entries(snapState)
      .filter(([, guide]) => guide)
      .map(([axis, guide]) => ({
        axis,
        kind: guide.kind,
        position: guide.position,
        sourcePlacementId: guide.sourcePlacementId,
      })),
  };
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
