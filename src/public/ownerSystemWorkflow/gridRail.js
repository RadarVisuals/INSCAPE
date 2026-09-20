// A bounded neighborhood occupies stable slots on a continuous visual rail.
// The viewport clips offscreen slots; entering a Grid needs no visibility toggle.
// Incoming wins for two-Grid loops, where previous and next share one Grid ID.
export function gridRailSlot(id, { sourceId, targetId, sourceSlot = 0, direction, previousId, nextId, aheadId, behindId }) {
  if (id === sourceId) return sourceSlot;
  if (id === targetId) return sourceSlot + (direction === 'previous' ? -1 : 1);
  // In short loops the far neighbor shares an ID with the near neighbor on the
  // other side. Prepare it in the direction of travel, beyond the incoming Grid.
  if (direction === 'next' && id === aheadId) return sourceSlot + 2;
  if (direction === 'previous' && id === behindId) return sourceSlot - 2;
  if (id === previousId) return sourceSlot - 1;
  if (id === nextId) return sourceSlot + 1;
  return sourceSlot + (id === aheadId ? 2 : -2);
}

// Match the existing one-pixel overlap without measuring layout during motion.
export const gridRailTransform = slot => `translateX(calc(${slot * 100}% - ${slot}px))`;
