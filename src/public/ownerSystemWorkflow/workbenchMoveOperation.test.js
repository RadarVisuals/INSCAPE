import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchMoveOperation } from './workbenchMoveOperation.js';
import { workbenchSelectionBounds } from './workbenchViewScale.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { editWorkbenchGroups } from '../../systemWorkflow/workbenchGroupSession.js';
import { artworkLayers } from '../../systemWorkflow/domain/artworkLayers.js';
import { addShape } from '../../shapes/shapeSession.js';

const profile = `0x${'1'.repeat(40)}`;
function fixture({ group = false, visitor = false, scale = 1 } = {}) {
  const values = new Map(); let failed = false, writes = 0, current = true;
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage: {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (failed) throw Error('full'); values.set(key, value); writes++; },
  } });
  const ids = [addShape(root, profile), addShape(root, profile)];
  if (group) editWorkbenchGroups(root, profile, { type: 'create', name: 'Together', memberIds: ids });
  const store = root.getWorkbenchScope(), content = store.getSnapshot();
  const state = { transforms: {}, applied: [], errors: [] };
  const registry = { entries: new Map(), frames: new Map() };
  ids.forEach(id => {
    const frame = { ...content.workbench.shapes.find(item => item.id === id).window };
    registry.entries.set(id, { isConnected: true, hasAttribute: () => false, frame });
    registry.frames.set(id, { current: frame, move(position) { state.applied.push({ id, ...position }); } });
  });
  const origin = visitor ? { kind: 'visitor', isCurrent: () => current }
    : { kind: 'owner', store, profileAddress: profile, getPresentation: () => content.workbench, isCurrent: () => current };
  const options = { origin, selection: { ids, selectedIds: ids, content, layers: artworkLayers(content) }, registry,
    geometry: { scale, rectangle: nodes => workbenchSelectionBounds(nodes.map(node => ({
      ...node.frame, left: node.frame.left * scale, top: node.frame.top * scale,
      width: node.frame.width * scale, height: node.frame.height * scale,
    }))), snap: rectangle => rectangle, bounds: () => ({ left: -10000, top: -10000, right: 10000, bottom: 10000 }) },
    transforms: state.transforms, setTransforms: value => { state.transforms = value; }, reportError: error => state.errors.push(error),
  };
  return { root, store, state, registry, options, ids, writes: () => writes,
    fail: value => { failed = value; }, expire: () => { current = false; }, create: () => createWorkbenchMoveOperation(options) };
}

test('ordinary selection movement updates presentation without rewriting content or artwork history', () => {
  const f = fixture({ scale: .75 }), operation = f.create();
  const before = f.store.getDraft(), history = f.store.getHistory(), writes = f.writes();
  assert.equal(operation.mode, 'presentation');
  operation.preview({ x: 30, y: 15 });
  assert.equal(f.state.applied.length, 0);
  assert.equal(f.writes(), writes);
  assert.ok(operation.commit());
  for (const applied of f.state.applied) {
    const frame = f.registry.frames.get(applied.id).current;
    assert.equal(applied.left, frame.left + 40);
    assert.equal(applied.top, frame.top + 20);
    assert.deepEqual(Object.keys(applied).sort(), ['id', 'left', 'top']);
  }
  assert.deepEqual(f.store.getDraft(), before);
  assert.deepEqual(f.store.getHistory(), history);
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.state.transforms, {});
});

test('visitor completion retains only temporary transforms and never calls module presentation writers', () => {
  const f = fixture({ visitor: true }), operation = f.create(), writes = f.writes();
  assert.equal(operation.mode, 'visitor');
  const preview = operation.preview({ x: 20, y: 10 });
  assert.ok(operation.commit());
  assert.equal(f.state.transforms, preview);
  assert.deepEqual(f.state.applied, []);
  assert.equal(f.writes(), writes);
});

test('authored group movement keeps the existing one-write and one-undo boundary', () => {
  const f = fixture({ group: true }), operation = f.create();
  const before = f.store.getDraft(), writes = f.writes();
  assert.equal(operation.mode, 'authored');
  operation.preview({ x: 20, y: 10 });
  assert.equal(f.writes(), writes);
  assert.ok(operation.commit());
  assert.equal(f.writes(), writes + 1);
  assert.equal(f.state.applied.length, 2);
  assert.ok(f.store.undo());
  assert.deepEqual(f.store.getDraft(), before);
});

test('group write failure leaves accepted draft, history and module frames unchanged', () => {
  const f = fixture({ group: true }), operation = f.create();
  const before = f.store.getDraft(), history = f.store.getHistory(), writes = f.writes();
  operation.preview({ x: 20, y: 10 }); f.fail(true);
  assert.equal(operation.commit(), false);
  assert.deepEqual(f.store.getDraft(), before);
  assert.deepEqual(f.store.getHistory(), history);
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.state.applied, []);
  assert.match(f.state.errors.at(-1), /could not be moved/);
});

test('authored group movement retains the generation captured before its preview', () => {
  const f = fixture({ group: true }), operation = f.create();
  operation.preview({ x: 20, y: 10 });
  addShape(f.store, profile);
  const changed = f.store.getDraft(), writes = f.writes();
  assert.equal(operation.commit(), false);
  assert.deepEqual(f.store.getDraft(), changed);
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.state.applied, []);
  assert.match(f.state.errors.at(-1), /Workbench changed/);
});

for (const replacement of ['node', 'frame', 'origin']) test(`${replacement} replacement rejects old selection callbacks even when the old node remains connected`, () => {
  const f = fixture(), operation = f.create();
  operation.preview({ x: 20, y: 10 }); const preview = f.state.transforms;
  if (replacement === 'node') f.registry.entries.set(f.ids[0], { ...f.registry.entries.get(f.ids[0]) });
  else if (replacement === 'frame') f.registry.frames.set(f.ids[0], { ...f.registry.frames.get(f.ids[0]) });
  else f.expire();
  assert.equal(operation.valid(), false);
  assert.equal(operation.preview({ x: 50, y: 20 }), null);
  assert.equal(f.state.transforms, preview);
  assert.equal(operation.commit(), false);
  assert.deepEqual(f.state.applied, []);
});
