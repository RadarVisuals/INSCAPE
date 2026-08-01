import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLISHED_PROFILE_RUNTIME, selectPublishedProfileRuntime } from './publishedProfileRuntime.js';

test('only readable version-eight documents select the lattice visitor runtime', () => {
  assert.equal(selectPublishedProfileRuntime({ version: 8, lattice: { tables: [] } }), PUBLISHED_PROFILE_RUNTIME.LATTICE);
  for (const version of [1, 2, 3, 4, 5, 6, 7]) {
    assert.equal(selectPublishedProfileRuntime({ version, lattice: { tables: [] } }), PUBLISHED_PROFILE_RUNTIME.LEGACY);
  }
  assert.equal(selectPublishedProfileRuntime({ version: 8 }), PUBLISHED_PROFILE_RUNTIME.LEGACY);
  assert.equal(selectPublishedProfileRuntime(null), PUBLISHED_PROFILE_RUNTIME.LEGACY);
});
