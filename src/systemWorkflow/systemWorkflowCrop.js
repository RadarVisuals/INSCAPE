import { exact } from '../text/domain/article.js';
import { isSystemWorkflowGridCoordinate } from './domain/systemWorkflowDraft.js';
import {
  cropFocusBounds,
  normalizeCropForMask,
} from '../lattice/rendering/latticeCrop.js';
import { projectSystemWorkflowTransform, unprojectSystemWorkflowCrop } from './systemWorkflowTransform.js';

export const SYSTEM_WORKFLOW_CROP_DEAD_ZONE = 10;
export const SYSTEM_WORKFLOW_CROP_MIN_ZOOM = 1;
export const SYSTEM_WORKFLOW_CROP_MAX_ZOOM = 4;
export const SYSTEM_WORKFLOW_DEFAULT_CROP = Object.freeze({ x: 0.5, y: 0.5, zoom: 1 });

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function cropError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function requirePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw cropError('SYSTEM_WORKFLOW_CROP_POINT_INVALID', 'Crop authoring requires a finite pointer point');
  }
  return point;
}

function requireMedia(media) {
  if (!media || typeof media.stableAssetId !== 'string'
    || !Number.isSafeInteger(media.width) || media.width <= 0
    || !Number.isSafeInteger(media.height) || media.height <= 0) {
    throw cropError('SYSTEM_WORKFLOW_CROP_MEDIA_INVALID', 'Crop authoring requires canonical media identity and native dimensions');
  }
  return { stableAssetId: media.stableAssetId, width: media.width, height: media.height };
}

function exactCrop(value, minimumZoom = SYSTEM_WORKFLOW_CROP_MIN_ZOOM) {
  return exact(value, ['x', 'y', 'zoom'])
    && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    && Number.isFinite(value.zoom)
    && value.zoom >= minimumZoom
    && value.zoom <= SYSTEM_WORKFLOW_CROP_MAX_ZOOM;
}

export function sameSystemWorkflowCrop(left, right) {
  if (left === null || right === null) return left === right;
  return Boolean(exactCrop(left) && exactCrop(right)
    && left.x === right.x && left.y === right.y && left.zoom === right.zoom);
}

export function systemWorkflowCropMask(placement) {
  const columnSpan = placement?.columnSpan;
  const rowSpan = placement?.rowSpan;
  if (!isSystemWorkflowGridCoordinate(columnSpan) || columnSpan <= 0
    || !isSystemWorkflowGridCoordinate(rowSpan) || rowSpan <= 0) {
    throw cropError('SYSTEM_WORKFLOW_CROP_GEOMETRY_INVALID', 'Crop authoring requires positive grid-native placement geometry');
  }
  return { left: 0, top: 0, width: placement.mediaFrameRatio === undefined ? columnSpan : rowSpan * placement.mediaFrameRatio, height: rowSpan };
}

export function createSystemWorkflowCropSession(placement, mediaInput, maskInput, { minimumZoom = SYSTEM_WORKFLOW_CROP_MIN_ZOOM, fit } = {}) {
  const media = requireMedia(mediaInput);
  const mask = maskInput || systemWorkflowCropMask(placement);
  const startCrop = placement?.crop === null ? null : { ...placement.crop };
  if (!(startCrop === null || exactCrop(startCrop, minimumZoom))) {
    throw cropError('SYSTEM_WORKFLOW_CROP_START_INVALID', 'Crop authoring requires a canonical starting crop');
  }
  const projected = projectSystemWorkflowTransform(
    placement?.transform,
    media,
    startCrop || SYSTEM_WORKFLOW_DEFAULT_CROP,
  );
  let visualCrop = projected.crop;
  if (startCrop === null && fit) {
    const x = mask.width / projected.dimensions.width, y = mask.height / projected.dimensions.height;
    visualCrop = { ...visualCrop, zoom: Math.max(minimumZoom, Math.min(x, y) / Math.max(x, y)) };
  }
  visualCrop = normalizeCropForMask(visualCrop, mask, projected.dimensions);
  return {
    placementId: placement.id,
    startCrop,
    previewCrop: unprojectSystemWorkflowCrop(placement?.transform, visualCrop),
    media,
    mask,
    dirty: startCrop === null,
  };
}

export function createSystemWorkflowCropPanGesture(session, pointInput) {
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

export function updateSystemWorkflowCropPanGesture(
  gesture,
  pointInput,
  deadZone = SYSTEM_WORKFLOW_CROP_DEAD_ZONE,
) {
  const point = requirePoint(pointInput);
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw cropError('SYSTEM_WORKFLOW_CROP_DEAD_ZONE_INVALID', 'Crop authoring requires a non-negative pointer dead zone');
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

export function finishSystemWorkflowCropPanGesture(gesture, { cancelled = false } = {}) {
  return {
    changed: Boolean(gesture?.activated && !cancelled),
    crop: { ...(cancelled ? gesture.startCrop : gesture.previewCrop) },
  };
}

export function nudgeSystemWorkflowCrop(crop, mediaInput, mask, delta) {
  const media = requireMedia(mediaInput);
  if (!delta || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw cropError('SYSTEM_WORKFLOW_CROP_DELTA_INVALID', 'Crop keyboard pan requires a finite normalized delta');
  }
  const normalized = normalizeCropForMask(crop, mask, media);
  const bounds = cropFocusBounds(mask, media, normalized.zoom);
  return {
    x: clamp(normalized.x + delta.x, bounds.x.minimum, bounds.x.maximum),
    y: clamp(normalized.y + delta.y, bounds.y.minimum, bounds.y.maximum),
    zoom: normalized.zoom,
  };
}

export function setSystemWorkflowCropZoom(crop, mediaInput, mask, zoomInput, minimumZoom = SYSTEM_WORKFLOW_CROP_MIN_ZOOM) {
  const media = requireMedia(mediaInput);
  if (!Number.isFinite(zoomInput)) {
    throw cropError('SYSTEM_WORKFLOW_CROP_ZOOM_INVALID', 'Crop zoom must be finite');
  }
  const zoom = clamp(zoomInput, minimumZoom, SYSTEM_WORKFLOW_CROP_MAX_ZOOM);
  return normalizeCropForMask({ ...crop, zoom }, mask, media);
}

export function reframeSystemWorkflowCropForMask(crop, mediaInput, previousMask, nextMask, {
  originDelta = { x: 0, y: 0 },
  renderedScale,
} = {}) {
  const media = requireMedia(mediaInput);
  const normalized = normalizeCropForMask(crop, previousMask, media);
  const previousBounds = cropFocusBounds(previousMask, media, normalized.zoom);
  const targetScale = renderedScale ?? (previousBounds.renderedSize.width / media.width);
  if (!Number.isFinite(targetScale) || targetScale <= 0
    || !Number.isFinite(originDelta?.x) || !Number.isFinite(originDelta?.y)) {
    throw cropError('SYSTEM_WORKFLOW_CROP_REFRAME_INVALID', 'Crop reframing requires finite scale and placement displacement');
  }
  const coverScale = Math.max(nextMask.width / media.width, nextMask.height / media.height);
  const zoom = clamp(targetScale / coverScale, SYSTEM_WORKFLOW_CROP_MIN_ZOOM, SYSTEM_WORKFLOW_CROP_MAX_ZOOM);
  const nextBounds = cropFocusBounds(nextMask, media, zoom);
  const previousLeft = previousMask.left + (previousMask.width / 2) - (normalized.x * previousBounds.renderedSize.width);
  const previousTop = previousMask.top + (previousMask.height / 2) - (normalized.y * previousBounds.renderedSize.height);
  return normalizeCropForMask({
    x: (nextMask.left + (nextMask.width / 2) - (previousLeft - originDelta.x)) / nextBounds.renderedSize.width,
    y: (nextMask.top + (nextMask.height / 2) - (previousTop - originDelta.y)) / nextBounds.renderedSize.height,
    zoom,
  }, nextMask, media);
}
