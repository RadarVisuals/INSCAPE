// View-only translation. No document, responsive width or saved geometry enters
// this controller. Pointer samples share one paint per animation frame.
export function createReceptionPreviewPan({ getPlane, schedule = requestAnimationFrame, cancel = cancelAnimationFrame }) {
  let offset = { x: 0, y: 0 }, frame = null;
  const paint = () => {
    frame = null;
    const plane = getPlane();
    if (plane) plane.style.translate = `${Math.round(offset.x)}px ${Math.round(offset.y)}px`;
  };
  return {
    getOffset: () => ({ ...offset }),
    update(next) {
      if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return;
      offset = { ...next };
      if (frame === null) frame = schedule(paint);
    },
    reset() {
      if (frame !== null) cancel(frame);
      offset = { x: 0, y: 0 }; paint();
    },
    dispose() {
      if (frame !== null) cancel(frame);
      frame = null;
      getPlane()?.style.removeProperty('translate');
    },
  };
}
