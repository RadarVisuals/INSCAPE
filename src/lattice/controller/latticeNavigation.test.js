import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LATTICE_INTERACTION_CONFIG,
  addWheelDelta,
  createPointerGesture,
  entryLatticeCoordinate,
  finishPointerGesture,
  keyboardDirection,
  latticeDestination,
  pointerDirection,
  resolveWheelDestination,
  updatePointerGesture,
} from './latticeNavigation.js';

const config = { ...DEFAULT_LATTICE_INTERACTION_CONFIG, deadZone: 10, commitThreshold: 50 };

test('pointer direction follows direct-manipulation semantics', () => {
  assert.deepEqual(pointerDirection({ x: -80, y: 4 }, config.diagonalTolerance), { x: 1, y: 0 });
  assert.deepEqual(pointerDirection({ x: 80, y: 4 }, config.diagonalTolerance), { x: -1, y: 0 });
  assert.deepEqual(pointerDirection({ x: 4, y: -80 }, config.diagonalTolerance), { x: 0, y: 1 });
  assert.deepEqual(pointerDirection({ x: 4, y: 80 }, config.diagonalTolerance), { x: 0, y: -1 });
});

test('gesture stays dormant inside the activation dead zone', () => {
  const gesture = updatePointerGesture(
    createPointerGesture({ x: 100, y: 100 }),
    { x: 106, y: 104 },
    { x: 0, y: 0 },
    config,
  );
  assert.equal(gesture.activated, false);
  assert.equal(gesture.direction, null);
  assert.deepEqual(gesture.offset, { x: 0, y: 0 });
});

test('direction locks for the complete gesture and commit moves one coordinate', () => {
  const started = createPointerGesture({ x: 100, y: 100 });
  const lockedLeft = updatePointerGesture(started, { x: 80, y: 99 }, { x: 0, y: 0 }, config);
  const pulledElsewhere = updatePointerGesture(lockedLeft, { x: 25, y: 190 }, { x: 0, y: 0 }, config);

  assert.deepEqual(pulledElsewhere.direction, { x: 1, y: 0 });
  assert.deepEqual(pulledElsewhere.offset, { x: -75, y: 0 });
  assert.deepEqual(finishPointerGesture(pulledElsewhere, { x: 0, y: 0 }, config), { x: 1, y: 0 });
});

test('release below commit threshold returns to the active coordinate', () => {
  const gesture = updatePointerGesture(
    createPointerGesture({ x: 0, y: 0 }),
    { x: -35, y: 0 },
    { x: 0, y: 0 },
    config,
  );
  assert.deepEqual(finishPointerGesture(gesture, { x: 0, y: 0 }, config), { x: 0, y: 0 });
});

test('near-diagonal gesture commits both axes', () => {
  const gesture = updatePointerGesture(
    createPointerGesture({ x: 0, y: 0 }),
    { x: -70, y: -60 },
    { x: 0, y: 0 },
    config,
  );
  assert.deepEqual(gesture.direction, { x: 1, y: 1 });
  assert.deepEqual(finishPointerGesture(gesture, { x: 0, y: 0 }, config), { x: 1, y: 1 });
});

test('edge drag is resisted and cannot leave the permanent topology', () => {
  const gesture = updatePointerGesture(
    createPointerGesture({ x: 0, y: 0 }),
    { x: -100, y: 0 },
    { x: 1, y: 0 },
    config,
  );
  assert.equal(gesture.offset.x, -18);
  assert.deepEqual(finishPointerGesture(gesture, { x: 1, y: 0 }, config), { x: 1, y: 0 });
  assert.equal(latticeDestination({ x: 1, y: 1 }, { x: 1, y: 0 }), null);
});

test('wheel accumulation chooses one cardinal or diagonal destination', () => {
  const accumulated = addWheelDelta({ x: 0, y: 0 }, { x: 90, y: 5 });
  assert.deepEqual(resolveWheelDestination(accumulated, { x: 0, y: 0 }, config), { x: 1, y: 0 });
  assert.deepEqual(resolveWheelDestination({ x: -90, y: -80 }, { x: 0, y: 0 }, config), { x: -1, y: -1 });
  assert.equal(resolveWheelDestination({ x: 20, y: 5 }, { x: 0, y: 0 }, config), null);
});

test('keyboard directions and fresh entry coordinate are deterministic', () => {
  assert.deepEqual(keyboardDirection('ArrowLeft'), { x: -1, y: 0 });
  assert.deepEqual(keyboardDirection('ArrowDown'), { x: 0, y: 1 });
  assert.equal(keyboardDirection('Enter'), null);
  assert.deepEqual(entryLatticeCoordinate(), { x: 0, y: 0 });
});
