// A bounded neighborhood occupies stable slots on a continuous visual rail.
// The viewport clips offscreen slots; entering a Grid needs no visibility toggle.
// Short loops render separate appearances of the same authored Grid. No visible
// scene must be recycled at the seam; only distant appearances are replenished.
export function gridRailScenes(grids, sourceId, sourceSlot = 0) {
  const index = grids.findIndex(grid => grid.id === sourceId);
  if (index < 0) return [];
  return (grids.length > 1 ? [-2, -1, 0, 1, 2] : [0]).map(offset => ({
    grid: grids[(index + offset % grids.length + grids.length) % grids.length],
    slot: sourceSlot + offset,
  }));
}

// Each scene occupies one full viewport. Camera and slots use the same CSS
// percentage, including fractional widths, so neighbours stay outside at rest.
export const gridRailTransform = slot => `translateX(${slot * 100}%)`;
