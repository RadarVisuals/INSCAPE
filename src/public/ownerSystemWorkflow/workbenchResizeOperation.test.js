import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchResizeOperation } from './workbenchResizeOperation.js';
import { workbenchSelectionBounds } from './workbenchViewScale.js';

function fixture({ visitor = false, scale = .75, continuous = false, single = false } = {}) {
  let current = true;
  const state = { transforms: {}, commits: [], applied: [], fail: false };
  const store = { hasWriteAccess: () => true, getProfileAddress: () => 'profile' };
  const ids = single ? ['a'] : ['a', 'b'];
  const entries = new Map(ids.map((id, i) => [id, { isConnected: true,
    frame: { left: (100 + i * 100) * scale, top: 100 * scale, width: 100 * scale, height: 80 * scale } }]));
  const commit = changes => { state.commits.push(changes); return !state.fail; };
  const resizeTargets = new Map(ids.map(id => [id, { current: { enabled: true, store,
    profileAddress: 'profile', expected: { id }, commit, applyFrame: frame => state.applied.push({ id, frame }),
    minimumSize: 8, maximumWidth: 4096, maximumHeight: 4096, reflow: true, continuousGeometry: continuous,
  } }]));
  const origin = visitor ? { kind: 'visitor', isCurrent: () => current }
    : { kind: 'owner', store, profileAddress: 'profile', getPresentation: () => ({}), isCurrent: () => current };
  const options = { origin, ids, registry: { entries, resizeTargets }, corner: 'se', transforms: state.transforms,
    geometry: { scale, cameraOffset: { x: 0, y: 0 }, moduleScale: () => scale,
      rectangle: nodes => workbenchSelectionBounds(nodes.map(node => node.frame)),
      bounds: () => ({ left: 0, top: 0, right: 10000, bottom: 10000 }),
      areaBounds: () => ({ left: 0, top: 0, right: 10000, bottom: 10000 }),
      snapResize: (_rectangle, _anchor, _corner, factor) => factor },
    setTransforms: value => { state.transforms = typeof value === 'function' ? value(state.transforms) : value; },
  };
  return { options, state, entries, resizeTargets, ids, expire: () => { current = false; },
    create: () => createWorkbenchResizeOperation(options) };
}

test('selection preview and authored commit use the same common fractional endpoints', () => {
  const f = fixture({ continuous: true }), operation = f.create();
  assert.equal(operation.mode, 'authored');
  operation.preview({ x: 37.5, y: 0 });
  const frames = f.ids.map(id => f.state.transforms[id].frame);
  assert.equal(frames[0].left + frames[0].width, frames[1].left);
  assert.equal(f.state.commits.length, 0);
  assert.ok(operation.commit());
  assert.equal(f.state.commits.length, 1);
  assert.deepEqual(f.state.applied.map(item => item.frame), frames);
  assert.deepEqual(f.state.transforms, {});
});

test('failed commit does not apply any module frame or clear the preview', () => {
  const f = fixture(), operation = f.create();
  operation.preview({ x: 30, y: 0 }); const preview = f.state.transforms;
  f.state.fail = true;
  assert.equal(operation.commit(), false);
  assert.deepEqual(f.state.applied, []);
  assert.equal(f.state.transforms, preview, 'gesture owns rollback after false');
});

test('a module-supplied group scale interval bounds preview without reading its opaque expected record', () => {
  const f = fixture();
  for (const ref of f.resizeTargets.values()) ref.current.expected = new Proxy({}, { get() { throw Error('Host read module content'); } });
  f.resizeTargets.get('a').current.groupScaleLimits = { minimum: .8, maximum: 1.2 };
  const operation = f.create();
  operation.preview({ x: 3000, y: 0 });
  assert.equal(f.state.transforms.a.frame.width, 120);
  operation.preview({ x: -3000, y: 0 });
  assert.equal(f.state.transforms.a.frame.width, 80);
});

test('pointer and keyboard resizing share the same geometry and commit boundary', () => {
  const pointer = fixture(), keyboard = fixture();
  const a = pointer.create(), b = keyboard.create();
  a.preview({ x: 15, y: 0 });
  b.previewByKey('ArrowRight');
  assert.deepEqual(pointer.state.transforms, keyboard.state.transforms);
  assert.ok(a.commit()); assert.ok(b.commit());
  assert.deepEqual(pointer.state.applied, keyboard.state.applied);
});

test('single free-corner target receives the same bounded delta from pointer and keyboard', () => {
  const f = fixture({ single: true });
  f.resizeTargets.get('a').current.resizeCorner = (frame, _corner, delta) => ({ ...frame, width: frame.width + delta.x, height: frame.height + delta.y });
  f.resizeTargets.get('a').current.resizeStep = 8;
  const operation = f.create();
  operation.previewByKey('ArrowRight', true);
  assert.equal(f.state.transforms.a.frame.width, 180);
  assert.ok(operation.commit());
  assert.equal(f.state.applied[0].frame.width, 180);
});

test('visitor resize cannot invoke an authored capability even if one is supplied in a registry', () => {
  const f = fixture({ visitor: true }), operation = f.create();
  assert.equal(operation.mode, 'visitor');
  operation.previewByKey('ArrowLeft');
  const preview = f.state.transforms;
  assert.ok(operation.commit());
  assert.equal(f.state.transforms, preview);
  assert.deepEqual(f.state.commits, []); assert.deepEqual(f.state.applied, []);
});

for (const replacement of ['node', 'registration', 'target', 'origin']) test(`${replacement} replacement invalidates preview and authored resize completion`, () => {
  const f = fixture(), operation = f.create();
  operation.preview({ x: 20, y: 0 }); const preview = f.state.transforms;
  if (replacement === 'node') f.entries.set('a', { ...f.entries.get('a') });
  else if (replacement === 'registration') f.resizeTargets.set('a', { ...f.resizeTargets.get('a') });
  else if (replacement === 'target') f.resizeTargets.get('a').current = { ...f.resizeTargets.get('a').current };
  else f.expire();
  assert.equal(operation.valid(), false);
  assert.equal(operation.preview({ x: 80, y: 0 }), false);
  assert.equal(operation.commit(), false);
  assert.equal(f.state.transforms, preview);
  assert.deepEqual(f.state.commits, []); assert.deepEqual(f.state.applied, []);
});
