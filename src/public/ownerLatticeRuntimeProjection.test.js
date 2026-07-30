import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft, LATTICE_PRODUCTION_VISIBILITY } from '../lattice/domain/latticeProductionDraft.js';
import { prepareOwnerLatticeRuntimeDraft } from './ownerLatticeRuntimeProjection.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const placement = { id: 'placement-a', stableAssetId: ASSET, column: 2, row: 3, columnSpan: 6, rowSpan: 5, layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE', mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } }, backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC, locked: false };
const record = (overrides = {}) => ({ id: ASSET, chainId: 42, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8', imageUrl: 'https://cdn.example/work.webp', ...overrides });

test('unresolved first-batch references become local placeholders while ready placements remain projectable', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement];
  const first = prepareOwnerLatticeRuntimeDraft(draft, []);
  assert.equal(first.draft.tables[4].placements.length, 0);
  assert.deepEqual(first.unresolvedPlacements.map(({ id, tableId }) => ({ id, tableId })), [{ id: 'placement-a', tableId: 'table-05' }]);
  const patched = prepareOwnerLatticeRuntimeDraft(draft, [record({ name: 'Indexer batch' })]);
  assert.equal(patched.draft.tables[4].placements.length, 1);
  assert.equal(patched.unresolvedPlacements.length, 0);
  assert.equal(draft.tables[4].placements.length, 1);
});

test('mismatched and unsafe records remain local while a late exact record resolves in place', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement];
  assert.equal(prepareOwnerLatticeRuntimeDraft(draft, [record({ tokenId: '0x02' })]).unresolvedPlacements.length, 1);
  assert.equal(prepareOwnerLatticeRuntimeDraft(draft, [record({ imageUrl: 'javascript:alert(1)' })]).unresolvedPlacements.length, 1);
  assert.equal(prepareOwnerLatticeRuntimeDraft(draft, [record()]).unresolvedPlacements.length, 0);
});
