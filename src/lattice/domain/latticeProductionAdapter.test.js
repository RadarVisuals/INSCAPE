import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LATTICE_PRODUCTION_VISIBILITY,
  createEmptyLatticeProductionDraft,
} from './latticeProductionDraft.js';
import { validateLatticeProductionPublication } from './latticeProductionPublication.js';
import { projectLatticeProductionPublication } from './latticeProductionAdapter.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const SECOND_ASSET = `42:${CONTRACT}:0x02`;
const record = (id = ASSET, overrides = {}) => ({
  id, chainId: 42, contractAddress: CONTRACT, tokenId: id.endsWith('0x02') ? '0x02' : '0x01',
  standard: 'LSP8', name: 'Real work', description: '', collectionName: null,
  imageUrl: `https://cdn.example/${id.endsWith('0x02') ? 'two' : 'one'}.webp`,
  thumbnailUrl: null, originalImageUrl: null, imageWidth: 1600, imageHeight: 900,
  creators: [{ address: PROFILE, name: 'Real creator' }], attributes: [], ...overrides,
});
const placement = (id, stableAssetId, navigationOrder, overrides = {}) => ({
  id, stableAssetId, column: 0, row: 0, columnSpan: 8, rowSpan: 6,
  layer: navigationOrder, navigationOrder, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC, locked: true, ...overrides,
});

test('pure projection resolves real assets, sorts navigation, omits locks, and does not mutate the draft', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [
    placement('later', ASSET, 1, { layer: 0 }),
    placement('first', SECOND_ASSET, 0, { layer: Number.MAX_SAFE_INTEGER }),
  ];
  const before = structuredClone(draft);
  const publication = projectLatticeProductionPublication(draft, [record(), record(SECOND_ASSET)], {
    lastPublished: '2026-07-29T12:00:00.000Z',
  });
  assert.equal(validateLatticeProductionPublication(publication).valid, true);
  assert.deepEqual(publication.tables[4].placements.map(({ id }) => id), ['first', 'later']);
  assert.deepEqual(publication.tables[4].placements.map(({ layer }) => layer), [Number.MAX_SAFE_INTEGER, 0]);
  assert.deepEqual(publication.tables[4].placements.map(({ asset }) => asset.stableAssetId), [SECOND_ASSET, ASSET]);
  assert.deepEqual(publication.tables[4].placements.map(({ asset }) => asset.media.type), ['image', 'image']);
  assert.ok(publication.tables[4].placements.every((entry) => !Object.hasOwn(entry, 'locked') && !Object.hasOwn(entry, 'stableAssetId')));
  assert.equal(Object.hasOwn(publication, 'profileAddress'), false);
  assert.equal(Object.hasOwn(publication, 'activeTable'), false);
  assert.deepEqual(draft, before);
});

test('private tables retain only their permanent slot and private placements are omitted without asset lookup', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[0] = {
    ...draft.tables[0], title: 'PRIVATE TITLE', subtitle: 'PRIVATE SUBTITLE', labelVisible: true,
    visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE,
    placements: [placement('private-placement', ASSET, 0)],
  };
  draft.tables[4].placements = [placement('private-on-public-table', ASSET, 0, { visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE })];
  const publication = projectLatticeProductionPublication(draft, [], { lastPublished: '2026-07-29T12:00:00.000Z' });
  assert.deepEqual(publication.tables[0], { id: 'table-01', coordinate: { x: -1, y: -1 }, visibility: 'PRIVATE' });
  assert.deepEqual(publication.tables[4].placements, []);
});

test('production publication prefers original media while retaining declared dimensions only as a pre-decode hint', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('public-placement', ASSET, 0)];
  const publication = projectLatticeProductionPublication(draft, [record(ASSET, {
    originalImageUrl: 'https://cdn.example/original.webp',
    imageUrl: 'https://cdn.example/indexed.webp',
    thumbnailUrl: 'https://cdn.example/thumbnail.webp',
  })], { lastPublished: '2026-07-29T12:00:00.000Z' });
  assert.equal(publication.tables[4].placements[0].asset.media.url, 'https://cdn.example/original.webp');
  assert.deepEqual(publication.tables[4].placements[0].asset.media, {
    url: 'https://cdn.example/original.webp', width: 1600, height: 900, type: 'image'
  });
});

test('inactive identity values are cleared while active INSCAPE avatar references resolve through real assets', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.identityPresentation.avatar = { mode: 'official', stableAssetId: ASSET, shape: 'round' };
  draft.identityPresentation.bio = { mode: 'hidden', customText: 'PRIVATE BIO' };
  let publication = projectLatticeProductionPublication(draft, [], { lastPublished: '2026-07-29T12:00:00.000Z' });
  assert.equal(publication.identityPresentation.avatar.asset, null);
  assert.equal(publication.identityPresentation.bio.customText, '');

  draft.identityPresentation.avatar.mode = 'inscape';
  draft.identityPresentation.bio = { mode: 'inscape', customText: 'Public authored bio' };
  publication = projectLatticeProductionPublication(draft, [record()], { lastPublished: '2026-07-29T12:00:00.000Z' });
  assert.equal(publication.identityPresentation.avatar.asset.stableAssetId, ASSET);
  assert.equal(publication.identityPresentation.bio.customText, 'Public authored bio');
});

test('projection fails closed for missing, mismatched, or unsafe production assets', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('public-placement', ASSET, 0)];
  assert.throws(() => projectLatticeProductionPublication(draft, [], { lastPublished: '2026-07-29T12:00:00.000Z' }), /Missing or mismatched production asset/);
  assert.throws(() => projectLatticeProductionPublication(draft, [record(ASSET, { imageUrl: 'javascript:alert(1)' })], { lastPublished: '2026-07-29T12:00:00.000Z' }), /no publishable media/);
  assert.throws(() => projectLatticeProductionPublication(draft, [record(ASSET, { tokenId: '0x02' })], { lastPublished: '2026-07-29T12:00:00.000Z' }), /Missing or mismatched production asset/);
  assert.throws(() => projectLatticeProductionPublication(draft, [{ ...record(), id: undefined }], { lastPublished: '2026-07-29T12:00:00.000Z' }), /Missing or mismatched production asset/);
  assert.throws(() => projectLatticeProductionPublication(draft, [record(), record()], { lastPublished: '2026-07-29T12:00:00.000Z' }), /Duplicate production asset record/);
});

test('published validation rejects owner-only leakage and mutation of strict placement presentation', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('public-placement', ASSET, 0)];
  const publication = projectLatticeProductionPublication(draft, [record()], { lastPublished: '2026-07-29T12:00:00.000Z' });

  publication.tables[4].placements[0].locked = false;
  assert.ok(validateLatticeProductionPublication(publication).errors.some(({ code }) => code === 'invalid_public_placement'));
  delete publication.tables[4].placements[0].locked;
  publication.tables[4].placements[0].mat.color = 'transparent';
  assert.ok(validateLatticeProductionPublication(publication).errors.some(({ code }) => code === 'invalid_public_placement'));
  publication.tables[4].placements[0].mat.color = '#090a0a';
  publication.lastPublished = 'July 29, 2026';
  assert.ok(validateLatticeProductionPublication(publication).errors.some(({ code }) => code === 'invalid_last_published'));
});
