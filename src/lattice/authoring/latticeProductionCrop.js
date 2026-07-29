import {
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from '../domain/latticeProductionDraft.js';
import {
  cropFocusBounds,
  normalizeCropForMask,
} from '../rendering/latticeCrop.js';
import { projectArtworkMat } from '../rendering/latticeMat.js';
import { sameLatticeProductionPlacementSnapshot } from './latticeProductionRemoval.js';

export const LATTICE_PRODUCTION_CROP_DEAD_ZONE = 10;
export const LATTICE_PRODUCTION_CROP_MIN_ZOOM = 1;
export const LATTICE_PRODUCTION_CROP_MAX_ZOOM = 4;
export const LATTICE_PRODUCTION_CROP_ZOOM_STEP = 0.05;
export const LATTICE_PRODUCTION_DEFAULT_CROP = Object.freeze({ x: 0.5, y: 0.5, zoom: 1 });

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function cropError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function requirePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw cropError('LATTICE_CROP_POINT_INVALID', 'Crop authoring requires a finite pointer point');
  }
  return point;
}

function requireMedia(media) {
  if (!media || typeof media.stableAssetId !== 'string'
    || !Number.isSafeInteger(media.width) || media.width <= 0
    || !Number.isSafeInteger(media.height) || media.height <= 0) {
    throw cropError('LATTICE_CROP_MEDIA_INVALID', 'Crop authoring requires canonical media identity and native dimensions');
  }
  return { stableAssetId: media.stableAssetId, width: media.width, height: media.height };
}

function exactCrop(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 3
    && Object.hasOwn(value, 'x') && Object.hasOwn(value, 'y') && Object.hasOwn(value, 'zoom')
    && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    && Number.isFinite(value.zoom)
    && value.zoom >= LATTICE_PRODUCTION_CROP_MIN_ZOOM
    && value.zoom <= LATTICE_PRODUCTION_CROP_MAX_ZOOM;
}

export function sameLatticeProductionCrop(left, right) {
  if (left === null || right === null) return left === right;
  return Boolean(exactCrop(left) && exactCrop(right)
    && left.x === right.x && left.y === right.y && left.zoom === right.zoom);
}

export function latticeProductionCropMask(placement) {
  const columnSpan = placement?.columnSpan;
  const rowSpan = placement?.rowSpan;
  if (!Number.isSafeInteger(columnSpan) || columnSpan < 1
    || !Number.isSafeInteger(rowSpan) || rowSpan < 1) {
    throw cropError('LATTICE_CROP_GEOMETRY_INVALID', 'Crop authoring requires positive grid-native placement geometry');
  }
  return projectArtworkMat({ left: 0, top: 0, width: columnSpan, height: rowSpan }, placement.mat)
    .mediaOpeningRectangle;
}

export function createLatticeProductionCropSession(placement, mediaInput, maskInput = null) {
  const media = requireMedia(mediaInput);
  const mask = maskInput || latticeProductionCropMask(placement);
  const startCrop = placement?.crop === null ? null : { ...placement.crop };
  if (!(startCrop === null || exactCrop(startCrop))) {
    throw cropError('LATTICE_CROP_START_INVALID', 'Crop authoring requires a canonical starting crop');
  }
  return {
    placementId: placement.id,
    startCrop,
    previewCrop: normalizeCropForMask(startCrop || LATTICE_PRODUCTION_DEFAULT_CROP, mask, media),
    media,
    mask,
    dirty: startCrop === null,
  };
}

export function createLatticeProductionCropPanGesture(session, pointInput) {
  const point = requirePoint(pointInput);
  const bounds = cropFocusBounds(session.mask, session.media, session.previewCrop.zoom);
  return {
    origin: { ...point },
    startCrop: { ...session.previewCrop },
    previewCrop: { ...session.previewCrop },
    bounds,
    activated: false,
  };
}

export function updateLatticeProductionCropPanGesture(
  gesture,
  pointInput,
  deadZone = LATTICE_PRODUCTION_CROP_DEAD_ZONE,
) {
  const point = requirePoint(pointInput);
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw cropError('LATTICE_CROP_DEAD_ZONE_INVALID', 'Crop authoring requires a non-negative pointer dead zone');
  }
  const delta = { x: point.x - gesture.origin.x, y: point.y - gesture.origin.y };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };
  return {
    ...gesture,
    activated: true,
    previewCrop: {
      x: clamp(
        gesture.startCrop.x - (delta.x / gesture.bounds.renderedSize.width),
        gesture.bounds.x.minimum,
        gesture.bounds.x.maximum,
      ),
      y: clamp(
        gesture.startCrop.y - (delta.y / gesture.bounds.renderedSize.height),
        gesture.bounds.y.minimum,
        gesture.bounds.y.maximum,
      ),
      zoom: gesture.startCrop.zoom,
    },
  };
}

export function finishLatticeProductionCropPanGesture(gesture, { cancelled = false } = {}) {
  return {
    changed: Boolean(gesture?.activated && !cancelled),
    crop: { ...(cancelled ? gesture.startCrop : gesture.previewCrop) },
  };
}

export function nudgeLatticeProductionCrop(crop, mediaInput, mask, delta) {
  const media = requireMedia(mediaInput);
  if (!delta || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw cropError('LATTICE_CROP_DELTA_INVALID', 'Crop keyboard pan requires a finite normalized delta');
  }
  const normalized = normalizeCropForMask(crop, mask, media);
  const bounds = cropFocusBounds(mask, media, normalized.zoom);
  return {
    x: clamp(normalized.x + delta.x, bounds.x.minimum, bounds.x.maximum),
    y: clamp(normalized.y + delta.y, bounds.y.minimum, bounds.y.maximum),
    zoom: normalized.zoom,
  };
}

export function setLatticeProductionCropZoom(crop, mediaInput, mask, zoomInput) {
  const media = requireMedia(mediaInput);
  if (!Number.isFinite(zoomInput)) {
    throw cropError('LATTICE_CROP_ZOOM_INVALID', 'Crop zoom must be finite');
  }
  const zoom = clamp(zoomInput, LATTICE_PRODUCTION_CROP_MIN_ZOOM, LATTICE_PRODUCTION_CROP_MAX_ZOOM);
  return normalizeCropForMask({ ...crop, zoom }, mask, media);
}

export function createLatticeProductionCropCandidate(draftInput, {
  crop,
  expectedMedia,
  expectedPlacement,
  media: mediaInput,
  placementId,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw cropError('LATTICE_CROP_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw cropError('LATTICE_CROP_TABLE_PRIVATE', 'Crop authoring is unavailable on a private table');
  }
  const placement = table.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw cropError('LATTICE_CROP_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (!sameLatticeProductionPlacementSnapshot(placement, expectedPlacement)) {
    throw cropError('LATTICE_CROP_PLACEMENT_STALE', 'The canonical placement changed before crop authoring completed');
  }
  if (placement.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw cropError('LATTICE_CROP_PLACEMENT_PRIVATE', 'Private placements cannot be cropped through the public owner projection');
  }
  if (placement.locked) throw cropError('LATTICE_CROP_PLACEMENT_LOCKED', 'The canonical placement is locked');

  const media = requireMedia(mediaInput);
  const expected = requireMedia(expectedMedia);
  if (media.stableAssetId !== placement.stableAssetId
    || expected.stableAssetId !== placement.stableAssetId
    || media.stableAssetId !== expected.stableAssetId
    || media.width !== expected.width || media.height !== expected.height) {
    throw cropError('LATTICE_CROP_MEDIA_STALE', 'The canonical crop media identity or native dimensions changed');
  }
  if (sameLatticeProductionCrop(placement.crop, crop)) return null;
  if (crop !== null) {
    if (!exactCrop(crop)) throw cropError('LATTICE_CROP_VALUE_INVALID', 'The completed crop is not canonical');
    const bounds = cropFocusBounds(latticeProductionCropMask(placement), media, crop.zoom);
    const epsilon = 1e-12;
    if (crop.x < bounds.x.minimum - epsilon || crop.x > bounds.x.maximum + epsilon
      || crop.y < bounds.y.minimum - epsilon || crop.y > bounds.y.maximum + epsilon) {
      throw cropError('LATTICE_CROP_COVERAGE_INVALID', 'The completed crop would expose an edge of the media opening');
    }
  }
  placement.crop = crop === null ? null : { ...crop };
  return assertValidLatticeProductionDraft(draft);
}
