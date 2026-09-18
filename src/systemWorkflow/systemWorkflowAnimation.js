import { assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { validPlacementAnimation } from './domain/placementAnimation.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

export function createSystemWorkflowAnimationCandidate(input, { gridId, placementId, expectedPlacement, animation }) {
  const draft = assertValidSystemWorkflowDraft(input);
  const grid = draft.grids.find(item => item.id === gridId);
  const placement = grid?.placements.find(item => item.id === placementId);
  if (!placement || !sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) throw new Error('The artwork changed. Select it again.');
  if (grid.visibility !== 'PUBLIC' || placement.visibility !== 'PUBLIC' || placement.locked || placement.kind === 'text') throw new Error('Select an unlocked artwork.');
  if (animation !== null && !validPlacementAnimation(animation)) throw new Error('Invalid animation settings.');
  if (JSON.stringify(placement.animation || null) === JSON.stringify(animation)) return null;
  if (animation === null) delete placement.animation;
  else placement.animation = structuredClone(animation);
  return assertValidSystemWorkflowDraft(draft);
}
