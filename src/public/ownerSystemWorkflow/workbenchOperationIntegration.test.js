import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchResizeOperation } from './workbenchResizeOperation.js';
import { createWorkbenchGestures } from './workbenchGestures.js';
import { workbenchSelectionBounds } from './workbenchViewScale.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { commitWorkbenchSelectionResize } from '../../systemWorkflow/resizeWorkbenchSelection.js';
import { addImageModule, prepareImageResize } from '../../imageModule/imageModuleSession.js';
import { addTextModule, prepareTextResize } from '../../text/textSession.js';
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';

const profile = `0x${'1'.repeat(40)}`;

function fixture({ visitor = false, canvases = false } = {}) {
  const values = new Map();
  let failed = false, writes = 0;
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage: {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (failed) throw Error('Storage full'); values.set(key, value); writes++; },
  } });
  const first = root.getWorkbenchScope().getWorkbenchId();
  const second = canvases ? root.createWorkbench('Other') : null;
  if (canvases) assert.ok(root.switchWorkbench(first));
  const imageId = addImageModule(root, profile), textId = addTextModule(root, profile);
  const draft = root.getDraft(), layout = draft.workbench || createDefaultWorkbenchPresentation();
  const frames = [
    { left: 100, top: 100, width: 360, height: 240 },
    { left: 460, top: 100, width: 360, height: 240 },
  ];
  assert.ok(root.commitCompletedOperation({ ...draft,
    imageModules: draft.imageModules.map(item => ({ ...item, width: 360, height: 240 })),
    workbench: { ...layout,
      imageModules: [{ id: imageId, open: true, position: { left: 100, top: 100 } }],
      texts: [{ id: textId, open: true, window: frames[1] }],
    },
  }, { expectedGeneration: root.getGeneration() }));
  const store = root.getWorkbenchScope(), content = store.getSnapshot(), ids = [imageId, textId];
  const state = { transforms: {}, applied: [], errors: [], restored: 0 };
  const scale = .75, offset = { x: 23, y: 31 };
  const entries = new Map(ids.map((id, i) => [id, { isConnected: true, frame: {
    left: frames[i].left * scale + offset.x, top: frames[i].top * scale + offset.y,
    width: frames[i].width * scale, height: frames[i].height * scale,
  } }]));
  const resizeTargets = new Map(ids.map((id, i) => [id, { current: {
    enabled: true, store, profileAddress: profile, commit: commitWorkbenchSelectionResize,
    prepare: i === 0 ? prepareImageResize : prepareTextResize,
    expected: i === 0 ? content.imageModules[0] : content.texts[0],
    layoutKey: i === 0 ? 'imageModules' : 'texts',
    minimumSize: 8, maximumWidth: 4096, maximumHeight: 4096, reflow: true,
    continuousGeometry: i === 1,
    applyFrame: frame => state.applied.push({ id, frame }),
    reportError: message => state.errors.push(message),
  } }]));
  const origin = visitor ? { kind: 'visitor', isCurrent: () => true }
    : { kind: 'owner', store, profileAddress: profile,
      getPresentation: () => store.getSnapshot().workbench, isCurrent: () => store.isCurrent() };
  const options = { origin, ids, registry: { entries, resizeTargets }, corner: 'se',
    transforms: state.transforms, setTransforms: value => {
      state.transforms = typeof value === 'function' ? value(state.transforms) : value;
    },
    geometry: { scale, cameraOffset: offset, moduleScale: () => scale,
      rectangle: nodes => workbenchSelectionBounds(nodes.map(node => node.frame)),
      bounds: () => ({ left: 0, top: 0, right: 10000, bottom: 10000 }),
      areaBounds: () => ({ left: 0, top: 0, right: 10000, bottom: 10000 }),
      snapResize: (_rectangle, _anchor, _corner, factor) => factor,
    },
  };
  return { root, store, state, ids, second, options, values, writes: () => writes,
    fail: () => { failed = true; }, create: () => createWorkbenchResizeOperation(options) };
}

test('mixed Image/Text pointer and keyboard resize prepare real content and save one undoable operation', () => {
  const pointer = fixture(), keyboard = fixture();
  for (const [f, input] of [[pointer, 'pointer'], [keyboard, 'keyboard']]) {
    const operation = f.create(), before = f.store.getDraft(), writes = f.writes();
    if (input === 'pointer') operation.preview({ x: 54, y: 0 });
    else operation.previewByKey('ArrowRight');
    const preview = f.ids.map(id => f.state.transforms[id].frame);
    assert.equal(f.writes(), writes);
    assert.deepEqual(f.state.applied, []);
    assert.ok(operation.commit());
    assert.equal(f.writes(), writes + 1);
    assert.deepEqual(f.state.applied.map(item => item.frame), preview);
    const saved = f.store.getDraft();
    assert.equal(saved.imageModules[0].width, preview[0].width);
    assert.equal(saved.imageModules[0].height, preview[0].height);
    assert.deepEqual(saved.workbench.imageModules[0].position, { left: preview[0].left, top: preview[0].top });
    assert.deepEqual(saved.texts, before.texts, 'Text resize changes its frame, preserving its article');
    assert.deepEqual(saved.workbench.texts[0].window, preview[1]);
    assert.equal(f.store.getHistory().undo, 'Resize Workbench selection');
    assert.deepEqual(f.state.transforms, {});
    assert.ok(f.store.undo());
    assert.deepEqual(f.store.getDraft(), before);
  }
  assert.deepEqual(pointer.state.applied.map(item => item.frame), keyboard.state.applied.map(item => item.frame));
});

test('faulting storage rejects the entire mixed resize before any module applies its frame', () => {
  const f = fixture(), operation = f.create(), before = f.store.getDraft();
  const history = f.store.getHistory(), persisted = new Map(f.values), writes = f.writes();
  operation.previewByKey('ArrowRight');
  const preview = f.state.transforms;
  f.fail();
  assert.equal(operation.commit(), false);
  assert.deepEqual(f.store.getDraft(), before);
  assert.deepEqual(f.store.getHistory(), history);
  assert.deepEqual(f.values, persisted);
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.state.applied, []);
  assert.equal(f.state.transforms, preview, 'the gesture owns cancellation of a failed preview');
  assert.ok(f.state.errors.every(message => /could not be saved/.test(message)));
});

test('a later Text conflict rejects the already prepared Image without saving either member', () => {
  const f = fixture(), operation = f.create();
  operation.previewByKey('ArrowRight');
  const draft = f.store.getDraft();
  assert.ok(f.store.commitCompletedOperation({ ...draft,
    texts: draft.texts.map(item => ({ ...item, visibility: 'PUBLIC' })),
  }, { expectedGeneration: f.store.getGeneration() }));
  const changed = f.store.getDraft(), writes = f.writes(), history = f.store.getHistory();
  assert.equal(operation.commit(), false);
  assert.deepEqual(f.store.getDraft(), changed);
  assert.deepEqual(f.store.getHistory(), history);
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.state.applied, []);
  assert.ok(f.state.errors.every(message => /Text changed during resizing/.test(message)));
});

test('resize preserves unrelated work completed after its preview instead of requiring a start generation', () => {
  const f = fixture(), operation = f.create();
  operation.previewByKey('ArrowRight');
  const added = addTextModule(f.store, profile), writes = f.writes();
  assert.ok(operation.commit());
  assert.equal(f.writes(), writes + 1);
  assert.ok(f.store.getDraft().texts.some(item => item.id === added));
});

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, extra = {}) {
    const event = { button: 0, buttons: 1, pointerId: 1, clientX: 0, clientY: 0,
      altKey: false, preventDefault() {}, stopPropagation() {}, ...extra };
    for (const callback of [...(this.listeners.get(type) || [])]) callback(event);
    return event;
  }
  count() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}

function gesture(f) {
  const events = new Events(), visibility = new Events(), host = new Events();
  let captured = null;
  host.hasPointerCapture = id => captured === id;
  host.setPointerCapture = id => { captured = id; };
  host.releasePointerCapture = () => { captured = null; };
  host.focus = () => {};
  const gestures = createWorkbenchGestures({ events, visibility, getHost: () => host,
    restoreTransforms: value => { f.state.transforms = value; f.state.restored++; },
    replaceSelection() {}, restoreSelection() {}, previewMarquee() {}, finishSnap() {}, cancelDrop() {},
  });
  assert.ok(gestures.beginResize(events.emit('pointerdown'), f.create()));
  events.emit('pointermove', { clientX: 54 });
  return { gestures, events, visibility, host,
    clean() {
      assert.equal(gestures.isActive(), false);
      assert.equal(events.count() + visibility.count() + host.count(), 0);
      assert.equal(captured, null);
    },
  };
}

test('Escape and a failed pointer completion roll mixed previews back without applying frames', () => {
  for (const cause of ['Escape', 'storage failure']) {
    const f = fixture(), before = f.store.getDraft(), history = f.store.getHistory(), writes = f.writes();
    const g = gesture(f);
    if (cause === 'Escape') g.events.emit('keydown', { key: 'Escape' });
    else { f.fail(); g.events.emit('pointerup'); }
    assert.deepEqual(f.state.transforms, {});
    assert.deepEqual(f.state.applied, []);
    assert.deepEqual(f.store.getDraft(), before);
    assert.deepEqual(f.store.getHistory(), history);
    assert.equal(f.writes(), writes);
    assert.equal(f.state.restored, 1);
    g.clean();
  }
});

test('the active gesture blocks normal canvas switching; cancellation releases that guard', () => {
  const f = fixture({ canvases: true }), g = gesture(f);
  const release = f.store.guardWorkbenchTransition(() => g.gestures.isActive() ? 'Finish the gesture' : null);
  const before = f.store.getDraft(), writes = f.writes();
  assert.throws(() => f.store.switchWorkbench(f.second), /Finish the gesture/);
  assert.deepEqual(f.store.getDraft(), before);
  assert.equal(f.writes(), writes);
  g.events.emit('keydown', { key: 'Escape' });
  assert.ok(f.store.switchWorkbench(f.second));
  assert.deepEqual(f.state.applied, []);
  release(); g.clean();
});

test('forced profile replacement and unmount retire captured completion even after returning to the same profile', () => {
  for (const unmount of [false, true]) {
    const f = fixture(), g = gesture(f), lateFinish = [...g.events.listeners.get('pointerup')][0];
    f.root.setProfileAddress(`0x${'2'.repeat(40)}`);
    f.root.setProfileAddress(profile);
    const returned = f.root.getDraft(), writes = f.writes();
    if (unmount) g.gestures.cancel(false);
    lateFinish({ pointerId: 1 });
    assert.deepEqual(f.root.getDraft(), returned);
    assert.equal(f.writes(), writes);
    assert.deepEqual(f.state.applied, []);
    assert.equal(f.state.restored, unmount ? 0 : 1, 'unmount must not set state on the departed view');
    g.clean();
  }
});

test('Visitor completion with real authored targets keeps geometry temporary and never invokes a preparer', () => {
  const f = fixture({ visitor: true }), operation = f.create(), before = f.store.getDraft(), writes = f.writes();
  for (const registration of f.options.registry.resizeTargets.values()) {
    registration.current.prepare = () => { assert.fail('Visitor reached a content preparer'); };
  }
  operation.previewByKey('ArrowLeft');
  const preview = f.state.transforms;
  assert.ok(operation.commit());
  assert.equal(f.state.transforms, preview);
  assert.deepEqual(f.state.applied, []);
  assert.deepEqual(f.store.getDraft(), before);
  assert.equal(f.writes(), writes);
});
