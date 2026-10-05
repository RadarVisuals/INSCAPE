// Use the same approach as Display Lift: lay out the live surfaces at the
// largest required resolution once, then project them down during the journey.
// No surface is ever magnified beyond the resolution prepared for this trip.
export function createWorkbenchCameraSurfaceMotion(host, entries, rasterCamera) {
  const registered = new Map(entries);
  const decorations = [...host.querySelectorAll('[data-workbench-camera-decoration]')];
  const surfaces = [...registered.values(), ...decorations].map(node => {
    const matrix = new DOMMatrix(getComputedStyle(node).transform === 'none' ? undefined : getComputedStyle(node).transform);
    return { node, matrix };
  });
  const overlay = host.querySelector('.workbench-selection');
  const selection = overlay?.getBoundingClientRect();
  const shortcuts = [...host.querySelectorAll('[data-workbench-pan]:not([data-workbench-view-id])')];
  const zoom = host.querySelector('[aria-label="Reset Workbench zoom to 100%"]');
  for (const { node } of surfaces) node.setAttribute('data-workbench-camera-projected', '');
  return {
    isCurrent: () => entries.size === registered.size && [...registered].every(([id, node]) => entries.get(id) === node && node.isConnected),
    paint(camera) {
      const ratio = camera.scale / rasterCamera.scale;
      const x = camera.offset.x - rasterCamera.offset.x * ratio;
      const y = camera.offset.y - rasterCamera.offset.y * ratio;
      for (const { node, matrix } of surfaces) {
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
