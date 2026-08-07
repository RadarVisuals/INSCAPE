import assert from 'node:assert/strict';
import test from 'node:test';
import { createCreationFocusEntry } from './creationFocusViewModel.js';

test('created-only viewer model exposes creator provenance and explicitly denies viewed-profile ownership', () => {
  const entry = createCreationFocusEntry({ id: 'asset', name: 'Work', imageUrl: 'https://example.com/work.png',
    viewedProfileIsCreator: true, creatorAttributionLevel: 'token', ownershipKnown: true,
    isOwnedByViewedProfile: false, creators: [{ address: '0x1111111111111111111111111111111111111111' }] },
  { width: 800, height: 600 });
  assert.equal(entry.dossier.technical.some(({ label, value }) => label === 'VIEWED PROFILE RELATIONSHIP' && value === 'CREATOR / TOKEN'), true);
  assert.equal(entry.dossier.technical.some(({ label, value }) => label === 'CURRENT OWNERSHIP' && value === 'NOT OWNED BY VIEWED PROFILE'), true);
});

test('collection token viewer shows collection provenance and the indexed LSP8 holder address', () => {
  const holder = '0x2222222222222222222222222222222222222222';
  const entry = createCreationFocusEntry({ id: 'asset', name: 'HALO 01', imageUrl: 'https://example.com/halo.png',
    standard: 'LSP8', tokenId: '0x01', currentOwnerAddress: holder,
    viewedProfileIsCreator: false, viewedProfileIsCollectionCreator: true, collectionCreatorAttributionLevel: 'contract',
    ownershipKnown: true, isOwnedByViewedProfile: false,
    creators: [{ address: holder }], fieldProvenance: { creators: { scope: 'tokenId' } },
    collectionCreators: [{ address: '0x1111111111111111111111111111111111111111' }] },
  { width: 800, height: 600 });
  assert.equal(entry.dossier.technical.some(({ label, value }) => label === 'VIEWED PROFILE RELATIONSHIP'
    && value === 'COLLECTION CREATOR / CONTRACT'), true);
  assert.equal(entry.dossier.technical.some(({ label, value }) => label === 'CURRENT HOLDER / INDEXED'
    && value === holder), true);
  assert.equal(entry.dossier.technical.some(({ label }) => label === 'CREATORS / TOKEN'), true);
});
