export const SPATIAL_WORLD_LEVEL = Object.freeze({
  UPPER: -1,
  HOME: 0,
  GALLERY: 1
});

export function getSpatialWorldDirection(fromLevel, toLevel) {
  const from = Number(fromLevel) || 0;
  const to = Number(toLevel) || 0;
  return Math.sign(to - from);
}

export function getSpatialWorldStackOffset(level, activeLevel) {
  const worldLevel = Number(level) || 0;
  const currentLevel = Number(activeLevel) || 0;
  return (worldLevel - currentLevel) * 100;
}
