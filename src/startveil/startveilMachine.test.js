import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTVEIL_STATES, createStartveilState, getStartveilStateDuration, transitionStartveil } from './startveilMachine.js';

test('the startveil waits for readiness and ignores early entry', () => {
  const loading = createStartveilState(false);
  assert.equal(loading, STARTVEIL_STATES.LOADING);
  assert.equal(transitionStartveil(loading, 'ENTER'), STARTVEIL_STATES.LOADING);
  assert.equal(transitionStartveil(loading, 'READY'), STARTVEIL_STATES.DORMANT);
});

test('the reveal sequence advances in system, world, resident, interface order', () => {
  let state = transitionStartveil(STARTVEIL_STATES.DORMANT, 'ENTER');
  const states = [state];
  while (state !== STARTVEIL_STATES.COMPLETE) {
    state = transitionStartveil(state, 'ADVANCE');
    states.push(state);
  }
  assert.deepEqual(states, [
    STARTVEIL_STATES.ENTERING,
    STARTVEIL_STATES.BOOTING,
    STARTVEIL_STATES.BLACK_HANDOFF,
    STARTVEIL_STATES.REVEALING_WORLD,
    STARTVEIL_STATES.REVEALING_RESIDENT,
    STARTVEIL_STATES.REVEALING_INTERFACE,
    STARTVEIL_STATES.COMPLETE
  ]);
});

test('return visits use shorter phase durations', () => {
  assert.ok(getStartveilStateDuration(STARTVEIL_STATES.BOOTING, true) < getStartveilStateDuration(STARTVEIL_STATES.BOOTING, false));
});

test('the black handoff is brief and the full interface phase covers the module cascade', () => {
  const blackHold = getStartveilStateDuration(STARTVEIL_STATES.BLACK_HANDOFF, false);
  assert.ok(blackHold >= 80 && blackHold <= 160);
  assert.ok(getStartveilStateDuration(STARTVEIL_STATES.REVEALING_INTERFACE, false) >= 1180);
});
