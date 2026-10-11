import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';

test('fit, cover and centre are atomic, undoable, preserve content and reject stale or locked artwork', () => {
  const values = new Map();
  const store = createSystemWorkflowDraftStore({ profileAddress: `0x${'1'.repeat(40)}`, storage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) } });
  const session = createSystemWorkflowAuthoringSession({ store });
  const gridId = session.getState().selectedGridId;
  session.placeAsset({ gridId, stableAssetId: '42:0x1111111111111111111111111111111111111111:0x01', nativeWidth: 800, nativeHeight: 400 });
  const current = () => store.getDraft().grids.find(g => g.id === gridId).placements[0];
  const original = current();
  const arrange = mode => session.arrangePlacement({ gridId, placementId: current().id, expectedPlacement: current(), mode, aspectRatio: 2 });
  arrange('cover'); assert.equal(current().columnSpan, 36); assert.equal(current().rowSpan, 18); assert.equal(current().column, -2);
  assert.deepEqual(current().crop, original.crop); assert.equal(current().stableAssetId, original.stableAssetId);
  assert.throws(() => session.arrangePlacement({ gridId, placementId: original.id, expectedPlacement: original, mode: 'fit', aspectRatio: 2 }), /changed/);
  store.undo(); assert.deepEqual(current(), original);
  arrange('fit'); assert.equal(current().columnSpan, 32); assert.equal(current().rowSpan, 16); assert.equal(current().row, 1);
  assert.equal(arrange('centre'), false);
  const draft = store.getDraft(); draft.grids.find(g => g.id === gridId).placements[0].locked = true;
  store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
  assert.throws(() => arrange('cover'), /unlocked/);
});
