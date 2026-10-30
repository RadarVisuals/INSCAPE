import test from 'node:test';
import assert from 'node:assert/strict';
import { changeWorkbenchSelection as change, initialWorkbenchSelection as initial, reconcileWorkbenchSelection as reconcile, workbenchSelectionTarget as target } from './workbenchSelection.js';

const content = () => ({
  grids: [{ id: 'grid:a' }], displays: [{ id: 'display:b' }],
  imageModules: [{ id: 'image:a' }, { id: 'image:b' }], shapes: [{ id: 'shape:a' }], texts: [{ id: 'text:a' }],
  workbench: { texts: [{ id: 'text:a', frames: [{ id: 'text-frame:a' }] }] },
  artworkLayers: ['image:a', 'image:b', 'shape:a', 'text:a'],
});
test('Layers replacement and additive toggles derive the surviving and empty tool target', () => {
  const draft = content(); let state = initial(draft);
  state = change(state, { type: 'layers', ids: ['image:a'] }, draft);
  assert.equal(target(state, draft), 'image:a'); assert.equal(state.mode, 'module');
  state = change(state, { type: 'layers', ids: ['image:b'], additive: true }, draft);
  assert.deepEqual(state.ids, ['image:a', 'image:b']); assert.equal(target(state, draft), null);
  state = change(state, { type: 'layers', ids: ['image:b'], additive: true }, draft);
  assert.equal(target(state, draft), 'image:a');
  state = change(state, { type: 'layers', ids: ['image:a'], additive: true }, draft);
  assert.deepEqual(state.ids, []); assert.equal(target(state, draft), null);
});
test('focus changes ordinary activation but cannot replace an explicit candidate group', () => {
  const draft = content(); let state = initial(draft, 'image:a');
  state = change(state, { type: 'focus', id: 'image:b' }, draft);
  assert.equal(target(state, draft), 'image:b');
  state = change(state, { type: 'replace', ids: ['image:a', 'image:b'] }, draft);
  assert.equal(change(state, { type: 'focus', id: 'shape:a' }, draft), state);
  state = change(state, { type: 'select', id: 'shape:a' }, draft);
  assert.deepEqual(state.ids, ['shape:a']); assert.equal(state.mode, 'module');
});
test('continuation windows stay distinct while a single frame targets its Text owner', () => {
  const draft = content(); let state = change(initial(draft), { type: 'select', id: 'text-frame:a' }, draft);
  assert.equal(target(state, draft), 'text:a');
  assert.equal(change(state, { type: 'focus', id: 'text:a' }, draft), state);
  state = change(state, { type: 'layers', ids: ['text:a'] }, draft);
  assert.deepEqual(state.ids, ['text:a', 'text-frame:a']); assert.equal(target(state, draft), null);
  const next = structuredClone(draft); next.workbench.texts[0].frames = [];
  state = reconcile(state, next);
  assert.deepEqual(state.ids, ['text:a']); assert.equal(target(state, next), 'text:a');
});
test('confirmed deletion discards a selection that Undo does not automatically resurrect', () => {
  const draft = content(), state = initial(draft, 'image:a'), before = structuredClone(draft);
  assert.equal(reconcile(state, draft), state, 'failed storage leaves the accepted draft and selection unchanged');
  const deleted = structuredClone(draft); deleted.imageModules = [{ id: 'image:b' }]; deleted.artworkLayers.shift();
  const empty = reconcile(state, deleted);
  assert.deepEqual(empty.ids, []); assert.equal(target(empty, deleted), null);
  assert.equal(reconcile(empty, draft), empty, 'restored content is not a selection command');
  assert.deepEqual(draft, before, 'selection never edits the authored draft');
});
test('entering and leaving a composition block changes its editing scope and selection together', () => {
  const draft = content(); draft.artworkLayers = [{ id: 'composition:a', name: 'Pair', children: ['image:a', 'image:b'] }, 'shape:a', 'text:a'];
  let state = change(initial(draft), { type: 'layers', ids: ['image:a', 'image:b'] }, draft);
  state = change(state, { type: 'enter', id: 'composition:a' }, draft);
  assert.deepEqual(state.ids, []); assert.equal(state.blockId, 'composition:a'); assert.equal(target(state, draft), null);
  state = change(state, { type: 'layers', ids: ['image:b'], part: 'composition:a' }, draft);
  assert.equal(state.blockId, 'composition:a'); assert.equal(target(state, draft), 'image:b');
  state = change(state, { type: 'leave' }, draft);
  assert.deepEqual(state.ids, ['image:a', 'image:b']); assert.equal(state.blockId, null); assert.equal(target(state, draft), null);
});
test('invalid restored targets and removed blocks are discarded; Display placement content is untouched', () => {
  const draft = content(); draft.grids[0].placements = [{ id: 'placement:a' }];
  assert.equal(target(initial(draft, 'image:absent'), draft), null);
  const state = initial(draft, 'display:primary'), before = structuredClone(draft);
  assert.equal(target(state, draft), 'display:primary');
  assert.deepEqual(state.ids, [], 'placement editing does not select the Display window');
  const explicit = change(state, { type: 'replace', ids: ['display:primary'] }, draft);
  assert.deepEqual(explicit.ids, ['display:primary'], 'explicit window selection remains distinct');
  assert.equal(target(explicit, draft), 'display:primary');
  assert.equal(target(change(state, { type: 'clear' }, draft), draft), null);
  assert.deepEqual(draft, before);
  assert.equal(reconcile({ ...state, blockId: 'composition:gone' }, draft).blockId, null);
});
test('a new session has no old selection, and the read-only model requires no owner store', () => {
  const draft = content(), before = structuredClone(draft);
  const a = change(initial(draft), { type: 'select', id: 'image:a' }, draft);
  const b = initial({ ...draft, imageModules: [] });
  const returningA = initial(draft);
  assert.deepEqual([b.ids, returningA.ids], [[], []]); assert.equal(target(a, draft), 'image:a');
  assert.deepEqual(draft, before);
});
test('camera return preserves selection intent and cannot restore a deleted module', () => {
  const draft = content();
  const solo = change(initial(draft), { type: 'select', id: 'image:a' }, draft);
  const group = change(solo, { type: 'replace', ids: ['image:a', 'image:b'] }, draft);
  const empty = initial(draft);
  assert.deepEqual(change(empty, { type: 'restore', state: solo }, draft), solo);
  assert.equal(change(empty, { type: 'restore', state: solo }, draft).mode, 'module');
  assert.deepEqual(change(empty, { type: 'restore', state: group }, draft), group);
  const display = initial(draft, 'display:primary');
  assert.deepEqual(change(empty, { type: 'restore', state: display }, draft), display);
  const deleted = { ...draft, imageModules: draft.imageModules.filter(item => item.id !== 'image:a') };
  const restored = change(empty, { type: 'restore', state: solo }, deleted);
  assert.deepEqual(restored.ids, []); assert.equal(target(restored, deleted), null);
});

test('arrival retains native tools without selecting the module again; a Layers choice explicitly selects it', () => {
  const draft = content(), before = structuredClone(draft);
  const selected = change(initial(draft), { type: 'layers', ids: ['image:a'] }, draft);
  const arrived = change(selected, { type: 'arrive', id: 'image:a' }, draft);
  assert.deepEqual(arrived.ids, ['image:a']); assert.equal(target(arrived, draft), 'image:a');
  assert.equal(arrived.mode, 'activation');
  assert.equal(change(arrived, { type: 'focus', id: 'image:a' }, draft), arrived);
  assert.equal(change(arrived, { type: 'layers', ids: ['image:a'] }, draft).mode, 'module');
  assert.equal(change(arrived, { type: 'select', id: 'image:a' }, draft).mode, 'module');
  const next = change(arrived, { type: 'focus', id: 'image:b' }, draft);
  assert.deepEqual(next.ids, ['image:b']); assert.equal(next.mode, 'module');
  assert.deepEqual(draft, before);
});
test('first explicit membership after arrival starts empty; ordinary activation and later toggles retain their meaning', () => {
  const draft = content(), toggle = id => ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
  const arrived = change(initial(draft), { type: 'arrive', id: 'image:a' }, draft);
  const same = change(arrived, { type: 'replace', ids: toggle('image:a') }, draft);
  assert.deepEqual(same.ids, ['image:a']); assert.equal(same.mode, 'explicit');
  assert.deepEqual(change(same, { type: 'replace', ids: toggle('image:a') }, draft).ids, []);
  const different = change(arrived, { type: 'replace', ids: toggle('image:b') }, draft);
  assert.deepEqual(different.ids, ['image:b']); assert.equal(different.mode, 'explicit');
  const additive = change(arrived, { type: 'layers', ids: ['image:b'], additive: true }, draft);
  assert.deepEqual(additive.ids, ['image:b']); assert.equal(additive.mode, 'explicit');
  const ordinary = change(initial(draft), { type: 'select', id: 'image:a' }, draft);
  assert.deepEqual(change(ordinary, { type: 'replace', ids: ids => ids.includes('image:a') ? ids : [...ids, 'image:a'] }, draft).ids, ['image:a']);
  assert.deepEqual(change(ordinary, { type: 'replace', ids: toggle('image:a') }, draft).ids, []);
  assert.equal(change(same, { type: 'focus', id: 'image:b' }, draft), same);
});
test('Back can restore an arrival target, a continuation window and explicit membership without focus changing their meaning', () => {
  const draft = content();
  const states = [
    change(initial(draft), { type: 'arrive', id: 'image:a' }, draft),
    change(initial(draft), { type: 'arrive', id: 'text-frame:a' }, draft),
    change(initial(draft), { type: 'replace', ids: ['image:a', 'image:b'] }, draft),
  ];
  for (const saved of states) {
    const restored = change(initial(draft), { type: 'restore', state: saved }, draft);
    assert.deepEqual(restored, saved);
    assert.equal(change(restored, { type: 'focus', id: target(restored, draft) || 'image:a' }, draft), restored);
    assert.equal(change(restored, { type: 'focus', id: restored.ids[0] }, draft), restored);
  }
  const removed = { ...draft, imageModules: draft.imageModules.filter(item => item.id !== 'image:a') };
  const empty = change(initial(removed), { type: 'restore', state: states[0] }, removed);
  assert.deepEqual(empty.ids, []); assert.equal(empty.mode, null); assert.equal(target(empty, removed), null);
  assert.equal(reconcile(empty, draft), empty);
});
test('multi-destination arrival clears selection and Display arrival keeps its placement target', () => {
  const draft = content(), group = change(initial(draft), { type: 'replace', ids: ['image:a', 'image:b'] }, draft);
  const empty = change(group, { type: 'arrive', id: null }, draft);
  assert.deepEqual(empty.ids, []); assert.equal(empty.mode, null); assert.equal(target(empty, draft), null);
  const display = change(group, { type: 'arrive', id: 'display:primary' }, draft);
  assert.deepEqual(display.ids, []); assert.equal(display.mode, null); assert.equal(target(display, draft), 'display:primary');
});
