const finitePositive = (value) => Number.isFinite(value) && value > 0;

export const snapLatticePixelBoundary = (value) => Math.round(value);

export function projectLatticePixelBoundary(field, axis, coordinate) {
  const origin = axis === 'column' ? field?.left : axis === 'row' ? field?.top : NaN;
  if (!Number.isFinite(origin) || !finitePositive(field?.cellSize) || !Number.isFinite(coordinate)) {
    throw new TypeError('Lattice pixel projection requires a canonical field, axis, and coordinate');
  }
  return snapLatticePixelBoundary(origin + coordinate * field.cellSize);
}

export function createLatticePixelBoundaryPositions(field, axis, interval, limit, strokeWidth = 1) {
  if (!field || !finitePositive(interval) || !finitePositive(limit)) return [];
  const origin = axis === 'column' ? field.left : axis === 'row' ? field.top : NaN;
  if (!Number.isFinite(origin) || !finitePositive(field.cellSize)) return [];
  const spacing = field.cellSize * interval;
  const width = Math.max(1, Math.round(strokeWidth));
  const strokeOffset = width % 2 ? 0.5 : 0;
  const firstIndex = Math.ceil(-origin / spacing);
  const lastIndex = Math.floor((limit - origin) / spacing);
  const positions = [];
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    positions.push(projectLatticePixelBoundary(field, axis, index * interval) + strokeOffset);
  }
  return [...new Set(positions)];
}

export function projectLatticePixelRectangle(geometry, field) {
  const left = projectLatticePixelBoundary(field, 'column', geometry.column);
  const top = projectLatticePixelBoundary(field, 'row', geometry.row);
  const right = projectLatticePixelBoundary(field, 'column', geometry.column + geometry.columnSpan);
  const bottom = projectLatticePixelBoundary(field, 'row', geometry.row + geometry.rowSpan);
  return Object.freeze({ left, top, width: right - left, height: bottom - top });
}

const RASTER_EDGE_EPSILON = 1e-7;

const sameRasterEdge = (left, right) => Math.abs(left - right) <= RASTER_EDGE_EPSILON;

export function projectLatticeRasterBleedRectangle(rectangle, opening, bleed = 1) {
  if (!rectangle || !opening || !finitePositive(rectangle.width) || !finitePositive(rectangle.height)
    || !finitePositive(opening.width) || !finitePositive(opening.height)
    || !Number.isFinite(rectangle.left) || !Number.isFinite(rectangle.top)
    || !Number.isFinite(opening.left) || !Number.isFinite(opening.top)
    || !finitePositive(bleed)) {
    throw new TypeError('Lattice raster bleed requires positive rectangles and bleed');
  }
  let { left, top, width, height } = rectangle;
  const rectangleRight = rectangle.left + rectangle.width;
  const rectangleBottom = rectangle.top + rectangle.height;
  const openingRight = opening.left + opening.width;
  const openingBottom = opening.top + opening.height;
  if (sameRasterEdge(rectangle.left, opening.left)) { left -= bleed; width += bleed; }
  if (sameRasterEdge(rectangleRight, openingRight)) width += bleed;
  if (sameRasterEdge(rectangle.top, opening.top)) { top -= bleed; height += bleed; }
  if (sameRasterEdge(rectangleBottom, openingBottom)) height += bleed;
  return Object.freeze({ left, top, width, height });
}
