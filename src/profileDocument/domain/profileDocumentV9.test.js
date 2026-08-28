import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9, projectSystemWorkflowPublicGrids } from './profileDocumentV9Builder.js';
import {
  canonicalSerializeProfileDocumentV9,
  profileDocumentV9CanonicalHash,
  profileDocumentV9ContentFingerprint,
  profileDocumentV9HashInput,
  profileDocumentV9ReconciliationFingerprint,
} from './profileDocumentV9Serialization.js';
import {
  assertValidProfileDocumentV9,
  parseProfileDocumentV9Json,
  validateProfileDocumentV9,
} from './profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from './profileDocumentV9Reconciliation.js';
import { SYSTEM_WORKFLOW_LIMITS } from '../../systemWorkflow/domain/systemWorkflowDraft.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const asset = () => ({
  id: ASSET, chainId: 42, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8',
  name: 'Canonical work', description: 'Public description', collectionName: 'Collection',
  imageUrl: 'https://assets.example/work.png', thumbnailUrl: null, originalImageUrl: null,
  imageWidth: 1600, imageHeight: 900, creators: [{ address: PROFILE, name: 'Creator' }], attributes: [],
  fieldProvenance: { creators: { source: 'LUKSO INDEXER / LSP4 CREATORS', scope: 'tokenId' } },
});
const placement = (id, order, overrides = {}) => ({
  id, stableAssetId: ASSET, column: order % 20, row: 0, columnSpan: 1, rowSpan: 1,
  layer: order, navigationOrder: order, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: true,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  ...overrides,
});

function draft() {
  const value = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  value.grids[0].placements = [placement('public-placement', 1, {
    column: 4, row: 3, columnSpan: 8, rowSpan: 6, layer: 9, navigationOrder: 3,
    crop: { x: 0.25, y: 0.75, zoom: 2 }, frameId: 'DOSSIER',
    mat: { enabled: true, color: '#123456', inset: { top: 0.1, right: 0.2, bottom: 0.1, left: 0.2 } },
    backing: { enabled: true, color: '#654321' }, transparencyMode: 'PRESERVE_ALPHA',
    transform: { quarterTurns: 1, mirrorX: true, mirrorY: false },
  })];
  value.grids.push({
    ...structuredClone(value.grids[0]), id: 'grid:private', title: 'PRIVATE GRID', visibility: 'PRIVATE',
    placements: [placement('private-grid-placement', 0)],
  });
  value.grids.push({
    ...structuredClone(value.grids[0]), id: 'grid:second', title: 'SECOND', placements: [
      placement('private-placement', 0, { visibility: 'PRIVATE', locked: false }),
      placement('second-public', 1, { locked: false }),
    ],
  });
  return value;
}

function document(overrides = {}) {
  return buildProfileDocumentV9({
    assetRecords: [asset()], createdAt: 1, exportedAt: 2, profileAddress: PROFILE,
    profileIdentity: { name: 'Resident Zero', avatarUrl: 'https://assets.example/avatar.png' },
    revision: 4, systemWorkflowDraft: draft(), ...overrides,
  });
}

test('v9 builder emits only the clean INSCAPE envelope and ordered public Grids', () => {
  const value = document();
  assert.deepEqual(Object.keys(value), [
    'documentType', 'version', 'documentId', 'revision', 'createdAt', 'exportedAt',
    'network', 'profile', 'artboard', 'geometry', 'appearance', 'identityPresentation', 'grids', 'metadata',
  ]);
  assert.equal(value.documentType, 'INSCAPE_PROFILE');
  assert.equal(value.version, 9);
  assert.deepEqual(value.grids.map(({ id }) => id), ['grid:home', 'grid:second']);
  assert.deepEqual(value.grids.map(({ title }) => title), ['HOME', 'SECOND']);
  assert.deepEqual(value.grids[1].placements.map(({ id }) => id), ['second-public']);
  for (const forbidden of ['lattice', 'tables', 'presentation', 'spaces', 'canvasObjects', 'keeper', 'stage', 'environment', 'signals', 'systemModules']) {
    assert.equal(Object.hasOwn(value, forbidden), false, forbidden);
  }
  assert.equal(validateProfileDocumentV9(value).valid, true);
});

test('public placement projection preserves canonical asset and presentation while omitting owner lock state', () => {
  const input = draft();
  const projected = projectSystemWorkflowPublicGrids(input, [asset()]);
  const value = projected[0].placements[0];
  assert.equal(value.asset.stableAssetId, ASSET);
  assert.equal(value.asset.media.url, 'https://assets.example/work.png');
  assert.deepEqual(value.asset.creators, [{ address: PROFILE, name: 'Creator',
    source: 'LUKSO INDEXER / LSP4 CREATORS', scope: 'tokenId' }]);
  assert.deepEqual({
    column: value.column, row: value.row, columnSpan: value.columnSpan, rowSpan: value.rowSpan,
    crop: value.crop, frameId: value.frameId, mat: value.mat, backing: value.backing,
    transparencyMode: value.transparencyMode, layer: value.layer,
    navigationOrder: value.navigationOrder, transform: value.transform,
  }, {
    column: 4, row: 3, columnSpan: 8, rowSpan: 6,
    crop: { x: 0.25, y: 0.75, zoom: 2 }, frameId: 'DOSSIER',
    mat: { enabled: true, color: '#123456', inset: { top: 0.1, right: 0.2, bottom: 0.1, left: 0.2 } },
    backing: { enabled: true, color: '#654321' }, transparencyMode: 'PRESERVE_ALPHA', layer: 9,
    navigationOrder: 3, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false },
  });
  assert.equal(Object.hasOwn(value, 'locked'), false);
  assert.equal(Object.hasOwn(value, 'stableAssetId'), false);
  assert.deepEqual(input, draft(), 'projection must not mutate the canonical draft');
});

test('an authored World Cover is published separately from visitor Grids at the canonical 16:9 size', () => {
  const systemWorkflowDraft = draft();
  systemWorkflowDraft.grids.find(({ id }) => id === 'grid:world-cover').placements = [
    placement('world-cover-placement', 0, { locked: false }),
  ];
  const value = document({ systemWorkflowDraft });
  assert.deepEqual(value.grids.map(({ id }) => id), ['grid:home', 'grid:second']);
  assert.equal(value.metadata.worldCover.width, 768);
  assert.equal(value.metadata.worldCover.height, 432);
  assert.equal(value.metadata.worldCover.grid.id, 'grid:world-cover');
  assert.deepEqual(value.metadata.worldCover.grid.placements.map(({ id }) => id), ['world-cover-placement']);
  assert.equal(validateProfileDocumentV9(value).valid, true);
});

test('publication fails closed when public filtering leaves no Grid', () => {
  const value = draft();
  value.grids.filter(({ id }) => id !== 'grid:world-cover').forEach((grid) => { grid.visibility = 'PRIVATE'; });
  assert.throws(() => buildProfileDocumentV9({
    assetRecords: [], createdAt: 1, exportedAt: 2, profileAddress: PROFILE, systemWorkflowDraft: value,
  }), { code: 'INSCAPE_PROFILE_PUBLIC_GRID_REQUIRED' });
});

test('builder rejects explicit invalid revisions and strips creators without canonical LSP4 provenance', () => {
  for (const revision of [0, -1, 1.5, '2', NaN]) {
    assert.throws(() => document({ revision }), { code: 'INSCAPE_PROFILE_REVISION_INVALID' });
  }
  const unproven = asset(); delete unproven.fieldProvenance;
  const value = document({ assetRecords: [unproven] });
  assert.deepEqual(value.grids[0].placements[0].asset.creators, []);
});

test('malformed identity presentation returns structured validation errors without throwing', () => {
  for (const identityPresentation of [null, 'identity', {}, { avatar: null }]) {
    const candidate = structuredClone(document()); candidate.identityPresentation = identityPresentation;
    let result;
    assert.doesNotThrow(() => { result = validateProfileDocumentV9(candidate); });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(({ path }) => path === 'identityPresentation'));
  }
});

test('v9 validation is exact, v9-only, quantity bounded, and rejects private or legacy leakage', () => {
  const source = document();
  for (const mutate of [
    (value) => { value.version = 8; },
    (value) => { value.documentType = 'OS_UNDERNEATH_PROFILE'; },
    (value) => { value.lattice = {}; },
    (value) => { value.grids[0].coordinate = { x: 0, y: 0 }; },
    (value) => { value.grids[0].visibility = 'PRIVATE'; },
    (value) => { value.grids[0].placements[0].locked = false; },
  ]) {
    const candidate = structuredClone(source);
    mutate(candidate);
    assert.equal(validateProfileDocumentV9(candidate).valid, false);
  }

  const tooManyGrids = structuredClone(source);
  tooManyGrids.grids = Array.from({ length: 25 }, (_, index) => ({
    ...structuredClone(source.grids[0]), id: `grid:g-${index}`, placements: [],
  }));
  assert.ok(validateProfileDocumentV9(tooManyGrids).errors.some(({ code }) => code === 'invalid_grid_count'));

  const tooManyPlacements = structuredClone(source);
  tooManyPlacements.grids = [{ ...structuredClone(source.grids[0]), placements: Array.from({ length: 201 }, (_, index) => ({
    ...structuredClone(source.grids[0].placements[0]), id: `p-${index}`, layer: index, navigationOrder: index,
  })) }];
  assert.ok(validateProfileDocumentV9(tooManyPlacements).errors.some(({ code }) => code === 'invalid_placements'));

  const tooManyReferences = structuredClone(source);
  tooManyReferences.identityPresentation.avatar = { mode: 'official', asset: null, shape: 'square' };
  tooManyReferences.grids = Array.from({ length: 6 }, (_, gridIndex) => ({
    ...structuredClone(source.grids[0]), id: `grid:r-${gridIndex}`,
    placements: Array.from({ length: gridIndex < 5 ? 200 : 1 }, (_, index) => ({
      ...structuredClone(source.grids[0].placements[0]), id: `p-${gridIndex}-${index}`,
      layer: index, navigationOrder: index,
    })),
  }));
  assert.ok(validateProfileDocumentV9(tooManyReferences).errors.some(({ code }) => code === 'too_many_asset_references'));
});

test('v9 raw byte boundary accepts 512 KiB and rejects limit plus one', () => {
  const value = document();
  assert.equal(validateProfileDocumentV9(value, { rawSize: SYSTEM_WORKFLOW_LIMITS.maxJsonBytes }).valid, true);
  assert.ok(validateProfileDocumentV9(value, { rawSize: SYSTEM_WORKFLOW_LIMITS.maxJsonBytes + 1 }).errors
    .some(({ code }) => code === 'document_too_large'));
});

test('canonical serialization and hash input are stable while content/reconciliation fingerprints omit only their authorities', () => {
  const first = document();
  const second = document({ createdAt: 10, exportedAt: 20, revision: 9 });
  const changedCache = document({ createdAt: 10, exportedAt: 20, revision: 9,
    profileIdentity: { name: 'Changed cached identity' } });
  assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(first)), first);
  assert.deepEqual(profileDocumentV9HashInput(first), new TextEncoder().encode(canonicalSerializeProfileDocumentV9(first)));
  assert.match(profileDocumentV9CanonicalHash(first), /^0x[0-9a-f]{64}$/u);
  assert.equal(profileDocumentV9ContentFingerprint(first), profileDocumentV9ContentFingerprint(second));
  assert.equal(profileDocumentV9ReconciliationFingerprint(first), profileDocumentV9ReconciliationFingerprint(second));
  assert.notEqual(profileDocumentV9ContentFingerprint(first), profileDocumentV9ContentFingerprint(changedCache));
  assert.equal(profileDocumentV9ReconciliationFingerprint(first), profileDocumentV9ReconciliationFingerprint(changedCache));
  assert.throws(() => parseProfileDocumentV9Json(JSON.stringify({ ...first, version: 8 })));
});

test('v9-only reconciliation restores public draft-v4 state and preserves unrelated private Grids', () => {
  const published = document();
  const current = draft();
  current.grids = current.grids.filter(({ visibility, id }) => visibility === 'PRIVATE' || id === 'grid:world-cover');
  current.grids.find(({ id }) => id === 'grid:private').placements[0].locked = true;
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(published, current);
  assert.equal(restored.draftVersion, 4);
  assert.deepEqual(restored.grids.map(({ id }) => id), ['grid:home', 'grid:second', 'grid:private', 'grid:world-cover']);
  assert.equal(restored.grids[0].placements[0].stableAssetId, ASSET);
  assert.equal(restored.grids[0].placements[0].locked, false);
  assert.equal(restored.grids[2].placements[0].locked, true);
  assert.deepEqual(assertValidProfileDocumentV9(published), published);
});
