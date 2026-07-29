import { LATTICE_PRODUCTION_GEOMETRY } from '../domain/latticeProductionDraft.js';

const finiteSize = (value) => Number.isFinite(value) && value > 0;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function createWidthFitLatticeOwnerViewport({ width, height } = {}) {
  if (!finiteSize(width) || !finiteSize(height)) {
    throw new TypeError('Owner lattice viewport requires positive dimensions');
  }
  const cellSize = width / LATTICE_PRODUCTION_GEOMETRY.columns;
  const planeHeight = cellSize * LATTICE_PRODUCTION_GEOMETRY.rows;
  const verticalOverflow = Math.max(0, (planeHeight - height) / 2);
  return Object.freeze({
    cellSize,
    width,
    height: planeHeight,
    left: 0,
    top: (height - planeHeight) / 2,
    minimumCameraY: verticalOverflow === 0 ? 0 : -verticalOverflow,
    maximumCameraY: verticalOverflow,
  });
}

export function clampLatticeOwnerCameraY(value, viewport) {
  if (!Number.isFinite(value) || !viewport
    || !Number.isFinite(viewport.minimumCameraY)
    || !Number.isFinite(viewport.maximumCameraY)) {
    throw new TypeError('Owner lattice camera requires a finite offset and viewport bounds');
  }
  return clamp(value, viewport.minimumCameraY, viewport.maximumCameraY);
}

export function updateLatticeOwnerCameraY({ originY, pointerY, startCameraY }, viewport) {
  if (![originY, pointerY, startCameraY].every(Number.isFinite)) {
    throw new TypeError('Owner lattice camera gesture requires finite coordinates');
  }
  return clampLatticeOwnerCameraY(startCameraY + (pointerY - originY), viewport);
}
