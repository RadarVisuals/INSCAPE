import { workbenchPaintGeometry } from './workbenchPaintGeometry.js';

// Use the same approach as Display Lift: lay out the live surfaces at the
// largest required resolution once, then project them down during the journey.
// No surface is ever magnified beyond the resolution prepared for this trip.
export function createWorkbenchCameraSurfaceMotion(host, entries, rasterCamera, { origins, destinations, kind, start, end } = {}) {
  const registered = new Map(entries);
  const decorations = [...host.querySelectorAll('[data-workbench-camera-decoration]')];
  const surfaces = [...registered.values(), ...decorations].map(node => {
    const transform = getComputedStyle(node).transform;
    const matrix = new DOMMatrix(transform === 'none' ? undefined : transform);
    const id = node.dataset.workbenchViewId;
    const source = origins?.[id], destination = destinations?.[id];
    const box = source || destination ? node.getBoundingClientRect() : null;
    const world = box && { left: (box.left - rasterCamera.offset.x) / rasterCamera.scale, top: (box.top - rasterCamera.offset.y) / rasterCamera.scale,
      width: box.width / rasterCamera.scale, height: box.height / rasterCamera.scale };
    return { node, matrix, box, from: source || world, to: destination || world };
  });
  const overlay = host.querySelector('.workbench-selection');
  const selection = overlay?.getBoundingClientRect();
  const shortcuts = [...host.querySelectorAll('[data-workbench-pan]:not([data-workbench-view-id])')];
  for (const { node } of surfaces) node.setAttribute('data-workbench-camera-projected', '');
  // Native transform effects avoid invalidating the module's CSS on each frame.
  // They are paused and sampled by the existing camera clock, never independent
  // animations that could drift from input coordinates, overlays or interruption.
  const effects = [];
  if (kind === 'travel' && start.scale !== end.scale && !origins && !destinations) {
    const keyframe = camera => {
      const ratio = camera.scale / rasterCamera.scale;
      return { scale: String(ratio), translate: (camera.offset.x - rasterCamera.offset.x * ratio) + 'px ' + (camera.offset.y - rasterCamera.offset.y * ratio) + 'px' };
    };
    for (const { node, matrix } of surfaces) {
      node.style.setProperty('--workbench-camera-transform', matrix.toString());
      const effect = node.animate([keyframe(start), keyframe(end)], { duration: 1, fill: 'both' });
      effect.pause(); effect.currentTime = 0; effects.push(effect);
    }
  }
  return {
    isCurrent: () => entries.size === registered.size && [...registered].every(([id, node]) => entries.get(id) === node && node.isConnected),
    paint(camera, progress = 1) {
      const ratio = camera.scale / rasterCamera.scale;
      let x = camera.offset.x - rasterCamera.offset.x * ratio;
      let y = camera.offset.y - rasterCamera.offset.y * ratio;
      // At unchanged zoom the prepared surfaces already share physical-pixel
      // edges. Translate them by one shared whole-pixel displacement: fractional
      // movement filters each separate surface edge and exposes the background
      // between touching modules, especially during Explore's release coast.
      // Keep the precise camera and authored geometry independent of painting.
      if (ratio === 1) {
        const density = globalThis.devicePixelRatio || 1;
        const paint = workbenchPaintGeometry({ left: x, top: y, width: 0, height: 0 }, density);
        x = paint.left / density; y = paint.top / density;
      }
      for (const effect of effects) effect.currentTime = progress;
      for (const { node, matrix, box, from, to } of effects.length ? [] : surfaces) {
        if (box && box.width > 0 && box.height > 0) {
          const mix = (a, b) => a + (b - a) * progress;
          // Uniformly fit the artwork into the compact cell; never stretch its
          // aspect ratio on the way into or out of a stack.
          const size = Math.min(mix(from.width, to.width) / box.width, mix(from.height, to.height) / box.height) * camera.scale;
          const left = mix(from.left, to.left) * camera.scale + camera.offset.x;
          const top = mix(from.top, to.top) * camera.scale + camera.offset.y;
          node.style.setProperty('--workbench-camera-transform', 'matrix(' + [matrix.a * size, matrix.b * size, matrix.c * size, matrix.d * size,
            (matrix.e - box.left) * size + left, (matrix.f - box.top) * size + top].join(',') + ')');
          continue;
        }
        node.style.setProperty('--workbench-camera-transform',
          `matrix(${matrix.a * ratio},${matrix.b * ratio},${matrix.c * ratio},${matrix.d * ratio},${matrix.e * ratio + x},${matrix.f * ratio + y})`);
      }
      if (overlay && selection) {
        Object.assign(overlay.style, { left: `${selection.left * ratio + x}px`, top: `${selection.top * ratio + y}px`,
          width: `${selection.width * ratio}px`, height: `${selection.height * ratio}px` });
      }
      for (const node of shortcuts) {
        node.style.setProperty('--workbench-pan-x', `${camera.offset.x}px`);
        node.style.setProperty('--workbench-pan-y', `${camera.offset.y}px`);
      }
      host.toggleAttribute('data-workbench-panned', camera.offset.x !== 0 || camera.offset.y !== 0);
      host.dataset.workbenchCameraScale = String(camera.scale);
      host.dataset.workbenchCameraX = String(camera.offset.x);
      host.dataset.workbenchCameraY = String(camera.offset.y);
    },
    dispose() {
      for (const effect of effects) effect.cancel();
      for (const { node } of surfaces) {
        node.removeAttribute('data-workbench-camera-projected');
        node.style.removeProperty('--workbench-camera-transform');
      }
      for (const node of shortcuts) {
        node.style.removeProperty('--workbench-pan-x'); node.style.removeProperty('--workbench-pan-y');
      }
    },
  };
}
