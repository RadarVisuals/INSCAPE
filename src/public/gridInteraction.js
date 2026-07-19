export const INTERACTION_KIND = Object.freeze({
  IDLE: 'IDLE',
  MOVE_LAUNCHER: 'MOVE_LAUNCHER',
  RESIZE_LAUNCHER: 'RESIZE_LAUNCHER',
  MOVE_CANVAS_OBJECT: 'MOVE_CANVAS_OBJECT',
  RESIZE_CANVAS_OBJECT: 'RESIZE_CANVAS_OBJECT',
  MOVE_WINDOW: 'MOVE_WINDOW',
  RESIZE_WINDOW: 'RESIZE_WINDOW'
});

let nextInteractionId = 1;

export function createInteraction(input) {
  if (!input || input.kind === INTERACTION_KIND.IDLE) return null;
  const originGeometry = { ...input.originGeometry };
  return {
    interactionId: nextInteractionId++,
    kind: input.kind,
    targetId: input.targetId,
    pointerId: input.pointerId,
    originGeometry,
    candidateGeometry: originGeometry,
    lastValidGeometry: originGeometry,
    gridBounds: { ...input.gridBounds },
    cellWidth: input.cellWidth,
    cellHeight: input.cellHeight,
    pointerGrabOffset: { ...input.pointerGrabOffset },
    valid: true,
    activated: false,
    startPointer: { ...input.startPointer },
    captureElement: input.captureElement || null
  };
}

export function activateInteraction(interaction, candidateGeometry, valid) {
  if (!interaction) return null;
  const candidate = valid ? { ...candidateGeometry } : interaction.lastValidGeometry;
  return {
    ...interaction,
    activated: true,
    valid,
    candidateGeometry: candidate,
    lastValidGeometry: valid ? candidate : interaction.lastValidGeometry
  };
}

export function interactionMatches(interaction, { interactionId, pointerId }) {
  return Boolean(interaction && interaction.interactionId === interactionId && interaction.pointerId === pointerId);
}

export function effectiveGeometry(committedGeometry, interaction, targetId) {
  return interaction?.targetId === targetId ? interaction.candidateGeometry : committedGeometry;
}
