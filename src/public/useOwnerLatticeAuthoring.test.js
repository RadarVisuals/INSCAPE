import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../lattice/domain/latticeProductionAdapter.js';
import {
  LATTICE_PRODUCTION_LAYER_OPERATIONS,
  latticeProductionLayerTopologySnapshot,
} from '../lattice/authoring/latticeProductionLayer.js';
import { latticeProductionDraftKey } from '../lattice/storage/latticeProductionDraftStore.js';
import {
  OWNER_LATTICE_AUTHORING_STATUS,
  createOwnerLatticeAuthoringSession,
  ownerLatticePlacementUnavailableReason,
  resolveOwnerLatticeAuthoringStorage,
  shouldLoadOwnerLatticeAssets,
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

test('cached placed assets still trigger one idle live load for metadata enrichment', () => {
  assert.equal(shouldLoadOwnerLatticeAssets({ libraryStatus: 'idle', profileReady: true,
    referencedAssetCount: 1 }), true);
  assert.equal(shouldLoadOwnerLatticeAssets({ libraryStatus: 'ready', profileReady: true,
    referencedAssetCount: 1 }), false);
  assert.equal(shouldLoadOwnerLatticeAssets({ libraryStatus: 'idle', profileReady: true,
    referencedAssetCount: 0 }), false);
  assert.equal(shouldLoadOwnerLatticeAssets({ libraryStatus: 'idle', profileReady: false,
    referencedAssetCount: 1 }), false);
});

test('absent session mount exposes an unwritten validated draft and writes only on completed PLACE', () => {
  const storage = memoryStorage();
  const session = createOwnerLatticeAuthoringSession({
    generatePlacementId: () => 'placement-uuid-one', profileAddress: PROFILE, storage,
  });
  assert.equal(session.status, OWNER_LATTICE_AUTHORING_STATUS.READY);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.has(latticeProductionDraftKey(PROFILE)), false);
  assert.equal(session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, true);
  assert.equal(storage.writes, 1);
  assert.equal(JSON.parse(storage.values.get(latticeProductionDraftKey(PROFILE))).tables[4].placements[0].id, 'placement-uuid-one');
});

test('repeated completed PLACE uses generated identities and max plus one order', () => {
  const storage = memoryStorage();
  let id = 0;
  const session = createOwnerLatticeAuthoringSession({
    generatePlacementId: () => `placement-uuid-${++id}`, profileAddress: PROFILE, storage,
  });
  const first = session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' });
  assert.equal(first.ok, true);
  const second = session.commitPlacement({ assetRecord: asset(), tableId: 'table-05' });
  assert.equal(second.ok, true);
  assert.equal(storage.writes, 2);
  assert.deepEqual(second.draft.tables[4].placements.map(({ id: placementId, layer, navigationOrder }) => ({
    id: placementId, layer, navigationOrder,
  })), [
    { id: 'placement-uuid-1', layer: 0, navigationOrder: 0 },
    { id: 'placement-uuid-2', layer: 1, navigationOrder: 1 },
  ]);
});

test('ID generation failures and failed PLACE persistence retain accepted memory and exact bytes', () => {
  const rawDraft = createEmptyLatticeProductionDraft(PROFILE);
  const raw = JSON.stringify(rawDraft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const failedGeneration = createOwnerLatticeAuthoringSession({
    generatePlacementId: () => { throw new Error('secure randomness unavailable'); }, profileAddress: PROFILE, storage,
  });
  assert.equal(failedGeneration.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, false);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.deepEqual(failedGeneration.getDraft(), rawDraft);

  const failedStorage = createOwnerLatticeAuthoringSession({
    generatePlacementId: () => 'placement-uuid-valid', profileAddress: PROFILE, storage,
  });
  storage.fail();
  assert.equal(failedStorage.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, false);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.deepEqual(failedStorage.getDraft(), rawDraft);
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
  const first = createOwnerLatticeAuthoringSession({
    generatePlacementId: () => 'placement-uuid-remount', profileAddress: PROFILE, storage,
  });
  assert.equal(first.commitPlacement({ assetRecord: asset(), tableId: 'table-05' }).ok, true);
  const remounted = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.deepEqual(remounted.getDraft(), first.getDraft());
  assert.equal(remounted.getDraft().tables[4].placements[0].stableAssetId, ASSET);
});

test('only profile readiness and public-table state gate repeated placement', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  assert.equal(ownerLatticePlacementUnavailableReason({
    activeTable: draft.tables[4], authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.READY, profileReady: true,
  }), null);
  draft.tables[4].placements = [existingPlacement('placement-1')];
  assert.equal(ownerLatticePlacementUnavailableReason({
    activeTable: draft.tables[4], authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.READY, profileReady: true,
  }), null);
  draft.tables[4].visibility = 'PRIVATE';
  assert.match(ownerLatticePlacementUnavailableReason({
    activeTable: draft.tables[4], authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.READY, profileReady: true,
  }), /PRIVATE TABLE/u);
  assert.match(ownerLatticePlacementUnavailableReason({
    activeTable: null, authoringStatus: OWNER_LATTICE_AUTHORING_STATUS.CORRUPT, profileReady: true,
  }), /CORRUPT/u);
});

test('completed MOVE re-reads the accepted draft and performs exactly one canonical write', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [existingPlacement('placement-1')];
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: JSON.stringify(draft) });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const result = session.commitMovement({
    assetRecord: asset(),
    tableId: 'table-05',
    placementId: 'placement-1',
    expectedStartGeometry: { column: 1, row: 1, columnSpan: 3, rowSpan: 3 },
    destination: { column: 9, row: 7, columnSpan: 3, rowSpan: 3 },
  });
  assert.equal(result.ok, true);
  assert.equal(storage.writes, 1);
  assert.deepEqual(result.draft.tables[4].placements[0], {
    ...existingPlacement('placement-1'), column: 9, row: 7,
  });
  assert.deepEqual(JSON.parse(storage.values.get(latticeProductionDraftKey(PROFILE))), result.draft);
});

test('same-cell, stale-start, locked, private, missing-asset and unavailable-media MOVE attempts write nothing', () => {
  const cases = [
    { name: 'same cell', mutate: () => {}, destination: { column: 1, row: 1, columnSpan: 3, rowSpan: 3 } },
    { name: 'locked', mutate: (draft) => { draft.tables[4].placements[0].locked = true; } },
    { name: 'private placement', mutate: (draft) => { draft.tables[4].placements[0].visibility = 'PRIVATE'; } },
    { name: 'private table', mutate: (draft) => { draft.tables[4].visibility = 'PRIVATE'; } },
  ];
  for (const entry of cases) {
    const draft = createEmptyLatticeProductionDraft(PROFILE);
    draft.tables[4].placements = [existingPlacement('placement-1')];
    entry.mutate(draft);
    const raw = JSON.stringify(draft);
    const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
    const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
    const result = session.commitMovement({
      assetRecord: asset(), tableId: 'table-05', placementId: 'placement-1',
      expectedStartGeometry: { column: 1, row: 1, columnSpan: 3, rowSpan: 3 },
      destination: entry.destination || { column: 2, row: 2, columnSpan: 3, rowSpan: 3 },
    });
    assert.equal(result.ok, false, entry.name);
    assert.equal(storage.writes, 0, entry.name);
    assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw, entry.name);
  }

  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [existingPlacement('placement-1')];
  const raw = JSON.stringify(draft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const stale = session.commitMovement({
    assetRecord: asset(), tableId: 'table-05', placementId: 'placement-1',
    expectedStartGeometry: { column: 2, row: 1, columnSpan: 3, rowSpan: 3 },
    destination: { column: 3, row: 3, columnSpan: 3, rowSpan: 3 },
  });
  const missing = session.commitMovement({
    assetRecord: null, tableId: 'table-05', placementId: 'placement-1',
    expectedStartGeometry: { column: 1, row: 1, columnSpan: 3, rowSpan: 3 },
    destination: { column: 3, row: 3, columnSpan: 3, rowSpan: 3 },
  });
  const unsupported = session.commitMovement({
    assetRecord: asset({ mediaType: 'video' }), tableId: 'table-05', placementId: 'placement-1',
    expectedStartGeometry: { column: 1, row: 1, columnSpan: 3, rowSpan: 3 },
    destination: { column: 3, row: 3, columnSpan: 3, rowSpan: 3 },
  });
  assert.equal(stale.ok, false);
  assert.equal(missing.ok, false);
  assert.equal(unsupported.ok, false);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
});

test('failed MOVE persistence restores the exact previous accepted draft and bytes', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [existingPlacement('placement-1')];
  const raw = JSON.stringify(draft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const accepted = session.getDraft();
  storage.fail();
  const result = session.commitMovement({
    assetRecord: asset(), tableId: 'table-05', placementId: 'placement-1',
    expectedStartGeometry: { column: 1, row: 1, columnSpan: 3, rowSpan: 3 },
    destination: { column: 8, row: 6, columnSpan: 3, rowSpan: 3 },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(session.getDraft(), accepted);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.equal(storage.writes, 0);
});

test('completed RESIZE requires the MOVE asset policy and performs one canonical write', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = existingPlacement('placement-resize');
  draft.tables[4].placements = [expected];
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: JSON.stringify(draft) });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const result = session.commitResize({
    assetRecord: asset(), corner: 'se',
    destination: { column: 1, row: 1, columnSpan: 6, rowSpan: 5 },
    expectedPlacement: structuredClone(expected), placementId: expected.id, tableId: 'table-05',
  });
  assert.equal(result.ok, true);
  assert.equal(storage.writes, 1);
  assert.deepEqual(result.draft.tables[4].placements[0], {
    ...expected, columnSpan: 6, rowSpan: 5,
  });
});

test('stale, unavailable-asset, no-op, and failed-persistence RESIZE attempts write nothing', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = existingPlacement('placement-resize');
  draft.tables[4].placements = [expected];
  const raw = JSON.stringify(draft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const common = { corner: 'se', expectedPlacement: structuredClone(expected), placementId: expected.id, tableId: 'table-05' };
  assert.equal(session.commitResize({ ...common, assetRecord: null,
    destination: { column: 1, row: 1, columnSpan: 6, rowSpan: 5 } }).ok, false);
  assert.equal(session.commitResize({ ...common, assetRecord: asset(),
    destination: { column: 1, row: 1, columnSpan: 3, rowSpan: 3 } }).ok, false);
  assert.equal(session.commitResize({ ...common, assetRecord: asset(),
    expectedPlacement: { ...expected, row: 2 },
    destination: { column: 1, row: 1, columnSpan: 6, rowSpan: 5 } }).ok, false);
  storage.fail();
  assert.equal(session.commitResize({ ...common, assetRecord: asset(),
    destination: { column: 1, row: 1, columnSpan: 6, rowSpan: 5 } }).ok, false);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.deepEqual(session.getDraft(), draft);
});

test('completed REMOVE needs no Library asset, preserves survivor order, and writes exactly once', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const first = existingPlacement('placement-first');
  const removed = existingPlacement('placement-remove');
  removed.layer = 4; removed.navigationOrder = 5;
  const last = existingPlacement('placement-last');
  last.layer = 8; last.navigationOrder = 9;
  draft.tables[4].placements = [first, removed, last];
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: JSON.stringify(draft) });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const result = session.commitRemoval({
    expectedPlacement: structuredClone(removed), placementId: removed.id, tableId: 'table-05',
  });
  assert.equal(result.ok, true);
  assert.equal(storage.writes, 1);
  assert.deepEqual(result.draft.tables[4].placements, [first, last]);
});

test('stale snapshot and failed-persistence REMOVE attempts retain exact accepted state and bytes', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = existingPlacement('placement-remove');
  draft.tables[4].placements = [expected];
  const raw = JSON.stringify(draft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.equal(session.commitRemoval({ expectedPlacement: { ...expected, column: 2 },
    placementId: expected.id, tableId: 'table-05' }).ok, false);
  storage.fail();
  assert.equal(session.commitRemoval({ expectedPlacement: structuredClone(expected),
    placementId: expected.id, tableId: 'table-05' }).ok, false);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.deepEqual(session.getDraft(), draft);
});

test('completed CROP revalidates live media, writes once, reloads, and projects the canonical crop', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = existingPlacement('placement-crop');
  draft.tables[4].placements = [expected];
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: JSON.stringify(draft) });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const result = session.commitCrop({
    assetRecord: asset(),
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    expectedMedia: { stableAssetId: ASSET, width: 1600, height: 900 },
    expectedPlacement: structuredClone(expected),
    placementId: expected.id,
    tableId: 'table-05',
  });
  assert.equal(result.ok, true);
  assert.equal(storage.writes, 1);
  assert.deepEqual(result.draft.tables[4].placements[0].crop, { x: 0.5, y: 0.5, zoom: 1 });
  const reloaded = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.deepEqual(reloaded.getDraft(), result.draft);
  const publication = projectLatticeProductionPublication(result.draft, [asset({
    creators: [], attributes: [], description: '', collectionName: null,
  })], { lastPublished: '1970-01-01T00:00:00.000Z' });
  assert.deepEqual(publication.tables[4].placements[0].crop, { x: 0.5, y: 0.5, zoom: 1 });
});

test('CROP cancellation stays outside the session and no-op, stale, media, authority, and storage failures write nothing', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = existingPlacement('placement-crop', ASSET);
  expected.crop = { x: 0.5, y: 0.5, zoom: 1 };
  draft.tables[4].placements = [expected];
  const raw = JSON.stringify(draft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const common = {
    assetRecord: asset(), expectedMedia: { stableAssetId: ASSET, width: 1600, height: 900 },
    expectedPlacement: structuredClone(expected), placementId: expected.id, tableId: 'table-05',
  };
  assert.equal(session.commitCrop({ ...common, crop: structuredClone(expected.crop) }).noOp, true);
  assert.equal(session.commitCrop({ ...common, crop: { x: 0.5, y: 0.5, zoom: 2 },
    expectedPlacement: { ...expected, row: 2 } }).ok, false);
  assert.equal(session.commitCrop({ ...common, crop: { x: 0.5, y: 0.5, zoom: 2 },
    assetRecord: asset({ imageWidth: 900 }) }).ok, false);
  assert.equal(session.commitCrop({ ...common, crop: { x: 0.5, y: 0.5, zoom: 2 },
    assetRecord: asset({ ownerAddress: OTHER }) }).ok, false);
  storage.fail();
  assert.equal(session.commitCrop({ ...common, crop: { x: 0.5, y: 0.5, zoom: 2 } }).ok, false);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.deepEqual(session.getDraft(), draft);
});

test('CROP remains profile-isolated and NATIVE FIT commits null exactly once', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = existingPlacement('placement-crop');
  expected.crop = { x: 0.5, y: 0.5, zoom: 2 };
  draft.tables[4].placements = [expected];
  const otherDraft = createEmptyLatticeProductionDraft(OTHER);
  const otherRaw = JSON.stringify(otherDraft);
  const storage = memoryStorage({
    [latticeProductionDraftKey(PROFILE)]: JSON.stringify(draft),
    [latticeProductionDraftKey(OTHER)]: otherRaw,
  });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.equal(session.commitCrop({
    assetRecord: asset(), crop: null,
    expectedMedia: { stableAssetId: ASSET, width: 1600, height: 900 },
    expectedPlacement: structuredClone(expected), placementId: expected.id, tableId: 'table-05',
  }).ok, true);
  assert.equal(storage.writes, 1);
  assert.equal(session.getDraft().tables[4].placements[0].crop, null);
  assert.equal(storage.values.get(latticeProductionDraftKey(OTHER)), otherRaw);
});

test('completed LAYER stably permutes sparse values in one transaction and survives reload and publication', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const first = existingPlacement('placement-a');
  const second = existingPlacement('placement-b');
  second.layer = 7; second.navigationOrder = 1;
  const last = existingPlacement('placement-c');
  last.layer = Number.MAX_SAFE_INTEGER; last.navigationOrder = 2;
  draft.tables[4].placements = [first, second, last];
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: JSON.stringify(draft) });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const result = session.commitLayer({
    assetRecords: [asset()],
    expectedPlacement: structuredClone(first),
    expectedPlacements: latticeProductionLayerTopologySnapshot(draft.tables[4]),
    operation: LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT,
    placementId: first.id,
    tableId: 'table-05',
  });
  assert.equal(result.ok, true);
  assert.equal(storage.writes, 1);
  assert.deepEqual(result.draft.tables[4].placements.map(({ id, layer, navigationOrder }) => ({ id, layer, navigationOrder })), [
    { id: 'placement-a', layer: Number.MAX_SAFE_INTEGER, navigationOrder: 0 },
    { id: 'placement-b', layer: 0, navigationOrder: 1 },
    { id: 'placement-c', layer: 7, navigationOrder: 2 },
  ]);
  assert.deepEqual(createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage }).getDraft(), result.draft);
  const publication = projectLatticeProductionPublication(result.draft, [asset({ creators: [], attributes: [], description: '' })], {
    lastPublished: '1970-01-01T00:00:00.000Z',
  });
  assert.deepEqual(publication.tables[4].placements.map(({ id, layer, navigationOrder }) => ({ id, layer, navigationOrder })), [
    { id: 'placement-a', layer: Number.MAX_SAFE_INTEGER, navigationOrder: 0 },
    { id: 'placement-b', layer: 0, navigationOrder: 1 },
    { id: 'placement-c', layer: 7, navigationOrder: 2 },
  ]);
});

test('LAYER boundary, barrier, stale topology, unavailable media, and storage failure write nothing', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const first = existingPlacement('placement-a');
  const locked = existingPlacement('placement-locked');
  locked.layer = 4; locked.navigationOrder = 1; locked.locked = true;
  const last = existingPlacement('placement-c');
  last.layer = 9; last.navigationOrder = 2;
  draft.tables[4].placements = [first, locked, last];
  const raw = JSON.stringify(draft);
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  const common = {
    assetRecords: [asset()], expectedPlacement: structuredClone(first),
    expectedPlacements: latticeProductionLayerTopologySnapshot(draft.tables[4]),
    placementId: first.id, tableId: 'table-05',
  };
  assert.equal(session.commitLayer({ ...common, operation: 'BACK' }).noOp, true);
  assert.equal(session.commitLayer({ ...common, operation: 'FORWARD' }).noOp, true);
  assert.equal(session.commitLayer({ ...common, operation: 'FRONT' }).noOp, true);
  assert.equal(session.commitLayer({ ...common, operation: 'SIDEWAYS' }).ok, false);
  assert.equal(session.commitLayer({ ...common, operation: 'FORWARD', expectedPlacements: [first] }).ok, false);

  const openDraft = structuredClone(draft);
  openDraft.tables[4].placements[1].locked = false;
  const openRaw = JSON.stringify(openDraft);
  const openStorage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: openRaw });
  const openSession = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage: openStorage });
  const openCommon = {
    ...common,
    expectedPlacements: latticeProductionLayerTopologySnapshot(openDraft.tables[4]),
  };
  assert.equal(openSession.commitLayer({ ...openCommon, assetRecords: [], operation: 'FORWARD' }).ok, false);
  openStorage.fail();
  assert.equal(openSession.commitLayer({ ...openCommon, operation: 'FORWARD' }).ok, false);
  assert.equal(openStorage.writes, 0);
  assert.equal(openStorage.values.get(latticeProductionDraftKey(PROFILE)), openRaw);
  assert.deepEqual(openSession.getDraft(), openDraft);
  assert.equal(storage.writes, 0);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
});

test('LAYER remains profile isolated and corrupt duplicate topology makes zero storage calls', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const first = existingPlacement('placement-a');
  const second = existingPlacement('placement-b');
  second.layer = 4; second.navigationOrder = 1;
  draft.tables[4].placements = [first, second];
  const otherDraft = createEmptyLatticeProductionDraft(OTHER);
  const otherRaw = JSON.stringify(otherDraft);
  const storage = memoryStorage({
    [latticeProductionDraftKey(PROFILE)]: JSON.stringify(draft),
    [latticeProductionDraftKey(OTHER)]: otherRaw,
  });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.equal(session.commitLayer({
    assetRecords: [asset()], expectedPlacement: first,
    expectedPlacements: latticeProductionLayerTopologySnapshot(draft.tables[4]),
    operation: 'FORWARD', placementId: first.id, tableId: 'table-05',
  }).ok, true);
  assert.equal(storage.values.get(latticeProductionDraftKey(OTHER)), otherRaw);

  const duplicate = structuredClone(draft);
  duplicate.tables[4].placements[1].layer = 0;
  const duplicateRaw = JSON.stringify(duplicate);
  const duplicateStorage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: duplicateRaw });
  const corrupt = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage: duplicateStorage });
  assert.equal(corrupt.commitLayer({}).ok, false);
  assert.equal(duplicateStorage.writes, 0);
  assert.equal(duplicateStorage.values.get(latticeProductionDraftKey(PROFILE)), duplicateRaw);
});

test('corrupt sessions block MOVE while preserving raw bytes', () => {
  const raw = '{corrupt';
  const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE)]: raw });
  const session = createOwnerLatticeAuthoringSession({ profileAddress: PROFILE, storage });
  assert.equal(session.commitCrop({}).ok, false);
  assert.equal(session.commitLayer({}).ok, false);
  assert.equal(session.commitMovement({}).ok, false);
  assert.equal(session.commitResize({}).ok, false);
  assert.equal(session.commitRemoval({}).ok, false);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE)), raw);
  assert.equal(storage.writes, 0);
});
