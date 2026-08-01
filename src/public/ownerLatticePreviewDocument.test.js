import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../lattice/domain/latticeProductionDraft.js';
import {
  buildOwnerLatticePreviewDocument,
  ownerLatticePreviewEntryMediaUrls,
  preloadOwnerLatticePreviewEntryMedia,
} from './ownerLatticePreviewDocument.js';

const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const asset = () => ({
  id: ASSET, chainId: 42, ownerAddress: PROFILE, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8',
  name: 'Preview artwork', description: '', imageUrl: 'https://assets.example/image.png',
  imageWidth: 1600, imageHeight: 900, creators: [], attributes: [],
});
const placement = (id, index) => ({
  id, stableAssetId: ASSET, column: index * 4, row: 0, columnSpan: 3, rowSpan: 3,
  layer: index, navigationOrder: index, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

test('owner Preview creates a validated v8 public projection without owner workspace state', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.appearance.surfaceId = 'paper';
  const document = buildOwnerLatticePreviewDocument({
    activeActorId: 'abyssal_eye', assetRecords: [], latticeDraft: draft,
    profile: { name: 'Resident Zero', avatarUrl: '' }, profileAddress: PROFILE, stageId: 'moonpurple',
  });
  assert.equal(document.version, 8);
  assert.equal(document.profile.address, PROFILE);
  assert.equal(document.lattice.appearance.surfaceId, 'paper');
  assert.equal(document.lattice.tables.length, 9);
  assert.deepEqual(document.spaces, []);
  assert.deepEqual(document.canvasObjects, []);
});

test('owner Preview rejects a draft from another profile authority', () => {
  const draft = createEmptyLatticeProductionDraft('0x1111111111111111111111111111111111111111');
  assert.throws(() => buildOwnerLatticePreviewDocument({ assetRecords: [], latticeDraft: draft,
    profile: {}, profileAddress: PROFILE }), /preview profile authority/);
});

test('owner Preview pre-decodes only unique media on the deterministic entry table', async () => {
  const latticeDraft = createEmptyLatticeProductionDraft(PROFILE);
  const entry = latticeDraft.tables.find(({ coordinate }) => coordinate.x === 0 && coordinate.y === 0);
  entry.placements = [placement('first', 0), placement('second', 1)];
  const preview = buildOwnerLatticePreviewDocument({
    activeActorId: 'abyssal_eye', assetRecords: [asset()], latticeDraft,
    profile: {}, profileAddress: PROFILE, stageId: 'moonpurple',
  });
  assert.deepEqual(ownerLatticePreviewEntryMediaUrls(preview), ['https://assets.example/image.png']);
  const decoded = [];
  class FakeImage {
    set src(value) { this.source = value; }
    decode() { decoded.push(this.source); return Promise.resolve(); }
  }
  await preloadOwnerLatticePreviewEntryMedia(preview, { ImageConstructor: FakeImage });
  assert.deepEqual(decoded, ['https://assets.example/image.png']);
});
