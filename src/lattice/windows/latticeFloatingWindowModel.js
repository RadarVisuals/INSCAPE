export const LATTICE_FLOATING_WINDOW_RESIZE_STEP = 24;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function latticeFloatingWindowMargin(viewport) {
  return 10;
}

export function latticeFloatingWindowViewportBounds(viewport) {
  const width = Math.max(320, Number(viewport?.width) || 1280);
  const height = Math.max(320, Number(viewport?.height) || 720);
  const margin = latticeFloatingWindowMargin({ height, width });
  return {
    maximumHeight: Math.max(300, height - (margin * 2)),
    maximumWidth: Math.max(300, width - (margin * 2)),
    minimumHeight: Math.min(440, Math.max(300, height - (margin * 2))),
    minimumWidth: Math.min(360, Math.max(300, width - (margin * 2))),
  };
}

export function initialLatticeFloatingWindowSize(viewport) {
  const bounds = latticeFloatingWindowViewportBounds(viewport);
  return {
    width: clamp(1040, bounds.minimumWidth, bounds.maximumWidth),
    height: clamp(680, bounds.minimumHeight, bounds.maximumHeight),
  };
}

export function clampLatticeFloatingWindowSize(size, viewport) {
  const bounds = latticeFloatingWindowViewportBounds(viewport);
  return {
    width: clamp(Number(size?.width) || bounds.minimumWidth, bounds.minimumWidth, bounds.maximumWidth),
    height: clamp(Number(size?.height) || bounds.minimumHeight, bounds.minimumHeight, bounds.maximumHeight),
  };
}

export function resizeLatticeFloatingWindowAroundCenter(size, delta, viewport) {
  return clampLatticeFloatingWindowSize({
    width: (Number(size?.width) || 0) + ((Number(delta?.x) || 0) * 2),
    height: (Number(size?.height) || 0) + ((Number(delta?.y) || 0) * 2),
  }, viewport);
}

export function resizeLatticeFloatingWindowByKey(
  size,
  key,
  viewport,
  step = LATTICE_FLOATING_WINDOW_RESIZE_STEP,
) {
  const delta = {
    ArrowDown: { x: 0, y: step / 2 },
    ArrowLeft: { x: -step / 2, y: 0 },
    ArrowRight: { x: step / 2, y: 0 },
    ArrowUp: { x: 0, y: -step / 2 },
  }[key];
  return delta ? resizeLatticeFloatingWindowAroundCenter(size, delta, viewport) : null;
}

export function resizeLatticeFloatingWindowRightEdge(size, deltaX, viewport) {
  return clampLatticeFloatingWindowSize({
    height: size?.height,
    width: (Number(size?.width) || 0) + (Number(deltaX) || 0),
  }, viewport);
}

export function clampLatticeFloatingWindowPosition(position, size, viewport) {
  const width = Math.max(320, Number(viewport?.width) || 1280);
  const height = Math.max(320, Number(viewport?.height) || 720);
  const margin = latticeFloatingWindowMargin({ height, width });
  const windowWidth = Math.max(1, Number(size?.width) || 1);
  const windowHeight = Math.max(1, Number(size?.height) || 1);
  return {
    left: clamp(Number(position?.left) || margin, margin, Math.max(margin, width - windowWidth - margin)),
    top: clamp(Number(position?.top) || margin, margin, Math.max(margin, height - windowHeight - margin)),
  };
}

export function initialLatticeFloatingWindowPosition(size, viewport) {
  const width = Math.max(320, Number(viewport?.width) || 1280);
  const height = Math.max(320, Number(viewport?.height) || 720);
  return clampLatticeFloatingWindowPosition({
    left: (width - Number(size?.width || 0)) / 2,
    top: (height - Number(size?.height || 0)) / 2,
  }, size, { height, width });
}

export function moveLatticeFloatingWindow(position, delta, size, viewport) {
  return clampLatticeFloatingWindowPosition({
    left: (Number(position?.left) || 0) + (Number(delta?.x) || 0),
    top: (Number(position?.top) || 0) + (Number(delta?.y) || 0),
  }, size, viewport);
}

export function positionLatticeFloatingWindowAfterCenteredResize(
  position,
  previousSize,
  nextSize,
  viewport,
) {
  return clampLatticeFloatingWindowPosition({
    left: (Number(position?.left) || 0) - ((nextSize.width - previousSize.width) / 2),
    top: (Number(position?.top) || 0) - ((nextSize.height - previousSize.height) / 2),
  }, nextSize, viewport);
}
