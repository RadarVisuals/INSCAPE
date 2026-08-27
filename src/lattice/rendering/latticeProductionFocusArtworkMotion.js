export const LATTICE_PRODUCTION_FOCUS_TRANSITION_MS = 420;

const clampUnit = (value) => Math.min(1, Math.max(0, value));
const curve = (time, point1, point2) => {
  const coefficientA = 1 - (3 * point2) + (3 * point1);
  const coefficientB = (3 * point2) - (6 * point1);
  const coefficientC = 3 * point1;
  return ((coefficientA * time + coefficientB) * time + coefficientC) * time;
};
const curveDerivative = (time, point1, point2) => {
  const coefficientA = 1 - (3 * point2) + (3 * point1);
  const coefficientB = (3 * point2) - (6 * point1);
  const coefficientC = 3 * point1;
  return ((3 * coefficientA * time) + (2 * coefficientB)) * time + coefficientC;
};

const solveCurveTime = (progress, x1, x2) => {
  let time = progress;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const error = curve(time, x1, x2) - progress;
    if (Math.abs(error) < 1e-6) return time;
    const slope = curveDerivative(time, x1, x2);
    if (Math.abs(slope) < 1e-6) break;
    time -= error / slope;
  }
  let lower = 0;
  let upper = 1;
  time = progress;
  while (upper - lower > 1e-6) {
    const value = curve(time, x1, x2);
    if (value < progress) lower = time;
    else upper = time;
    time = (lower + upper) / 2;
  }
  return time;
};

export function latticeProductionFocusTransitionProgress(progress) {
  const clamped = clampUnit(progress);
  if (clamped === 0 || clamped === 1) return clamped;
  return curve(solveCurveTime(clamped, 0.22, 0.26), 0.76, 1);
}

export function interpolateLatticeProductionFocusRectangle(start, end, progress) {
  const amount = clampUnit(progress);
  return {
    left: start.left + ((end.left - start.left) * amount),
    top: start.top + ((end.top - start.top) * amount),
    width: start.width + ((end.width - start.width) * amount),
    height: start.height + ((end.height - start.height) * amount),
  };
}

export function localizeLatticeProductionFocusRectangle(rectangle, container) {
  return {
    left: rectangle.left - container.left,
    top: rectangle.top - container.top,
    width: rectangle.width,
    height: rectangle.height,
  };
}

const renderRectangle = (rectangle, projection) => projection.swapped ? {
  left: rectangle.left + ((rectangle.width - rectangle.height) / 2),
  top: rectangle.top + ((rectangle.height - rectangle.width) / 2),
  width: rectangle.height,
  height: rectangle.width,
} : rectangle;

export function projectLatticeProductionFocusMediaMotion(placement, dimensions, motion) {
  const projection = projectLatticeProductionTransform(placement.transform, dimensions, placement.crop);
  const sourceOpening = motion.sourceRectangle;
  const sourceVisual = projection.crop
    ? projectCroppedMediaRectangle(sourceOpening, projection.dimensions, projection.crop)
    : fitNativeMediaRectangle(sourceOpening, projection.dimensions);
  const targetOpening = projectArtworkMat(motion.focusedRectangle, placement.mat).mediaOpeningRectangle;
  const targetVisual = fitNativeMediaRectangle(targetOpening, projection.dimensions);
  const screenRectangle = interpolateLatticeProductionFocusRectangle(
    renderRectangle(sourceVisual, projection),
    renderRectangle(targetVisual, projection),
    motion.progress,
  );
  return Object.freeze({
    css: projection.css,
    rectangle: Object.freeze(localizeLatticeProductionFocusRectangle(
      screenRectangle,
      motion.currentRectangle,
    )),
  });
}
import { projectLatticeProductionTransform } from '../authoring/latticeProductionTransform.js';
import { projectCroppedMediaRectangle } from './latticeCrop.js';
import { fitNativeMediaRectangle } from './latticeGeometry.js';
import { projectArtworkMat } from './latticeMat.js';
