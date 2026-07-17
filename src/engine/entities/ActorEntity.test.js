import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  clearActorMovementBounds,
  moveActorTo,
  setActorMovementBounds,
  updateActorTargetMovement
} from './actorMovement.js';

const HABITAT = Object.freeze({ left: 100, right: 300, top: 80, bottom: 240 });

function createMovementActor(position = { x: 20, y: 30 }) {
  const actor = {};
  actor.baselinePosition = { ...position };
  actor.targetPosition = { ...position };
  actor.isMovingToTarget = false;
  actor.movementBounds = null;
  actor.preBoundPosition = null;
  actor.isEnteringMovementBounds = false;
  actor.areMovementBoundsActive = false;
  actor.facingDirection = 1;
  actor.moveTo = (x, y) => moveActorTo(actor, x, y);
  actor.setMovementBounds = (bounds, options) => setActorMovementBounds(actor, bounds, options);
  actor.clearMovementBounds = (options) => clearActorMovementBounds(actor, options);
  actor.updateTargetMovement = (deltaTime) => updateActorTargetMovement(actor, deltaTime);
  return actor;
}

function finishMovement(actor, limit = 1000) {
  for (let index = 0; actor.isMovingToTarget && index < limit; index += 1) {
    actor.updateTargetMovement(1);
  }
  assert.equal(actor.isMovingToTarget, false, 'movement should settle');
}

test('opening a habitat preserves the current position while targeting its center', () => {
  const actor = createMovementActor();

  actor.setMovementBounds(HABITAT);

  assert.deepEqual(actor.baselinePosition, { x: 20, y: 30 });
  assert.deepEqual(actor.targetPosition, { x: 200, y: 160 });
  assert.equal(actor.isEnteringMovementBounds, true);
  assert.equal(actor.areMovementBoundsActive, false);
});

test('constraints activate after continuous entry and constrain subsequent targets', () => {
  const actor = createMovementActor();
  actor.setMovementBounds(HABITAT);

  finishMovement(actor);
  actor.moveTo(900, -100);

  assert.equal(actor.areMovementBoundsActive, true);
  assert.equal(actor.isEnteringMovementBounds, false);
  assert.deepEqual(actor.targetPosition, { x: 300, y: 80 });
});

test('repeated and resized bounds preserve the original return position', () => {
  const actor = createMovementActor({ x: 12, y: 34 });
  actor.setMovementBounds(HABITAT);
  const initialTarget = { ...actor.targetPosition };

  actor.setMovementBounds({ ...HABITAT });
  assert.deepEqual(actor.targetPosition, initialTarget);

  actor.setMovementBounds({ left: 120, right: 340, top: 90, bottom: 250 });
  assert.deepEqual(actor.preBoundPosition, { x: 12, y: 34 });
  assert.deepEqual(actor.targetPosition, { x: 230, y: 170 });
});

test('closing returns smoothly to the exact pre-open position', () => {
  const actor = createMovementActor({ x: 14, y: 28 });
  actor.setMovementBounds(HABITAT);
  finishMovement(actor);

  actor.clearMovementBounds();
  assert.deepEqual(actor.targetPosition, { x: 14, y: 28 });
  finishMovement(actor);

  assert.deepEqual(actor.baselinePosition, { x: 14, y: 28 });
  assert.equal(actor.movementBounds, null);
});

test('movement settles without a final position jump', () => {
  const actor = createMovementActor({ x: 0, y: 0 });
  actor.moveTo(100, 0);
  let previousX = actor.baselinePosition.x;
  let finalStep = Infinity;

  while (actor.isMovingToTarget) {
    actor.updateTargetMovement(1);
    finalStep = actor.baselinePosition.x - previousX;
    previousX = actor.baselinePosition.x;
  }

  assert.equal(actor.baselinePosition.x, 100);
  assert.ok(finalStep <= 3, `final movement step should be at most 3px, received ${finalStep}`);
});

test('movement hands off promptly to idle near the target', () => {
  const actor = createMovementActor({ x: 0, y: 0 });
  actor.moveTo(15, 0);
  let finishingFrames = 0;

  while (actor.isMovingToTarget) {
    actor.updateTargetMovement(1);
    finishingFrames += 1;
  }

  assert.equal(actor.baselinePosition.x, 15);
  assert.ok(finishingFrames <= 5, `arrival should finish within 5 frames, received ${finishingFrames}`);
});

test('reduced motion places and restores the actor immediately', () => {
  const actor = createMovementActor({ x: 8, y: 16 });

  actor.setMovementBounds(HABITAT, { reducedMotion: true });
  assert.deepEqual(actor.baselinePosition, { x: 200, y: 160 });
  assert.equal(actor.areMovementBoundsActive, true);

  actor.clearMovementBounds({ reducedMotion: true });
  assert.deepEqual(actor.baselinePosition, { x: 8, y: 16 });
  assert.equal(actor.isMovingToTarget, false);
});

test('clearing inactive movement bounds accepts null startup options', () => {
  const actorSource = readFileSync(new URL('./ActorEntity.js', import.meta.url), 'utf8');
  const movementSource = readFileSync(new URL('./actorMovement.js', import.meta.url), 'utf8');

  assert.match(actorSource, /clearActorMovementBounds\(this, options\)/);
  assert.match(movementSource, /const \{ reducedMotion = false \} = options \|\| \{\}/);

  const actor = createMovementActor();
  assert.doesNotThrow(() => actor.clearMovementBounds(null));
});
