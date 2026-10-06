// Use the same approach as Display Lift: lay out the live surfaces at the
// largest required resolution once, then project them down during the journey.
// No surface is ever magnified beyond the resolution prepared for this trip.
export function createWorkbenchCameraSurfaceMotion(host, entries, rasterCamera, { origins, destinations } = {}) {
  const registered = new Map(entries);
  const decorations = [...host.querySelectorAll('[data-workbench-camera-decoration]')];
  const surfaces = [...registered.values(), ...decorations].map(node => {
    const matrix = new DOMMatrix(getComputedStyle(node).transform === 'none' ? undefined : getComputedStyle(node).transform);
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
  const zoom = host.querySelector('[aria-label="Reset Workbench zoom to 100%"]');
  for (const { node } of surfaces) node.setAttribute('data-workbench-camera-projected', '');
  return {
    isCurrent: () => entries.size === registered.size && [...registered].every(([id, node]) => entries.get(id) === node && node.isConnected),
    paint(camera, progress = 1) {
      const ratio = camera.scale / rasterCamera.scale;
      const x = camera.offset.x - rasterCamera.offset.x * ratio;
      const y = camera.offset.y - rasterCamera.offset.y * ratio;
      for (const { node, matrix, box, from, to } of surfaces) {
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
      if (zoom) zoom.textContent = `${Math.round(camera.scale * 100)}%`;
    },
    dispose() {
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
