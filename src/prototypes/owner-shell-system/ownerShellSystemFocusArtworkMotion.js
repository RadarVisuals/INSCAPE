export const OWNER_SHELL_SYSTEM_FOCUS_TRANSITION_MS = 420;

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

export function ownerShellSystemFocusTransitionProgress(progress) {
  const clamped = clampUnit(progress);
  if (clamped === 0 || clamped === 1) return clamped;
  const time = solveCurveTime(clamped, 0.22, 0.26);
  return curve(time, 0.76, 1);
}

export function interpolateOwnerShellSystemFocusCrop(start, end, progress) {
  return {
    x: start.x + ((end.x - start.x) * progress),
    y: start.y + ((end.y - start.y) * progress),
    zoom: start.zoom + ((end.zoom - start.zoom) * progress),
  };
}
