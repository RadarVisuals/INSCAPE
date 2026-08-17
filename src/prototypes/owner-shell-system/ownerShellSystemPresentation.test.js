import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOwnerShellSystemPresentationSession,
  updateOwnerShellSystemPresentationSession,
} from './ownerShellSystemPresentation.js';

test('presentation session starts from stable prototype defaults for one placement', () => {
  assert.deepEqual(createOwnerShellSystemPresentationSession({ id: 'placement-7' }), {
    backing: false,
    backingColor: '#d8d4ca',
    frame: 'NONE',
    mat: 'NONE',
    matColor: '#d8d4ca',
    placementId: 'placement-7',
    transparency: 'AUTO',
  });
  assert.equal(createOwnerShellSystemPresentationSession(null), null);
});

test('presentation patches cannot retarget the active placement', () => {
  const session = createOwnerShellSystemPresentationSession({ id: 'placement-7' });
  assert.deepEqual(updateOwnerShellSystemPresentationSession(session, {
    backing: true,
    frame: 'DOSSIER',
    placementId: 'placement-8',
  }), {
    ...session,
    backing: true,
    frame: 'DOSSIER',
  });
  assert.equal(updateOwnerShellSystemPresentationSession(null, { frame: 'CAPTION' }), null);
});
