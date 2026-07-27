const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function assertRectangle(rectangle) {
  if (!rectangle
    || !Number.isFinite(rectangle.left) || !Number.isFinite(rectangle.top)
    || !Number.isFinite(rectangle.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle.height) || rectangle.height <= 0) {
    throw new TypeError('Crop projection requires a positive mask rectangle');
  }
  return rectangle;
}

function assertMedia(media) {
  if (!media
    || !Number.isFinite(media.width) || media.width <= 0
    || !Number.isFinite(media.height) || media.height <= 0) {
    throw new TypeError('Crop projection requires positive native media dimensions');
  }
  return media;
}

function assertCrop(crop) {
  if (!crop
    || !Number.isFinite(crop.x) || crop.x < 0 || crop.x > 1
    || !Number.isFinite(crop.y) || crop.y < 0 || crop.y > 1
    || !Number.isFinite(crop.zoom) || crop.zoom < 1 || crop.zoom > 4) {
    throw new TypeError('Crop projection requires canonical focus and zoom');
  }
  return crop;
}

export function cropFocusBounds(maskRectangle, media, zoom) {
  const mask = assertRectangle(maskRectangle);
  const source = assertMedia(media);
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > 4) {
    throw new TypeError('Crop projection requires zoom from one through four');
  }
  const scale = Math.max(mask.width / source.width, mask.height / source.height) * zoom;
  const width = source.width * scale;
  const height = source.height * scale;
  const insetX = mask.width / (2 * width);
  const insetY = mask.height / (2 * height);
  return {
    x: { minimum: insetX, maximum: 1 - insetX },
    y: { minimum: insetY, maximum: 1 - insetY },
    renderedSize: { width, height },
  };
}

export function normalizeCropForMask(crop, maskRectangle, media) {
  const value = assertCrop(crop);
  const bounds = cropFocusBounds(maskRectangle, media, value.zoom);
  return {
    x: clamp(value.x, bounds.x.minimum, bounds.x.maximum),
    y: clamp(value.y, bounds.y.minimum, bounds.y.maximum),
    zoom: value.zoom,
  };
}

export function projectCroppedMediaRectangle(maskRectangle, media, crop) {
  const mask = assertRectangle(maskRectangle);
  const normalized = normalizeCropForMask(crop, mask, media);
  const { renderedSize } = cropFocusBounds(mask, media, normalized.zoom);
  return {
    left: mask.left + (mask.width / 2) - (normalized.x * renderedSize.width),
    top: mask.top + (mask.height / 2) - (normalized.y * renderedSize.height),
    width: renderedSize.width,
    height: renderedSize.height,
  };
}
