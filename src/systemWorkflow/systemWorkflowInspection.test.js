import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { createSystemWorkflowInspectionCandidate } from './systemWorkflowInspection.js';

test('inspection is an explicit artwork choice with stale, private and locked guards', () => {
  const draft = createEmptySystemWorkflowDraft('0x' + '1'.repeat(40), { generateId: () => 'home' });
  const placement = { id: 'art', stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01', column: 0, row: 0,
    columnSpan: 2, rowSpan: 2, layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
    backing: { enabled: false, color: '#000000' }, transparencyMode: 'AUTO',
    visibility: 'PUBLIC', locked: false, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
  draft.grids[0].placements = [placement];
  const request = { gridId: draft.grids[0].id, placementId: placement.id, expectedPlacement: placement, inspectionMode: 'LIFT' };
  assert.equal(createSystemWorkflowInspectionCandidate(draft, request), null);
  const changed = createSystemWorkflowInspectionCandidate(draft, { ...request, inspectionMode: 'IN_PLACE' });
  assert.equal(changed.grids[0].placements[0].inspectionMode, 'IN_PLACE');
  assert.equal(placement.inspectionMode, undefined);
  assert.throws(() => createSystemWorkflowInspectionCandidate(changed, request), /changed/);
  assert.throws(() => createSystemWorkflowInspectionCandidate(draft, { ...request, inspectionMode: 'ZOOM' }), /Unknown/);
  for (const patch of [{ locked: true }, { visibility: 'PRIVATE' }]) {
    const unavailable = structuredClone(draft); Object.assign(unavailable.grids[0].placements[0], patch);
    assert.throws(() => createSystemWorkflowInspectionCandidate(unavailable, request), /unavailable/);
  }
});
