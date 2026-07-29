import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../lattice/domain/latticeProductionAdapter.js';
import { latticeProductionDraftKey } from '../lattice/storage/latticeProductionDraftStore.js';
import {
  OWNER_LATTICE_AUTHORING_STATUS,
  createOwnerLatticeAuthoringSession,
  ownerLatticePlacementUnavailableReason,
  resolveOwnerLatticeAuthoringStorage,
} from './useOwnerLatticeAuthoring.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const OTHER = '0x3333333333333333333333333333333333333333';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let failWrites = false;
  return {
    values,
    writes: 0,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (failWrites) throw new Error('blocked');
      this.writes += 1;
      values.set(key, value);
    },
    removeItem(key) { values.delete(key); },
    fail() { failWrites = true; },
  };
}

const asset = (overrides = {}) => ({
  id: ASSET, chainId: 42, ownerAddress: PROFILE, contractAddress: CONTRACT, tokenId: '0x01',
  standard: 'LSP8', name: 'Owned image', imageUrl: 'https://assets.example/image.png',
  imageWidth: 1600, imageHeight: 900, ...overrides,
});

const existingPlacement = (id, stableAssetId = ASSET) => ({
  id, stableAssetId, column: 1, row: 1, columnSpan: 3, rowSpan: 3,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
});

test('absent session mount exposes an unwritten validated draft and writes only on completed PLACE', () => {
  const storage = memoryStorage();
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.equal(session.status, OWNER_LATTICE_AUTHORING_STATUS.READY);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.has(latticeProductionDraftKey(PROFILE)), false);
  assert.equal(session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, true);
  assert.equal(storage.writes, 1);
  assert.equal(JSON.parse(storage.values.get(latticeProductionDraftKey(PROFILE))).tables[4].placements[0].id, 'placement-1');
});

test('completed-operation gate rejects an immediate second PLACE without changing the first transaction', () => {
  const storage = memoryStorage();
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const first = session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' });
  assert.equal(first.ok, true);
  const firstBytes = storage.values.get(latticeProductionDraftKey(PROFILE));
  const second = session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' });
  assert.equal(second.ok, false);
  assert.match(second.reason, /ADDITIONAL PLACEMENT REQUIRES NEXT AUTHORING SLICE/u);
  assert.equal(storage.writes, 1);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), firstBytes);
  assert.equal(JSON.parse(firstBytes).tables[4].placements.length, 1);
  assert.equal(session.getDraft().tables[4].placements.length, 1);
  assert.deepEqual(session.getDraft(), first.draft);
});

test('default storage resolution fails closed when acquisition throws and honors injected null', () => {
  const throwingEnvironment = Object.defineProperty({}, 'localStorage', {
    get() { throw new Error('storage access blocked'); },
  });
  assert.equal(resolveOwnerLatticeAuthoringStorage({}, throwingEnvironment), null);
  assert.equal(resolveOwnerLatticeAuthoringStorage({ storage: null }, throwingEnvironment), null);
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE,
    storage: resolveOwnerLatticeAuthoringStorage({}, throwingEnvironment) });
  assert.equal(session.status, OWNER_LATTICE_AUTHORING_STATUS.CORRUPT);
  assert.equal(session.getDraft(), null);
  assert.equal(session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, false);
});

test('corrupt records remain byte-for-byte untouched and never expose an authorable draft', () => {
  const raw = '{corrupt';
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.equal(session.status, OWNER_LATTICE_AUTHORING_STATUS.CORRUPT);
  assert.equal(session.getDraft(), null);
  assert.equal(session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, false);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.equal(storage.writes, 0);
});

test('valid multi-placement drafts load detached and unchanged without a write', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[0].placements = [existingPlacement('placement-1')];
  draft.tables[4].placements = [existingPlacement('placement-3')];
  const raw = JSON.stringify(draft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const loaded = session.getDraft();
  assert.deepEqual(loaded, draft);
  assert.equal(Object.isFrozen(loaded), true);
  assert.equal(Object.isFrozen(loaded.tables[4].placements[0]), true);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.equal(storage.writes, 0);
});

test('loaded public placements project without draft mutation while private content stays redacted', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[0].placements = [existingPlacement('placement-1')];
  draft.tables[4].visibility = 'PRIVATE';
  draft.tables[4].title = 'Private title';
  draft.tables[4].placements = [existingPlacement('placement-2')];
  const before = structuredClone(draft);
  const rawAsset = asset({ creators: [], attributes: [], description: '', collectionName: null });
  const publication = projectLatticeProductionPublication(draft, [rawAsset], {
    lastPublished: '1970-01-01T00:00:00.000Z',
  });
  assert.equal(publication.tables[0].placements.length, 1);
  assert.deepEqual(publication.tables[4], { id: 'table-05', coordinate: { x: 0, y: 0 }, visibility: 'PRIVATE' });
  assert.deepEqual(draft, before);
});

test('missing dimensions, stale profiles, private tables, and failed persistence retain the exact prior draft', () => {
  const storage = memoryStorage();
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const initial = session.getDraft();
  assert.equal(session.commitPlacement({ assetRecord: asset({ imageWidth: null }), tableId: 'table-05' }).ok, false);
  assert.equal(session.commitPlacement({ assetRecord: asset({ ownerAddress: OTHER }), tableId: 'table-05' }).ok, false);
  const privateDraft = createEmptyLatticeProductionDraft(PROFILE);
  privateDraft.tables[4].visibility = 'PRIVATE';
  const privateStorage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: JSON.stringify(privateDraft) });
  const privateSession = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage: privateStorage });
  assert.equal(privateSession.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, false);
  assert.equal(privateStorage.writes, 0);
  storage.fail();
  assert.equal(session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, false);
  assert.deepEqual(session.getDraft(), initial);
  assert.equal(storage.values.has(latticeProductionDraftKey(PROFILE)), false);
});

test('successful placement survives a complete session remount', () => {
  const storage = memoryStorage();
  const first = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.equal(first.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, true);
  const remounted = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.deepEqual(remounted.getDraft(), first.getDraft());
  assert.equal(remounted.getDraft().tables[4].placements[0].stableAssetId, ASSET);
});

test('private and nonempty table restrictions remain temporary runtime capability gates', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  assert.equal(ownerLatticePlacementUnavailableReason({
    activeTable: draft.tables[4], authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.READY, profileReady: true,
  }), null);
  draft.tables[4].placements = [existingPlacement('placement-1')];
  assert.match(ownerLatticePlacementUnavailableReason({
    activeTable: draft.tables[4], authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.READY, profileReady: true,
  }), /NEXT AUTHORING SLICE/u);
  draft.tables[4].visibility = 'PRIVATE';
  assert.match(ownerLatticePlacementUnavailableReason({
    activeTable: draft.tables[4], authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.READY, profileReady: true,
  }), /PRIVATE TABLE/u);
  assert.match(ownerLatticePlacementUnavailableReason({
    activeTable: null, authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.CORRUPT, profileReady: true,
  }), /CORRUPT/u);
});
