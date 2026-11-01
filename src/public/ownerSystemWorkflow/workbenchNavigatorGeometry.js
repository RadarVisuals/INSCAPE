export function navigatorViewport(camera, viewport) {
  return { left: -camera.offset.x / camera.scale, top: -camera.offset.y / camera.scale,
    width: viewport.width / camera.scale, height: viewport.height / camera.scale };
}
export function navigatorBounds(rectangles, size) {
  const valid = rectangles.filter(r => r && ['left', 'top', 'width', 'height'].every(k => Number.isFinite(r[k])) && r.width > 0 && r.height > 0);
  if (!valid.length || size.width <= 0 || size.height <= 0) return null;
  let left = Math.min(...valid.map(r => r.left)), top = Math.min(...valid.map(r => r.top));
  let width = Math.max(...valid.map(r => r.left + r.width)) - left, height = Math.max(...valid.map(r => r.top + r.height)) - top;
  // A little breathing room, with one uniform scale in both directions.
  const scale = Math.min(size.width / (width * 1.08), size.height / (height * 1.08));
  const w = size.width / scale, h = size.height / scale;
  left -= (w - width) / 2; top -= (h - height) / 2;
  return { left, top, width: w, height: h, scale };
}
export function navigatorFrame(rect, bounds) {
  return { view: { x: (rect.left + rect.width / 2 - bounds.left) / bounds.width * 100,
    y: (rect.top + rect.height / 2 - bounds.top) / bounds.height * 100 },
  frameSize: { width: rect.width / bounds.width * 100, height: rect.height / bounds.height * 100 } };
}
export function navigatorCentre(point, bounds) {
  return { x: bounds.left + point.x / 100 * bounds.width, y: bounds.top + point.y / 100 * bounds.height };
}
