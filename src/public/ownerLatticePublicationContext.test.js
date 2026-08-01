import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../lattice/domain/latticeProductionDraft.js';
import { canonicalPublicationHash, publicationContentFingerprint } from '../profileDocument/domain/profileDocumentPublication.js';
import { buildOwnerLatticePublicationDocument } from './ownerLatticePublicationDocument.js';
import { createOwnerLatticePublicationContext } from './ownerLatticePublicationContext.js';

const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';

function snapshot() {
  return buildOwnerLatticePublicationDocument({
    activeActorId: 'abyssal_eye',
    assetRecords: [],
    exportedAt: '2026-08-01T12:00:00.000Z',
    latticeDraft: createEmptyLatticeProductionDraft(PROFILE),
    profile: { name: 'Resident Zero' },
    profileAddress: PROFILE,
    stageId: 'moonpurple',
  });
}

function context(overrides = {}) {
  const value = snapshot();
  const fingerprint = publicationContentFingerprint(value);
  return createOwnerLatticePublicationContext({
    cid: 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw',
    cidGeneration: 3,
    draftFingerprint: fingerprint,
    draftGeneration: 4,
    getWalletPublicationContext: () => ({
      chainId: 42,
      hostProfileAddress: PROFILE,
      isHostProfileOwner: true,
      isWalletConnected: true,
      publicationContextGeneration: 5,
    }),
    profileAddress: PROFILE,
    snapshot: value,
    snapshotDraftFingerprint: fingerprint,
    snapshotGeneration: 2,
    ...overrides,
  });
}

test('lattice publication context binds exact frozen snapshot and generation identities', () => {
  const value = snapshot();
  const result = context({ snapshot: value, snapshotDraftFingerprint: publicationContentFingerprint(value) });
  assert.equal(result.ownerAuthoringEnabled, true);
  assert.equal(result.workspaceProfileAddress, PROFILE);
  assert.equal(result.viewedProfileAddress, PROFILE);
  assert.equal(result.snapshotArtifactHash, canonicalPublicationHash(value));
  assert.equal(result.snapshotContentFingerprint, publicationContentFingerprint(value));
  assert.equal(result.snapshotStale, false);
  assert.equal(result.cidGeneration, 3);
  assert.equal(result.draftGeneration, 4);
});

test('lattice publication context fails owner authority and marks changed public content stale', () => {
  const stale = context({ draftFingerprint: 'changed' });
  assert.equal(stale.snapshotStale, true);
  const wrongOwner = context({ getWalletPublicationContext: () => ({
    hostProfileAddress: '0x1111111111111111111111111111111111111111',
    isHostProfileOwner: true,
  }) });
  assert.equal(wrongOwner.ownerAuthoringEnabled, false);
});
