import assert from 'node:assert/strict';
import test from 'node:test';
import { PROFILE_TARGET_SOURCE, resolveProfileTarget } from './profileTarget.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';

function target(overrides = {}) {
  return resolveProfileTarget({
    explicitViewedProfileAddress: null,
    connectedProfileAddress: null,
    workspaceFallbackAddress: null,
    authorityLifecycleStatus: 'complete',
    ...overrides
  });
}

test('explicit intent wins while authority is pending or connected elsewhere', () => {
  assert.deepEqual(target({ explicitViewedProfileAddress: PROFILE_A, connectedProfileAddress: PROFILE_B,
    authorityLifecycleStatus: 'pending' }), {
    address: PROFILE_A, source: PROFILE_TARGET_SOURCE.EXPLICIT, pending: false
  });
});

test('implicit authority exposes no provisional target while pending', () => {
  assert.deepEqual(target({ connectedProfileAddress: PROFILE_A, workspaceFallbackAddress: PROFILE_B,
    authorityLifecycleStatus: 'pending' }), {
    address: null, source: PROFILE_TARGET_SOURCE.PENDING, pending: true
  });
});

test('settled connected authority supersedes the workspace fallback', () => {
  assert.deepEqual(target({ connectedProfileAddress: PROFILE_B, workspaceFallbackAddress: PROFILE_A }), {
    address: PROFILE_B, source: PROFILE_TARGET_SOURCE.CONNECTED, pending: false
  });
});

test('settled signed-out routing uses the workspace fallback or no context', () => {
  assert.deepEqual(target({ workspaceFallbackAddress: PROFILE_A }), {
    address: PROFILE_A, source: PROFILE_TARGET_SOURCE.WORKSPACE_FALLBACK, pending: false
  });
  assert.deepEqual(target(), { address: null, source: PROFILE_TARGET_SOURCE.NONE, pending: false });
});

test('root account transitions derive the latest settled profile without retaining A', () => {
  assert.equal(target({ connectedProfileAddress: PROFILE_A }).address, PROFILE_A);
  assert.equal(target({ connectedProfileAddress: PROFILE_A, authorityLifecycleStatus: 'pending' }).address, null);
  assert.equal(target({ connectedProfileAddress: PROFILE_B }).address, PROFILE_B);
});
