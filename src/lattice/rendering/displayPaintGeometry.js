import { projectSystemWorkflowPlacement, projectSystemWorkflowViewport } from '../../systemWorkflow/systemWorkflowViewportProjection.js';

// A Display Stage already has the authored reference ratio. Its two painted
// dimensions may round differently; map the reference to those endpoints
// instead of containing it again and creating an unintended gutter.
export function projectDisplayStageViewport(geometry, viewport) {
  const field = projectSystemWorkflowViewport(geometry, viewport);
  return Object.freeze({ ...field, left: 0, top: 0,
    cellSize: viewport.width / geometry.columns, rowSize: viewport.height / geometry.rows,
    referenceWidth: viewport.width, referenceHeight: viewport.height });
}

// Share rounded endpoints, never round position and width independently.
// This is paint geometry only: authored coordinates and saved window sizes
// remain continuous. A Workbench Stage already uses physical pixels (scale 1).
export function displayPaintRectangle(rectangle, scale = 1) {
  const pixel = value => Math.round(Math.round(value * scale * 1e7) / 1e7);
  const left = pixel(rectangle.left), top = pixel(rectangle.top);
  const right = pixel(rectangle.left + rectangle.width);
  const bottom = pixel(rectangle.top + rectangle.height);
  return { left: left / scale, top: top / scale,
    width: (right - left) / scale, height: (bottom - top) / scale };
}

export function projectDisplayPlacementRectangle(placement, field, scale) {
  const rectangle = projectSystemWorkflowPlacement(placement, field);
  const painted = displayPaintRectangle(rectangle, scale);
  // The rail owns the outer Grid boundary. Full-bleed artwork must reach that
  // exact clip, rather than independently rounding it inward at camera zoom.
  // Interior joins still use shared rounded endpoints; intentional gutters stay.
  const near = (a, b) => Number.isFinite(b) && Math.abs(a - b) < 1e-7;
  const left = near(rectangle.left, 0) ? 0 : painted.left;
  const top = near(rectangle.top, 0) ? 0 : painted.top;
  const right = near(rectangle.left + rectangle.width, field.width) ? field.width : painted.left + painted.width;
  const bottom = near(rectangle.top + rectangle.height, field.height) ? field.height : painted.top + painted.height;
  return { left, top, width: right - left, height: bottom - top };
}
