export const SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS = Object.freeze({
  ROTATE: 'ROTATE',
  MIRROR_HORIZONTAL: 'MIRROR_HORIZONTAL',
  MIRROR_VERTICAL: 'MIRROR_VERTICAL',
});

const operations = new Set(Object.values(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS));
// Shared by independent artwork modules; placement geometry stays module-owned.
export function transformArtwork(input, operation) {
  if (!operations.has(operation)) throw new TypeError('Unknown artwork transform');
  const transform = { ...input };
  if (operation === SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.ROTATE) {
    transform.quarterTurns = (transform.quarterTurns + 1) % 4;
    // Mirrors are screen-axis operations (CSS scale precedes rotate). Rotate
    // their axes too so mirrored members follow the artwork's clockwise turn.
    [transform.mirrorX, transform.mirrorY] = [transform.mirrorY, transform.mirrorX];
  } else if (operation === SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL) {
    transform.mirrorX = !transform.mirrorX;
  } else {
    transform.mirrorY = !transform.mirrorY;
  }
  return transform;
}

export function projectSystemWorkflowTransform(transform, dimensions, crop = null) {
  const quarterTurns = transform?.quarterTurns || 0;
  const mirrorX = transform?.mirrorX === true;
  const mirrorY = transform?.mirrorY === true;
  const swapped = quarterTurns % 2 === 1;
  let x = crop?.x ?? 0.5;
  let y = crop?.y ?? 0.5;
  if (quarterTurns === 1) [x, y] = [1 - y, x];
  else if (quarterTurns === 2) [x, y] = [1 - x, 1 - y];
  else if (quarterTurns === 3) [x, y] = [y, 1 - x];
  if (mirrorX) x = 1 - x;
  if (mirrorY) y = 1 - y;
  return Object.freeze({
    crop: crop ? Object.freeze({ ...crop, x, y }) : null,
    dimensions: Object.freeze({
      width: swapped ? dimensions.height : dimensions.width,
      height: swapped ? dimensions.width : dimensions.height,
    }),
    css: `scale(${mirrorX ? -1 : 1}, ${mirrorY ? -1 : 1}) rotate(${quarterTurns * 90}deg)`,
    swapped,
  });
}

export function renderedSystemWorkflowCssTransform(projection) {
  const css = projection?.css;
  return css === 'scale(1, 1) rotate(0deg)' ? undefined : css;
}

export function projectSystemWorkflowImageRenderRectangle(imageRectangle, transformProjection) {
  if (!imageRectangle) return null;
  if (!transformProjection?.swapped) return Object.freeze({ ...imageRectangle });
  return Object.freeze({
    left: imageRectangle.left + ((imageRectangle.width - imageRectangle.height) / 2),
    top: imageRectangle.top + ((imageRectangle.height - imageRectangle.width) / 2),
    width: imageRectangle.height,
    height: imageRectangle.width,
  });
}

export function unprojectSystemWorkflowCrop(transform, crop) {
  if (!crop) return null;
  const quarterTurns = transform?.quarterTurns || 0;
  const mirrorX = transform?.mirrorX === true;
  const mirrorY = transform?.mirrorY === true;
  let x = mirrorX ? 1 - crop.x : crop.x;
  let y = mirrorY ? 1 - crop.y : crop.y;
  if (quarterTurns === 1) [x, y] = [y, 1 - x];
  else if (quarterTurns === 2) [x, y] = [1 - x, 1 - y];
  else if (quarterTurns === 3) [x, y] = [1 - y, x];
  return Object.freeze({ ...crop, x, y });
}
