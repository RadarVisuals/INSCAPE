import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../lattice/domain/latticeProductionDraft.js';
import { canonicalSerializeProfileDocument } from '../profileDocument/domain/profileDocumentSerialization.js';
import { buildOwnerLatticePublicationDocument } from './ownerLatticePublicationDocument.js';

const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const OTHER_PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET_ID = `42:${CONTRACT}:0x01`;

function asset() {
  return {
    id: ASSET_ID,
    chainId: 42,
    contractAddress: CONTRACT,
    tokenId: '0x01',
    standard: 'LSP8',
    name: 'Publication artwork',
    description: 'Public metadata.',
    imageUrl: 'https://assets.example/publication.png',
    imageWidth: 1600,
    imageHeight: 900,
    creators: [],
    attributes: [],
  };
}

function placement(visibility = 'PUBLIC') {
  return {
    id: 'publication-placement',
    stableAssetId: ASSET_ID,
    column: 2,
    row: 3,
    columnSpan: 8,
    rowSpan: 6,
    layer: 0,
    navigationOrder: 0,
    crop: null,
    frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' },
    transparencyMode: 'AUTO',
    visibility,
    locked: false,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  };
}

function build(overrides = {}) {
  const latticeDraft = overrides.latticeDraft || createEmptyLatticeProductionDraft(PROFILE);
  return buildOwnerLatticePublicationDocument({
    activeActorId: 'abyssal_eye',
    assetRecords: [],
    exportedAt: '2026-08-01T12:00:00.000Z',
    latticeDraft,
    profile: { name: 'Resident Zero' },
    profileAddress: PROFILE,
    stageId: 'moonpurple',
    ...overrides,
  });
}

test('production lattice snapshot uses real publication time and no owner compatibility state', () => {
  const document = build();
  assert.equal(document.version, 8);
  assert.equal(document.revision, 1);
  assert.equal(document.createdAt, '2026-08-01T12:00:00.000Z');
  assert.equal(document.exportedAt, '2026-08-01T12:00:00.000Z');
  assert.equal(document.lattice.lastPublished, document.exportedAt);
  assert.deepEqual(document.spaces, []);
  assert.deepEqual(document.canvasObjects, []);
  assert.equal(document.profile.cachedIdentity.name, 'Resident Zero');
});

test('production lattice snapshot preserves creation, increments revision, and advances export monotonically', () => {
  const previousDocument = build();
  const next = build({ exportedAt: previousDocument.exportedAt, previousDocument });
  assert.equal(next.revision, 2);
  assert.equal(next.createdAt, previousDocument.createdAt);
  assert.equal(next.exportedAt, '2026-08-01T12:00:00.001Z');
  assert.equal(next.lattice.lastPublished, next.exportedAt);
});

test('production lattice snapshot is canonical and deterministic for frozen inputs', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalSerializeProfileDocument(first), canonicalSerializeProfileDocument(second));
});

test('production lattice snapshot rejects mismatched authority and invalid prior publication state', () => {
  assert.throws(() => build({ latticeDraft: createEmptyLatticeProductionDraft(OTHER_PROFILE) }), /publication profile authority/);
  assert.throws(() => build({ previousDocument: { ...build(), profile: { address: OTHER_PROFILE } } }), /previous publication/);
  assert.throws(() => build({ previousDocument: { ...build(), revision: 0 } }), /revision/);
});

test('production lattice snapshot fails closed for unresolved public assets and excludes private placements', () => {
  const unresolved = createEmptyLatticeProductionDraft(PROFILE);
  unresolved.tables[4].placements = [placement()];
  assert.throws(() => build({ latticeDraft: unresolved }), /Missing or mismatched production asset/);

  const resolved = build({ assetRecords: [asset()], latticeDraft: unresolved });
  assert.equal(resolved.lattice.tables[4].placements[0].asset.stableAssetId, ASSET_ID);

  const privateDraft = createEmptyLatticeProductionDraft(PROFILE);
  privateDraft.tables[4].placements = [placement('PRIVATE')];
  const hidden = build({ latticeDraft: privateDraft });
  assert.deepEqual(hidden.lattice.tables[4].placements, []);
});
