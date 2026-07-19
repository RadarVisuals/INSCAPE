import { getSpatialGridOffset } from './spatialWorldCamera.js';

const positive = (value, fallback) => Math.max(1, Number(value) || fallback);

export default function SpatialWireframeGrid({
  width,
  height,
  camera = { x: 0, y: 0 },
  cellWidth = 80,
  cellHeight = cellWidth,
  className,
  lineClassName = 'spatial-wireframe__lines',
  intersectionClassName = 'spatial-wireframe__intersections'
}) {
  const safeWidth = positive(width, 1);
  const safeHeight = positive(height, 1);
  const stepX = positive(cellWidth, 80);
  const stepY = positive(cellHeight, stepX);
  const offsetX = getSpatialGridOffset({ x: camera.x, y: 0 }, stepX).x;
  const offsetY = getSpatialGridOffset({ x: 0, y: camera.y }, stepY).y;
  const columns = Math.ceil(safeWidth / stepX) + 2;
  const rows = Math.ceil(safeHeight / stepY) + 2;
  const verticals = Array.from({ length: columns }, (_, index) => Math.round(offsetX - stepX + index * stepX));
  const horizontals = Array.from({ length: rows }, (_, index) => Math.round(offsetY - stepY + index * stepY));

  return <svg className={className} viewBox={`0 0 ${safeWidth} ${safeHeight}`} preserveAspectRatio="none" aria-hidden="true">
    <g className={lineClassName}>
      {verticals.map((x) => <line key={`v-${x}`} x1={x} y1="0" x2={x} y2={safeHeight} />)}
      {horizontals.map((y) => <line key={`h-${y}`} x1="0" y1={y} x2={safeWidth} y2={y} />)}
    </g>
    <g className={intersectionClassName}>
      {horizontals.flatMap((y) => verticals.map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />))}
    </g>
  </svg>;
}
