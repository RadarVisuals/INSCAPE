// One outer-edge raster policy for Workbench modules. Input: screen CSS pixels.
// Output: physical pixels. Never persist this projection.
export function workbenchPaintGeometry(rectangle, density = 1) {
  const pixel = value => Math.round(Math.round(value * density * 1e7) / 1e7);
  const left = pixel(rectangle.left), top = pixel(rectangle.top);
  return { left, top, width: pixel(rectangle.left + rectangle.width) - left,
    height: pixel(rectangle.top + rectangle.height) - top };
}

// Convert both snapped edges back to CSS coordinates before subtracting them.
// This lets adjoining boxes use the same layout edge, even at fractional zoom.
export function cssPaintRectangle(paint, density) {
  const left = paint.left / density, top = paint.top / density;
  return { left, top, width: (paint.left + paint.width) / density - left,
    height: (paint.top + paint.height) / density - top };
}

// Lay out the outer surface in physical pixels, then map it to the screen.
// Content zoom is separate: CSS layout must not round the shared edges again.
export function workbenchPaintStyle(rectangle, camera, offset, density = globalThis.devicePixelRatio || 1, cssPixelSurface = false, subpixelEdges = false) {
  const scale = camera.scale;
  const screen = { left: rectangle.left * scale + camera.x + offset.x,
    top: rectangle.top * scale + camera.y + offset.y,
    width: rectangle.width * scale, height: rectangle.height * scale };
  // Positive authored gutters must retain fractional coverage when zoomed out.
  // Touching modules keep the shared snapped-edge policy to avoid false seams.
  const paint = subpixelEdges
    ? Object.fromEntries(Object.entries(screen).map(([key, value]) => [key, value * density]))
    : workbenchPaintGeometry(screen, density);
  // Adjacent cell fills must meet on the same pixel without resampling an individual texture per cell.
  const surfaceDensity = cssPixelSurface ? 1 : density;
  const { width, height } = cssPixelSurface ? cssPaintRectangle(paint, density) : paint;
  return { left: 0, top: 0, zoom: 1, translate: 'none', transformOrigin: '0 0', willChange: cssPixelSurface ? 'auto' : 'transform',
    transform: `matrix(${1 / surfaceDensity},0,0,${1 / surfaceDensity},${paint.left / density},${paint.top / density})`,
    width, height, maxWidth: 'none', maxHeight: 'none',
    '--workbench-density': surfaceDensity, '--workbench-content-scale': scale * surfaceDensity,
    '--workbench-paint-width': `${width}px`, '--workbench-paint-height': `${height}px` };
}
