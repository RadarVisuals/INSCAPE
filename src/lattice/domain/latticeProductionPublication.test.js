import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from './latticeProductionDraft.js';
import { projectLatticeProductionPublication } from './latticeProductionAdapter.js';
import { validateLatticeProductionPublication, validateLatticeProductionPublicAssetReference } from './latticeProductionPublication.js';

const reference = (overrides = {}) => ({
  stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01',
  network: 'lukso-mainnet', chainId: 42, tokenStandard: 'LSP8',
  contractAddress: '0x2222222222222222222222222222222222222222', tokenId: '0x01',
  name: 'Real work', description: '', collectionName: null,
  media: { url: 'ipfs://QmYwAPJzv5CZsnAzt8auVZRnGiRA7a4Hkvp9FzWb6gQd5K/work.webp', width: 1600, height: 900, type: 'image' },
  creators: [{ address: '0x1111111111111111111111111111111111111111', name: 'Creator' }],
  attributes: [{ key: 'Edition', value: '1', type: 'string' }], ...overrides,
});

test('public asset references contain canonical real identity, safe media, native ratio, and honest metadata', () => {
  assert.equal(validateLatticeProductionPublicAssetReference(reference()), true);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ stableAssetId: 'owned-asset-1' })), false);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ media: { url: 'javascript:alert(1)', width: 1, height: 1, type: 'image' } })), false);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ creators: [{ address: 'not-an-address', name: 'Invented' }] })), false);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ media: { url: 'https://cdn.example/work.webp', width: null, height: null, type: 'unknown' } })), true);
});

test('version-one publications migrate placement transforms to identity without changing authored content', () => {
  const draft = createEmptyLatticeProductionDraft('0x1111111111111111111111111111111111111111');
  draft.tables[4].placements.push({
    id: 'placement-1', stableAssetId: reference().stableAssetId, column: 1, row: 2, columnSpan: 3, rowSpan: 4,
    layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  });
  const publication = projectLatticeProductionPublication(draft, [{
    id: reference().stableAssetId, chainId: 42,
    contractAddress: '0x2222222222222222222222222222222222222222', tokenId: '0x01', standard: 'LSP8',
    name: 'Real work', description: '', collectionName: null, imageUrl: 'https://cdn.example/work.webp',
    thumbnailUrl: null, originalImageUrl: null, imageWidth: 1600, imageHeight: 900,
    creators: reference().creators, attributes: reference().attributes,
  }], { lastPublished: '2026-07-31T00:00:00.000Z' });
  const legacy = structuredClone(publication);
  legacy.latticeVersion = 1;
  delete legacy.tables[4].placements[0].transform;
  const result = validateLatticeProductionPublication(legacy);
  assert.equal(result.valid, true);
  assert.deepEqual(result.value.tables[4].placements[0].transform, { quarterTurns: 0, mirrorX: false, mirrorY: false });
  assert.equal(legacy.tables[4].placements[0].transform, undefined);
});
