// Old writers included this disabled default even when mats were never used.
// Only the validated read result is cleaned; reading never rewrites storage.
function isUnusedArtworkMat(value) {
  return value && Object.keys(value).length === 3 && value.enabled === false
    && /^#[0-9a-f]{6}$/i.test(value.color) && value.inset
    && Object.keys(value.inset).length === 4
    && ['top', 'right', 'bottom', 'left'].every(edge => value.inset[edge] === 0);
}

export const REMOVED_ARTWORK_PRESENTATION_KEYS = Object.freeze(['mat', 'frameId', 'backing', 'transparencyMode']);

export function validRemovedArtworkPresentation(value) {
  return (!Object.hasOwn(value, 'mat') || isUnusedArtworkMat(value.mat))
    && (!Object.hasOwn(value, 'frameId') || ['NONE', 'DOSSIER', 'CAPTION'].includes(value.frameId))
    && (!Object.hasOwn(value, 'transparencyMode') || ['AUTO', 'PRESERVE_ALPHA', 'OPAQUE'].includes(value.transparencyMode))
    && (!Object.hasOwn(value, 'backing') || value.backing && Object.keys(value.backing).length === 2
      && typeof value.backing.enabled === 'boolean' && /^#[0-9a-f]{6}$/i.test(value.backing.color));
}

export function withoutRemovedArtworkPresentation(input) {
  const result = structuredClone(input);
  const clean = grids => {
    for (const grid of grids || []) for (const placement of grid.placements || []) {
      for (const key of REMOVED_ARTWORK_PRESENTATION_KEYS) delete placement[key];
    }
  };
  clean(result.grids);
  if (result.metadata?.worldCover?.grid) clean([result.metadata.worldCover.grid]);
  for (const display of result.displays || []) clean(display.grids);
  return result;
}
