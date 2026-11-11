import { assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { placementGroup, requireCompleteGroups } from './domain/placementGroups.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

export function createPlacementGroupCandidate(input, { gridId, placementIds, expectedPlacements }) {
  const draft = assertValidSystemWorkflowDraft(input), grid = draft.grids.find(item => item.id === gridId);
  if (!grid || grid.visibility !== 'PUBLIC' || !Array.isArray(placementIds) || placementIds.length < 2
    || new Set(placementIds).size !== placementIds.length || expectedPlacements?.length !== placementIds.length) throw new Error('Select at least two unlocked artwork layers.');
  for (const id of placementIds) {
    const placement = grid.placements.find(item => item.id === id);
    if (!placement || placement.locked || placement.kind === 'text' || placement.visibility !== 'PUBLIC'
      || placementGroup(grid, id)) throw new Error('Select ungrouped, unlocked artwork layers.');
    if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacements.find(item => item.id === id))) throw new Error('The selection changed. Select it again.');
  }
  grid.groups = [...(grid.groups || []), { id: `group:${globalThis.crypto.randomUUID()}`, placementIds: [...placementIds] }];
  return assertValidSystemWorkflowDraft(draft);
}

export function ungroupPlacementsCandidate(input, { gridId, groupId, expectedGroup, expectedPlacements }) {
  const draft = assertValidSystemWorkflowDraft(input), grid = draft.grids.find(item => item.id === gridId);
  const group = grid?.groups?.find(item => item.id === groupId);
  if (!group || JSON.stringify(group) !== JSON.stringify(expectedGroup) || expectedPlacements?.length !== group.placementIds.length) throw new Error('The group changed. Select it again.');
  if (grid.visibility !== 'PUBLIC') throw new Error('Select a public Grid.');
  for (const id of group.placementIds) {
    const placement = grid.placements.find(item => item.id === id);
    if (placement.locked) throw new Error('Unlock the group first.');
    if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacements.find(item => item.id === id))) throw new Error('The group changed. Select it again.');
  }
  grid.groups = grid.groups.filter(item => item.id !== groupId);
  if (!grid.groups.length) delete grid.groups;
  return assertValidSystemWorkflowDraft(draft);
}

// Guard the existing operations; grouping does not create a parallel transform path.
export function guardGroupedOperation(draft, request = {}) {
  const grid = draft.grids.find(item => item.id === request.gridId);
  const ids = request.placementIds || request.moves?.map(item => item.placementId) || request.placements?.map(item => item.placementId || item.id) || [request.placementId];
  requireCompleteGroups(grid, ids);
  return draft;
}
