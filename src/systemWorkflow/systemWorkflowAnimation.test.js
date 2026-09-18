import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';
import { createDisplayModuleSession, addDisplayModule } from './displayModuleSession.js';
import { ANIMATION_DEFAULTS, validPlacementAnimation } from './domain/placementAnimation.js';
import { placementMotionStyle } from '../animation/placementMotion.js';

const profileAddress = `0x${'1'.repeat(40)}`;
const asset = '42:0x1111111111111111111111111111111111111111:0x01';
function setup() {
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  const session = createSystemWorkflowAuthoringSession({ store });
  const gridId = session.getState().selectedGridId;
  for (let i = 0; i < 2; i++) session.placeAsset({ gridId, stableAssetId: asset, nativeWidth: 800, nativeHeight: 400 });
  const current = () => store.getDraft().grids.find(g => g.id === gridId).placements[0];
  const change = animation => session.setPlacementAnimation({ gridId, placementId: current().id, expectedPlacement: current(), animation });
  return { storage, store, session, gridId, current, change };
}
test('effects affect one placement, save, undo, redo and removal retains original geometry and asset', () => {
  const { storage, store, current, change } = setup();
  const original = current();
  change(ANIMATION_DEFAULTS);
  assert.deepEqual(current(), { ...original, animation: ANIMATION_DEFAULTS });
  assert.equal(store.getDraft().grids[0].placements[1].animation, undefined);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft(), store.getDraft());
  store.undo(); assert.deepEqual(current(), original);
  store.redo(); assert.deepEqual(current().animation, ANIMATION_DEFAULTS);
  change(null); assert.deepEqual(current(), original);
  assert.equal(change(null), false);
});
test('stale, locked, private and invalid effect edits cannot replace saved work', () => {
  const { store, session, gridId, current, change } = setup();
  const original = current(); change(ANIMATION_DEFAULTS);
  assert.throws(() => session.setPlacementAnimation({ gridId, placementId: original.id, expectedPlacement: original, animation: null }), /changed/);
  for (const animation of [{}, { float: null }, { flicker: { depth: 2, period: 6 } }, { float: { ...ANIMATION_DEFAULTS.float, period: 0 } }, { other: {} }]) {
    const before = store.getDraft(); assert.throws(() => change(animation), /Invalid/); assert.deepEqual(store.getDraft(), before);
  }
  for (const update of [p => { p.locked = true; }, p => { p.locked = false; p.visibility = 'PRIVATE'; }]) {
    const draft = store.getDraft(); update(draft.grids[0].placements[0]); store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
    assert.throws(() => change(null), /unlocked/);
  }
});
test('animation edits use the originating Display session', () => {
  const { store } = setup();
  const before = store.getDraft(); const id = addDisplayModule(store);
  const session = createDisplayModuleSession(store, id), gridId = session.getState().selectedGridId;
  session.placeAsset({ gridId, stableAssetId: asset, nativeWidth: 400, nativeHeight: 400 });
  const placement = session.getState().draft.grids[0].placements[0];
  session.setPlacementAnimation({ gridId, placementId: placement.id, expectedPlacement: placement, animation: ANIMATION_DEFAULTS });
  assert.deepEqual(store.getDraft().grids, before.grids);
  assert.deepEqual(store.getDraft().displays[0].grids[0].placements[0].animation, ANIMATION_DEFAULTS);
});
test('motion uses canvas scale without changing geometry and can be disabled', () => {
  assert.equal(validPlacementAnimation(ANIMATION_DEFAULTS), true);
  assert.deepEqual(placementMotionStyle(ANIMATION_DEFAULTS, 20, false), {});
  const style = placementMotionStyle(ANIMATION_DEFAULTS, 20, true);
  assert.equal(style['--motion-x'], '7px'); assert.equal(style['--motion-y'], '4px');
  assert.equal(style.animationName, 'inscape-float, inscape-flicker');
  assert.equal(style.transform, undefined);
});

test('disabled settings survive reload and re-enable without altering their values', () => {
  const { storage, store, current, change } = setup();
  const enabled = { float: { horizontal: 1.4, vertical: .65, period: 12 }, flicker: { depth: .3, period: 10 } };
  change(enabled);
  const disabled = { float: { ...enabled.float, enabled: false }, flicker: { ...enabled.flicker, enabled: false } };
  change(disabled);
  assert.deepEqual(placementMotionStyle(current().animation, 30, true), {});
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft(), store.getDraft());
  change({ ...disabled, float: enabled.float });
  assert.equal(placementMotionStyle(current().animation, 30, true).animationName, 'inscape-float');
  assert.deepEqual(current().animation.float, enabled.float);
  store.undo(); assert.deepEqual(current().animation, disabled);
  store.redo(); assert.deepEqual(current().animation.float, enabled.float);
});

test('disabled effects still require valid exact settings and legacy effects remain active', () => {
  assert.equal(placementMotionStyle(ANIMATION_DEFAULTS, 30, true).animationName, 'inscape-float, inscape-flicker');
  for (const float of [
    { ...ANIMATION_DEFAULTS.float, enabled: 'false' },
    { ...ANIMATION_DEFAULTS.float, enabled: false, horizontal: Infinity },
    { enabled: false },
    { ...ANIMATION_DEFAULTS.float, injected: true },
  ]) assert.equal(validPlacementAnimation({ float }), false);
  assert.equal(validPlacementAnimation({ float: { ...ANIMATION_DEFAULTS.float, enabled: true } }), true);
});

test('failed effect writes preserve the accepted draft and history and can be retried', () => {
  const { storage, store, current, change } = setup();
  change(ANIMATION_DEFAULTS);
  const before = store.getDraft(), history = store.getHistory(), write = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => change(null), /could not be saved/);
  assert.deepEqual(store.getDraft(), before);
  assert.deepEqual(store.getHistory(), history);
  storage.setItem = write;
  change(null);
  assert.equal(current().animation, undefined);
  store.undo(); assert.deepEqual(store.getDraft(), before);
});
