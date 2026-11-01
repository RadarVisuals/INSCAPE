import { assertValidSystemWorkflowDraft, isSystemWorkflowWorldCoverGrid, quantizeSystemWorkflowGridCoordinate as quantize } from './domain/systemWorkflowDraft.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

export function createSystemWorkflowArrangeCandidate(input, { gridId, placementId, expectedPlacement, mode, aspectRatio }) {
  const draft = assertValidSystemWorkflowDraft(input);
  const grid = draft.grids.find(item => item.id === gridId);
  const placement = grid?.placements.find(item => item.id === placementId);
  if (!placement || !sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) throw new Error('The selected artwork changed. Select it again.');
  if (grid.visibility !== 'PUBLIC' || placement.visibility !== 'PUBLIC' || placement.locked || placement.kind === 'text') throw new Error('Select an unlocked artwork.');
  if (!['fit', 'cover', 'centre'].includes(mode)) throw new Error('Unknown arrangement action.');
  const { columns, rows } = isSystemWorkflowWorldCoverGrid(grid) ? { columns: 32, rows: 18 } : draft.geometry;
  let { columnSpan, rowSpan } = placement;
  if (mode !== 'centre') {
    if (!(Number.isFinite(aspectRatio) && aspectRatio > 0)) throw new Error('Image dimensions are not available yet.');
    const ratio = placement.transform.quarterTurns % 2 ? 1 / aspectRatio : aspectRatio;
    const height = Math[mode === 'cover' ? 'max' : 'min'](columns / ratio, rows);
    const round = value => Math[mode === 'cover' ? 'ceil' : 'floor']((value + (mode === 'cover' ? -1 : 1) * 1e-8) * 9) / 9;
    columnSpan = round(height * ratio); rowSpan = round(height);
  }
  const next = { column: quantize((columns - columnSpan) / 2), row: quantize((rows - rowSpan) / 2), columnSpan, rowSpan };
  if (Object.entries(next).every(([key, value]) => placement[key] === value) && (mode === 'centre' || placement.mediaFrameRatio === undefined)) return null;
  if (mode !== 'centre') delete placement.mediaFrameRatio;
  Object.assign(placement, next);
  return assertValidSystemWorkflowDraft(draft);
}
