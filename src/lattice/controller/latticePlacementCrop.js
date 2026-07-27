import { placementBounds } from './latticePlacementAuthoring.js';
import {
  cropFocusBounds,
  normalizeCropForMask,
} from '../rendering/latticeCrop.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function assertPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('Crop authoring requires a finite pointer point');
  }
  return point;
}

function assertArtboardRectangle(rectangle) {
  if (!rectangle
    || !Number.isFinite(rectangle.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle.height) || rectangle.height <= 0) {
    throw new TypeError('Crop authoring requires a projected artboard rectangle');
  }
  return rectangle;
}

function assertMedia(media) {
  if (!media
    || !Number.isFinite(media.width) || media.width <= 0
    || !Number.isFinite(media.height) || media.height <= 0) {
    throw new TypeError('Crop authoring requires positive native media dimensions');
  }
  return media;
}

export function squareCropPlacement(placement, artboardRectangle) {
  const bounds = placementBounds(placement);
  const artboard = assertArtboardRectangle(artboardRectangle);
  const widthPixels = bounds.width * artboard.width;
  const heightPixels = bounds.height * artboard.height;
  const side = Math.min(widthPixels, heightPixels);
  const width = side / artboard.width;
  const height = side / artboard.height;
  return {
    bounds: {
      x: bounds.x + ((bounds.width - width) / 2),
      y: bounds.y + ((bounds.height - height) / 2),
      width,
      height,
    },
    crop: { x: 0.5, y: 0.5, zoom: 1 },
  };
}

export function restoreNativePlacement(placement, media, artboardRectangle) {
  const bounds = placementBounds(placement);
  const source = assertMedia(media);
  const artboard = assertArtboardRectangle(artboardRectangle);
  const maskWidth = bounds.width * artboard.width;
  const maskHeight = bounds.height * artboard.height;
  const scale = Math.min(maskWidth / source.width, maskHeight / source.height);
  const width = (source.width * scale) / artboard.width;
  const height = (source.height * scale) / artboard.height;
  return {
    x: bounds.x + ((bounds.width - width) / 2),
    y: bounds.y + ((bounds.height - height) / 2),
    width,
    height,
  };
}

export function createCropFocusGesture(placement, media, maskRectangle, point) {
  const crop = normalizeCropForMask(placement.crop, maskRectangle, media);
  const focusBounds = cropFocusBounds(maskRectangle, media, crop.zoom);
  return {
    placementId: placement.id,
    origin: { ...assertPoint(point) },
    startCrop: { ...crop },
    previewCrop: { ...crop },
    focusBounds,
    activated: false,
  };
}

export function updateCropFocusGesture(gesture, point, deadZone) {
  const current = assertPoint(point);
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw new TypeError('Crop authoring requires a non-negative dead zone');
  }
  const delta = { x: current.x - gesture.origin.x, y: current.y - gesture.origin.y };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };
  return {
    ...gesture,
    activated: true,
    previewCrop: {
      x: clamp(
        gesture.startCrop.x - (delta.x / gesture.focusBounds.renderedSize.width),
        gesture.focusBounds.x.minimum,
        gesture.focusBounds.x.maximum,
      ),
      y: clamp(
        gesture.startCrop.y - (delta.y / gesture.focusBounds.renderedSize.height),
        gesture.focusBounds.y.minimum,
        gesture.focusBounds.y.maximum,
      ),
      zoom: gesture.startCrop.zoom,
    },
  };
}

export function finishCropFocusGesture(gesture, { cancelled = false } = {}) {
  return {
    committed: Boolean(gesture?.activated && !cancelled),
    crop: { ...(cancelled ? gesture.startCrop : gesture.previewCrop) },
  };
}

export function nudgeCropFocus(crop, media, maskRectangle, delta) {
  const normalized = normalizeCropForMask(crop, maskRectangle, media);
  const bounds = cropFocusBounds(maskRectangle, media, normalized.zoom);
  return {
    x: clamp(normalized.x + delta.x, bounds.x.minimum, bounds.x.maximum),
    y: clamp(normalized.y + delta.y, bounds.y.minimum, bounds.y.maximum),
    zoom: normalized.zoom,
  };
}

export function setCropZoom(crop, media, maskRectangle, zoom) {
  return normalizeCropForMask({ ...crop, zoom }, maskRectangle, media);
}
