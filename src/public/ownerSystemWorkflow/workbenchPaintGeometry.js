// One outer-edge raster policy for Workbench modules. Input: screen CSS pixels.
// Output: physical pixels. Never persist this projection.
export function workbenchPaintGeometry(rectangle, density = 1) {
  const pixel = value => Math.round(Math.round(value * density * 1e7) / 1e7);
  const left = pixel(rectangle.left), top = pixel(rectangle.top);
  return { left, top, width: pixel(rectangle.left + rectangle.width) - left,
    height: pixel(rectangle.top + rectangle.height) - top };
}

// Native zoom retains logical text sizing; transform translation avoids a
// second layout rounding of the already snapped screen origin.
export function workbenchPaintStyle(rectangle, camera, offset, density = globalThis.devicePixelRatio || 1) {
  const scale = camera.scale;
  const paint = workbenchPaintGeometry({ left: rectangle.left * scale + camera.x + offset.x,
    top: rectangle.top * scale + camera.y + offset.y,
    width: rectangle.width * scale, height: rectangle.height * scale }, density);
  return { left: 0, top: 0, zoom: scale, translate: 'none', transformOrigin: '0 0',
    transform: `matrix(1,0,0,1,${paint.left / density / scale},${paint.top / density / scale})`,
    // Avoid native zoom truncating an exact edge one layout unit inward.
    width: (paint.width / density + .001) / scale,
    height: (paint.height / density + .001) / scale };
}
