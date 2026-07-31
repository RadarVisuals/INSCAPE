import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createKeeperPointerFollowScheduler,
  keeperPointerFollowAllowed,
  keeperPointerFollowSpeedMultiplier,
  keeperPointerTarget,
} from './keeperPointerFollow.js';

test('cursor follow is available only while the released owner surface owns idle hover', () => {
  assert.equal(keeperPointerFollowAllowed(), true);
  for (const blocker of [
    'arrangeEnabled', 'browserOpen', 'cameraGestureActive', 'cropModeActive', 'gestureActive',
    'identityActive', 'keeperDockActive', 'settling', 'themeOpen', 'viewerActive',
  ]) assert.equal(keeperPointerFollowAllowed({ [blocker]: true }), false, blocker);
  assert.equal(keeperPointerFollowAllowed({ compositionPreview: { kind: 'move' } }), false);
  assert.equal(keeperPointerFollowAllowed({ interfaceVisible: false }), false);
  assert.equal(keeperPointerFollowAllowed({ followCursor: false }), false);
});

test('cursor speed presets remain bounded and unknown values fail to normal', () => {
  assert.equal(keeperPointerFollowSpeedMultiplier('slow'), 0.62);
  assert.equal(keeperPointerFollowSpeedMultiplier('normal'), 1);
  assert.equal(keeperPointerFollowSpeedMultiplier('fast'), 1.55);
  assert.equal(keeperPointerFollowSpeedMultiplier('invented'), 1);
});

test('cursor targets accept idle mouse and pen hover inside the spatial surface but never touch or drag', () => {
  const bounds = { left: 10, top: 20, right: 210, bottom: 220 };
  assert.deepEqual(keeperPointerTarget({ clientX: 42, clientY: 84, pointerType: 'mouse', buttons: 0 }, bounds), {
    clientX: 42, clientY: 84,
  });
  assert.deepEqual(keeperPointerTarget({ clientX: 120, clientY: 140, pointerType: 'pen', buttons: 0 }, bounds), {
    clientX: 120, clientY: 140,
  });
  assert.equal(keeperPointerTarget({ clientX: 42, clientY: 84, pointerType: 'touch', buttons: 0 }, bounds), null);
  assert.equal(keeperPointerTarget({ clientX: 42, clientY: 84, pointerType: 'mouse', buttons: 1 }, bounds), null);
  assert.equal(keeperPointerTarget({ clientX: 9, clientY: 84, pointerType: 'mouse', buttons: 0 }, bounds), null);
  assert.equal(keeperPointerTarget({ clientX: 42, clientY: 221, pointerType: 'mouse', buttons: 0 }, bounds), null);
});

test('cursor scheduler sends only the newest target once per animation frame and cancels cleanly', () => {
  const callbacks = new Map();
  const cancelled = [];
  const moves = [];
  let nextFrame = 1;
  const scheduler = createKeeperPointerFollowScheduler((clientX, clientY) => moves.push([clientX, clientY]), {
    requestFrame(callback) { const frame = nextFrame++; callbacks.set(frame, callback); return frame; },
    cancelFrame(frame) { cancelled.push(frame); callbacks.delete(frame); },
  });
  scheduler.push({ clientX: 10, clientY: 20 });
  scheduler.push({ clientX: 30, clientY: 40 });
  assert.equal(callbacks.size, 1);
  const firstFrame = callbacks.get(1);
  callbacks.delete(1);
  firstFrame();
  assert.deepEqual(moves, [[30, 40]]);
  scheduler.push({ clientX: 50, clientY: 60 });
  scheduler.cancel();
  assert.deepEqual(cancelled, [2]);
  assert.deepEqual(moves, [[30, 40]]);
  scheduler.push({ clientX: 70, clientY: 80 });
  assert.equal(callbacks.size, 1);
  const resumedFrame = callbacks.get(3);
  callbacks.delete(3);
  resumedFrame();
  assert.deepEqual(moves, [[30, 40], [70, 80]]);
});
