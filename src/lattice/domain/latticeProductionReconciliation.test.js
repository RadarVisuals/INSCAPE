import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft, LATTICE_PRODUCTION_VISIBILITY } from './latticeProductionDraft.js';
import { projectLatticeProductionPublication } from './latticeProductionAdapter.js';
import { reconcileLatticeProductionDraft, remapPrivatePlacementId } from './latticeProductionReconciliation.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const PUBLIC_ASSET = `42:${CONTRACT}:0x01`;
const PRIVATE_ASSET = `42:${CONTRACT}:0x02`;
const record = (id, tokenId) => ({
  id, chainId: 42, contractAddress: CONTRACT, tokenId, standard: 'LSP8', name: id,
  description: '', collectionName: null, imageUrl: `https://example.test/${tokenId}.png`,
  imageWidth: 100, imageHeight: 100, mediaType: 'image', creators: [], attributes: [],
});
const placement = (id, stableAssetId, visibility = LATTICE_PRODUCTION_VISIBILITY.PUBLIC) => ({
  id, stableAssetId, column: 0, row: 0, columnSpan: 4, rowSpan: 4, layer: 0,
  navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility, locked: true,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

function publicationWith(id = 'accepted-public') {
  const source = createEmptyLatticeProductionDraft(PROFILE);
  source.tables[4].placements = [placement(id, PUBLIC_ASSET)];
  return projectLatticeProductionPublication(source, [record(PUBLIC_ASSET, '0x01')], {
    lastPublished: '2026-07-29T00:00:00.000Z',
  });
}

test('published placement IDs win same-table collisions while private content is deterministically preserved', () => {
  const current = createEmptyLatticeProductionDraft(PROFILE);
  current.tables[4].placements = [placement('accepted-public', PRIVATE_ASSET, LATTICE_PRODUCTION_VISIBILITY.PRIVATE)];
  const restored = reconcileLatticeProductionDraft(publicationWith(), current, { profileAddress: PROFILE });
  assert.deepEqual(restored.tables[4].placements.map(({ id }) => id), [
    'accepted-public', 'accepted-public:private-table-05-1',
  ]);
  const preserved = restored.tables[4].placements[1];
  assert.equal(preserved.stableAssetId, PRIVATE_ASSET);
  assert.equal(preserved.visibility, LATTICE_PRODUCTION_VISIBILITY.PRIVATE);
  assert.equal(preserved.locked, true);
});

test('same-ID and same-asset private collisions cannot transfer lock state to the public placement', () => {
  const current = createEmptyLatticeProductionDraft(PROFILE);
  const privatePlacement = placement('accepted-public', PUBLIC_ASSET, LATTICE_PRODUCTION_VISIBILITY.PRIVATE);
  privatePlacement.crop = { x: 0.1, y: 0.2, zoom: 1.4 };
  privatePlacement.frameId = 'DOSSIER';
  current.tables[4].placements = [privatePlacement];

  const restored = reconcileLatticeProductionDraft(publicationWith(), current, { profileAddress: PROFILE });
  const [incomingPublic, preservedPrivate] = restored.tables[4].placements;
  assert.equal(incomingPublic.id, 'accepted-public');
  assert.equal(incomingPublic.locked, false);
  assert.equal(preservedPrivate.id, 'accepted-public:private-table-05-1');
  assert.equal(preservedPrivate.locked, true);
  assert.equal(preservedPrivate.stableAssetId, PUBLIC_ASSET);
  assert.deepEqual(preservedPrivate.crop, privatePlacement.crop);
  assert.equal(preservedPrivate.frameId, 'DOSSIER');
});

test('repeated suffix collisions advance deterministically to the first globally available suffix', () => {
  const current = createEmptyLatticeProductionDraft(PROFILE);
  current.tables[4].placements = [placement('accepted-public', PRIVATE_ASSET, LATTICE_PRODUCTION_VISIBILITY.PRIVATE)];
  const publication = publicationWith();
  publication.tables[4].placements.push({
    ...structuredClone(publication.tables[4].placements[0]),
    id: 'accepted-public:private-table-05-1',
    navigationOrder: 1,
    layer: 1,
  });
  const restored = reconcileLatticeProductionDraft(publication, current, { profileAddress: PROFILE });
  assert.equal(restored.tables[4].placements[2].id, 'accepted-public:private-table-05-2');
});

test('placement-ID remapping exposes a bounded fail-closed search boundary', () => {
  const used = new Set(['collision', 'collision:private-table-05-1']);
  assert.throws(
    () => remapPrivatePlacementId('collision', 'table-05', used, 1),
    /Could not deterministically remap/,
  );
});

test('global collision remapping is stable across tables and bounded for maximum-length IDs', () => {
  const maximumId = 'a'.repeat(200);
  const current = createEmptyLatticeProductionDraft(PROFILE);
  current.tables[0].placements = [placement(maximumId, PRIVATE_ASSET, LATTICE_PRODUCTION_VISIBILITY.PRIVATE)];
  const publication = publicationWith(maximumId);
  const first = reconcileLatticeProductionDraft(publication, current, { profileAddress: PROFILE });
  const second = reconcileLatticeProductionDraft(publication, current, { profileAddress: PROFILE });
  const remapped = first.tables[0].placements[0];
  assert.equal(remapped.id.length <= 200, true);
  assert.match(remapped.id, /:private-table-01-1$/);
  assert.equal(remapped.stableAssetId, PRIVATE_ASSET);
  assert.deepEqual(first, second);
});

test('private table authoring and inactive identity values survive without entering the public source', () => {
  const current = createEmptyLatticeProductionDraft(PROFILE);
  current.tables[0].visibility = LATTICE_PRODUCTION_VISIBILITY.PRIVATE;
  current.tables[0].title = 'Private title';
  current.tables[0].placements = [placement('private-only', PRIVATE_ASSET)];
  current.identityPresentation.avatar.stableAssetId = PRIVATE_ASSET;
  current.identityPresentation.bio.customText = 'Private inactive bio';
  const publication = publicationWith();
  publication.tables[0] = { id: 'table-01', coordinate: { x: -1, y: -1 }, visibility: 'PRIVATE' };
  const restored = reconcileLatticeProductionDraft(publication, current, { profileAddress: PROFILE });
  assert.equal(restored.tables[0].title, 'Private title');
  assert.equal(restored.tables[0].placements[0].stableAssetId, PRIVATE_ASSET);
  assert.equal(restored.identityPresentation.avatar.stableAssetId, PRIVATE_ASSET);
  assert.equal(restored.identityPresentation.bio.customText, 'Private inactive bio');
});

test('wrong-profile reconciliation fails before producing a draft', () => {
  assert.throws(() => reconcileLatticeProductionDraft(
    publicationWith(), createEmptyLatticeProductionDraft(PROFILE),
    { profileAddress: '0x3333333333333333333333333333333333333333' },
  ), /must match/);
});
