import { clampVerticalHomeWorldCamera } from './homeWorldCamera.js';

export function createVerticalHomeWorld(geometry) {
  return {
    width: geometry.width * 3,
    height: geometry.height * 3,
    viewportWidth: geometry.width,
    viewportHeight: geometry.height
  };
}

export function getVerticalHomeOrigin(geometry) {
  return {
    x: Math.round((geometry.width + geometry.left) / 40) * 40,
    y: Math.round((geometry.height + geometry.top) / 40) * 40
  };
}

export function createVerticalHomePlacementGeometry(geometry) {
  if (geometry.narrow) return geometry;
  const origin = getVerticalHomeOrigin(geometry);
  return {
    ...geometry,
    // Only the columns intersecting the fixed horizontal viewport are authorable.
    minColumn: Math.ceil((geometry.width - origin.x) / geometry.cellWidth),
    minRow: -Math.floor(origin.y / geometry.cellHeight),
    columns: Math.floor(geometry.width / geometry.cellWidth),
    rows: Math.floor((geometry.height * 3) / geometry.cellHeight),
    usableWidth: geometry.width,
    usableHeight: geometry.height * 3
  };
}

export function createVerticalHomeLayout(geometry) {
  const world = createVerticalHomeWorld(geometry);
  const origin = getVerticalHomeOrigin(geometry);
  const camera = geometry.narrow
    ? { x: 0, y: 0, zoom: 1 }
    : clampVerticalHomeWorldCamera({ x: geometry.width, y: geometry.height, zoom: 1 }, world, geometry.width);
  return { world, origin, placementGeometry: createVerticalHomePlacementGeometry(geometry), camera };
}
