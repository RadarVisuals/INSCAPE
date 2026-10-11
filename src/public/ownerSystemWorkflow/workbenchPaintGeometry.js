// One outer-edge raster policy for Workbench modules. Input: screen CSS pixels.
// Output: physical pixels. Never persist this projection.
export function workbenchPaintGeometry(rectangle, density = 1) {
  const pixel = value => Math.round(Math.round(value * density * 1e7) / 1e7);
  const left = pixel(rectangle.left), top = pixel(rectangle.top);
  return { left, top, width: pixel(rectangle.left + rectangle.width) - left,
    height: pixel(rectangle.top + rectangle.height) - top };
}

// Lay out the outer surface in physical pixels, then map it to the screen.
// Content zoom is separate: CSS layout must not round the shared edges again.
export function workbenchPaintStyle(rectangle, camera, offset, density = globalThis.devicePixelRatio || 1) {
  const scale = camera.scale;
  const paint = workbenchPaintGeometry({ left: rectangle.left * scale + camera.x + offset.x,
    top: rectangle.top * scale + camera.y + offset.y,
    width: rectangle.width * scale, height: rectangle.height * scale }, density);
  return { left: 0, top: 0, zoom: 1, translate: 'none', transformOrigin: '0 0', willChange: 'transform',
    transform: `matrix(${1 / density},0,0,${1 / density},${paint.left / density},${paint.top / density})`,
    width: paint.width, height: paint.height, maxWidth: 'none', maxHeight: 'none',
    '--workbench-density': density, '--workbench-content-scale': scale * density,
    '--workbench-paint-width': `${paint.width}px`, '--workbench-paint-height': `${paint.height}px` };
}
