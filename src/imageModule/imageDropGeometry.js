import { clampWorkbenchPosition, WORKBENCH_BOUNDS } from '../public/ownerSystemWorkflow/workbenchSpace.js';
import { imageWindowGeometry, imageWindowPosition, imagePaintGeometry } from './imageWindowGeometry.js';

export function imageDropGeometry(dimensions, point, host, scale, offset, density = 1, bounds = WORKBENCH_BOUNDS) {
  if (!(dimensions?.width > 0 && dimensions?.height > 0)) return null;
  const camera = { scale, x: 0, y: 0 };
  const centre = imageWindowPosition({ left: point.x - host.left, top: point.y - host.top }, camera, offset);
  if (centre.left < bounds.left || centre.top < bounds.top
    || centre.left > bounds.right || centre.top > bounds.bottom) return null;
  // Keep the first Image manageable, close to its source proportions. The same
  // centred fill used by Library sides covers whole-pixel rounding/minimums.
  const limit = Math.max(32, Math.min(360, host.width - 16, host.height - 70));
  const factor = Math.min(1, limit / dimensions.width, limit / dimensions.height);
  const size = { width: Math.max(32, Math.round(dimensions.width * factor)),
    height: Math.max(32, Math.round(dimensions.height * factor)) };
  const position = clampWorkbenchPosition({ left: centre.left - size.width / 2, top: centre.top - size.height / 2 }, size, bounds);
  const paint = imagePaintGeometry(imageWindowGeometry(position, size, camera, offset), density);
  return { destination: { position, size }, rectangle: { left: host.left + paint.left / density,
    top: host.top + paint.top / density, width: paint.width / density, height: paint.height / density } };
}
