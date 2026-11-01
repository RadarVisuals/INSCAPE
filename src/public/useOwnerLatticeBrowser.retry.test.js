import assert from 'node:assert/strict';
import test from 'node:test';
import { retryLibraryForProfile } from './useOwnerLatticeBrowser.js';

test('Library retry is bound to its originating profile and rejects a stale rendered action', async () => {
  const profile = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const calls = [];
  const state = { profileAddress: profile, workspace: { profileAddress: profile },
    load: async (options) => { calls.push(options); } };
  const retry = () => retryLibraryForProfile(profile, () => state);
  await retry();
  assert.deepEqual(calls, [{ forceLive: true }]);
  state.profileAddress = other;
  state.workspace = { profileAddress: other };
  assert.equal(retry(), false);
  assert.equal(calls.length, 1);
  state.profileAddress = profile;
  assert.equal(retry(), false, 'an unmatched workspace is not a ready profile');
  assert.equal(calls.length, 1);
});
