export { workbenchPaintGeometry as imagePaintGeometry } from '../public/ownerSystemWorkflow/workbenchPaintGeometry.js';

// Exact projection: interaction never reads rounded paint geometry back into
// the saved Workbench position. Shared world edges stay shared at every zoom.
export function imageWindowGeometry(position, size, camera, offset) {
  return {
    left: position.left * camera.scale + camera.x + offset.x,
    top: position.top * camera.scale + camera.y + offset.y,
    width: size.width * camera.scale,
    height: size.height * camera.scale,
  };
}

export function imageWindowPosition(rectangle, camera, offset) {
  return { left: (rectangle.left - camera.x - offset.x) / camera.scale,
    top: (rectangle.top - camera.y - offset.y) / camera.scale };
}
