import {
  LATTICE_COORDINATES,
  LATTICE_ENTRY_COORDINATE,
  latticeCoordinateKey,
} from '../domain/latticeProfile.js';

export const DEFAULT_LATTICE_INTERACTION_CONFIG = Object.freeze({
  deadZone: 10,
  commitThreshold: 72,
  diagonalTolerance: 0.35,
  edgeResistance: 0.18,
  wheelAccumulationThreshold: 80,
  wheelCooldown: 520,
  snapDuration: 360,
  guideThreshold: 8,
  guideReleaseThreshold: 14,
  minimumArtworkPixels: 40,
});

const COORDINATE_KEYS = new Set(LATTICE_COORDINATES.map(latticeCoordinateKey));

export const isLatticeCoordinate = (coordinate) => COORDINATE_KEYS.has(latticeCoordinateKey(coordinate));

export function latticeDestination(coordinate, direction) {
  const candidate = {
    x: coordinate.x + direction.x,
    y: coordinate.y + direction.y,
  };
  return isLatticeCoordinate(candidate) ? candidate : null;
}

export function pointerDirection(delta, diagonalTolerance) {
  const horizontal = Math.abs(delta.x);
  const vertical = Math.abs(delta.y);
  const greatest = Math.max(horizontal, vertical);
  if (!greatest) return null;

  const includeBothAxes = Math.min(horizontal, vertical) / greatest >= 1 - diagonalTolerance;
  return {
    x: includeBothAxes || horizontal > vertical ? -Math.sign(delta.x) : 0,
    y: includeBothAxes || vertical > horizontal ? -Math.sign(delta.y) : 0,
  };
}

export function keyboardDirection(key) {
  if (key === 'ArrowLeft') return { x: -1, y: 0 };
  if (key === 'ArrowRight') return { x: 1, y: 0 };
  if (key === 'ArrowUp') return { x: 0, y: -1 };
  if (key === 'ArrowDown') return { x: 0, y: 1 };
  return null;
}

export function createPointerGesture(point) {
  return {
    origin: { x: point.x, y: point.y },
    direction: null,
    activated: false,
    offset: { x: 0, y: 0 },
  };
}

function limitedOffset(delta, direction, activeCoordinate, edgeResistance) {
  const offset = {
    x: direction.x ? delta.x : 0,
    y: direction.y ? delta.y : 0,
  };

  if (direction.x > 0) offset.x = Math.min(0, offset.x);
  if (direction.x < 0) offset.x = Math.max(0, offset.x);
  if (direction.y > 0) offset.y = Math.min(0, offset.y);
  if (direction.y < 0) offset.y = Math.max(0, offset.y);

  if (direction.x && !latticeDestination(activeCoordinate, { x: direction.x, y: 0 })) {
    offset.x *= edgeResistance;
  }
  if (direction.y && !latticeDestination(activeCoordinate, { x: 0, y: direction.y })) {
    offset.y *= edgeResistance;
  }
  return offset;
}

export function updatePointerGesture(gesture, point, activeCoordinate, config = DEFAULT_LATTICE_INTERACTION_CONFIG) {
  const delta = {
    x: point.x - gesture.origin.x,
    y: point.y - gesture.origin.y,
  };
  const distance = Math.hypot(delta.x, delta.y);
  const activated = gesture.activated || distance >= config.deadZone;
  const direction = gesture.direction || (activated
    ? pointerDirection(delta, config.diagonalTolerance)
    : null);
  const offset = direction
    ? limitedOffset(delta, direction, activeCoordinate, config.edgeResistance)
    : { x: 0, y: 0 };

  return { ...gesture, activated, direction, offset };
}

export function finishPointerGesture(gesture, activeCoordinate, config = DEFAULT_LATTICE_INTERACTION_CONFIG) {
  if (!gesture?.activated || !gesture.direction) return { ...activeCoordinate };
  const committedDistance = Math.hypot(gesture.offset.x, gesture.offset.y);
  if (committedDistance < config.commitThreshold) return { ...activeCoordinate };
  return latticeDestination(activeCoordinate, gesture.direction) || { ...activeCoordinate };
}

export function addWheelDelta(accumulator, delta) {
  return {
    x: accumulator.x + delta.x,
    y: accumulator.y + delta.y,
  };
}

export function resolveWheelDestination(accumulator, activeCoordinate, config = DEFAULT_LATTICE_INTERACTION_CONFIG) {
  const distance = Math.hypot(accumulator.x, accumulator.y);
  if (distance < config.wheelAccumulationThreshold) return null;
  const pointerLikeDirection = pointerDirection(
    { x: -accumulator.x, y: -accumulator.y },
    config.diagonalTolerance,
  );
  return latticeDestination(activeCoordinate, pointerLikeDirection) || { ...activeCoordinate };
}

export function entryLatticeCoordinate() {
  return { ...LATTICE_ENTRY_COORDINATE };
}
