import assert from 'node:assert/strict';
import test from 'node:test';
import { useProfileDocumentStore } from './useProfileDocumentStore.js';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const documentFor = (profileAddress, revision) => ({ profile: { address: profileAddress }, revision });

test('document-store actions cannot install a snapshot across the active profile boundary', () => {
  const actions = useProfileDocumentStore.getState();
  actions.activateProfile(A);
  actions.installSnapshot(documentFor(A, 1), 'a');
  actions.installImported(documentFor(A, 2));
  assert.equal(useProfileDocumentStore.getState().snapshot.revision, 1);
  assert.equal(useProfileDocumentStore.getState().imported.revision, 2);

  actions.activateProfile(B);
  assert.equal(useProfileDocumentStore.getState().profileAddress, B);
  assert.equal(useProfileDocumentStore.getState().snapshot, null);
  assert.equal(useProfileDocumentStore.getState().imported, null);
  actions.installSnapshot(documentFor(A, 3), 'wrong-profile');
  assert.equal(useProfileDocumentStore.getState().snapshot, null);
  actions.installSnapshot(documentFor(B, 4), 'b');
  assert.equal(useProfileDocumentStore.getState().snapshot.revision, 4);

  actions.activateProfile(null);
});
