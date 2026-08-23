const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const cropForPlacementFrame = (crop, asset, width, height) => {
  if (crop || !asset) return crop;
  return width * asset.height === height * asset.width
    ? null
    : { x: 0.5, y: 0.5, zoom: 1 };
};

export const placementRectangleFromPointer = ({ asset, bounds, cell, clientX, clientY }) => {
  if (!asset || !bounds || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null;
  const width = asset.width > asset.height ? cell * 6 : cell * 4.5;
  const height = Math.round(width * asset.height / asset.width);
  const left = Math.round((clientX - bounds.left - width / 2) / cell) * cell;
  const top = Math.round((clientY - bounds.top - height / 2) / cell) * cell;
  return {
    height,
    left: clamp(left, 0, bounds.width - width),
    top: clamp(top, 0, bounds.height - height),
    width,
  };
};

export const createPlacementFromAssetDrop = ({ asset, rectangle, stamp, tableId }) => ({
  id: `placement-${stamp}`,
  assetId: asset.stableAssetId,
  crop: cropForPlacementFrame(null, asset, rectangle.width, rectangle.height),
  tableId,
  ...rectangle,
});

export const getPlacementBounds = (placements) => {
  if (!placements.length) return null;
  const left = Math.min(...placements.map((placement) => placement.left));
  const top = Math.min(...placements.map((placement) => placement.top));
  const right = Math.max(...placements.map((placement) => placement.left + placement.width));
  const bottom = Math.max(...placements.map((placement) => placement.top + placement.height));
  return { bottom, height: bottom - top, left, right, top, width: right - left };
};

export const movePlacementGroup = ({ bounds, canvas, cell, dx, dy, placements }) => {
  const moveX = clamp(Math.round(dx / cell) * cell, -bounds.left, canvas.width - bounds.right);
  const moveY = clamp(Math.round(dy / cell) * cell, -bounds.top, canvas.height - bounds.bottom);
  return placements.map((placement) => ({
    ...placement,
    left: placement.left + moveX,
    top: placement.top + moveY,
  }));
};

export const resizePlacementGroup = ({ assets, bounds, canvas, cell, corner, dx, dy, placements, preserveRatio }) => {
  const west = corner.includes('w');
  const north = corner.includes('n');
  const movingX = west ? -dx : dx;
  const movingY = north ? -dy : dy;
  let width = Math.max(cell * 2, bounds.width + movingX);
  let height = Math.max(cell * 2, bounds.height + movingY);

  if (preserveRatio) {
    const ratio = bounds.width / bounds.height;
    if (Math.abs(movingX) >= Math.abs(movingY)) height = width / ratio;
    else width = height * ratio;
  }

  width = Math.max(cell * 2, Math.round(width / cell) * cell);
  height = Math.max(cell * 2, Math.round(height / cell) * cell);
  const nextBounds = {
    height,
    left: west ? bounds.right - width : bounds.left,
    top: north ? bounds.bottom - height : bounds.top,
    width,
  };
  nextBounds.left = clamp(nextBounds.left, 0, canvas.width - nextBounds.width);
  nextBounds.top = clamp(nextBounds.top, 0, canvas.height - nextBounds.height);

  const scaleX = nextBounds.width / bounds.width;
  const scaleY = nextBounds.height / bounds.height;
  return placements.map((placement) => {
    const placementWidth = Math.max(cell, Math.round((placement.width * scaleX) / cell) * cell);
    const placementHeight = Math.max(cell, Math.round((placement.height * scaleY) / cell) * cell);
    const asset = assets.find(({ stableAssetId }) => stableAssetId === placement.assetId);
    return {
      ...placement,
      crop: cropForPlacementFrame(placement.crop, asset, placementWidth, placementHeight),
      height: placementHeight,
      left: Math.round((nextBounds.left + ((placement.left - bounds.left) * scaleX)) / cell) * cell,
      top: Math.round((nextBounds.top + ((placement.top - bounds.top) * scaleY)) / cell) * cell,
      width: placementWidth,
    };
  });
};

export const getPlacementsInsideMarquee = (placements, rectangle) => placements
  .filter((placement) => placement.left < rectangle.right
    && placement.left + placement.width > rectangle.left
    && placement.top < rectangle.bottom
    && placement.top + placement.height > rectangle.top)
  .map(({ id }) => id);
