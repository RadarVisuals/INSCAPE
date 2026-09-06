import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTVEIL_STATES, createStartveilState, getStartveilStateDuration, transitionStartveil } from './startveilMachine.js';

test('the startveil waits for readiness and ignores early entry', () => {
  const loading = createStartveilState(false);
  assert.equal(loading, STARTVEIL_STATES.LOADING);
  assert.equal(transitionStartveil(loading, 'ENTER'), STARTVEIL_STATES.LOADING);
  assert.equal(transitionStartveil(loading, 'READY'), STARTVEIL_STATES.DORMANT);
});

test('entry reveals the destination in one phase without empty boot or resident holds', () => {
  let state = transitionStartveil(STARTVEIL_STATES.DORMANT, 'ENTER');
  const states = [state];
  while (state !== STARTVEIL_STATES.COMPLETE) {
    state = transitionStartveil(state, 'ADVANCE');
    states.push(state);
  }
  assert.deepEqual(states, [
    STARTVEIL_STATES.REVEALING_INTERFACE,
    STARTVEIL_STATES.COMPLETE
  ]);
});

test('return visits use shorter phase durations', () => {
  assert.ok(getStartveilStateDuration(STARTVEIL_STATES.REVEALING_INTERFACE, true) < getStartveilStateDuration(STARTVEIL_STATES.REVEALING_INTERFACE, false));
});

test('reduced motion has no timed hold and completed entry cannot replay', () => {
  assert.equal(getStartveilStateDuration(STARTVEIL_STATES.REVEALING_INTERFACE, false, true), 0);
  assert.equal(getStartveilStateDuration(STARTVEIL_STATES.REVEALING_INTERFACE, true, true), 0);
  for (const event of ['READY', 'ENTER', 'ADVANCE']) {
    assert.equal(transitionStartveil(STARTVEIL_STATES.COMPLETE, event), STARTVEIL_STATES.COMPLETE);
  }
});
