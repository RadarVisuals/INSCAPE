import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import {
  buildOwnerSystemWorkflowPreviewDocument,
  ownerSystemWorkflowPreviewEntryMediaUrls,
  preloadOwnerSystemWorkflowPreviewEntryMedia,
  profileDocumentV9EntryGrid,
} from './ownerSystemWorkflowPreviewDocument.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const asset = () => ({
  id: ASSET, chainId: 42, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8',
  name: 'Preview artwork', description: '', imageUrl: 'https://assets.example/image.png',
  imageWidth: 1600, imageHeight: 900, creators: [], attributes: [],
});
const placement = (id, order) => ({
  id, stableAssetId: ASSET, column: order, row: 0, columnSpan: 1, rowSpan: 1,
  layer: order, navigationOrder: order, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

test('Preview uses the v9 builder and the first Grid remaining after public filtering', async () => {
  const draft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'private-first' });
  draft.grids[0].visibility = 'PRIVATE';
  draft.grids.push({
    ...structuredClone(draft.grids[0]), id: 'grid:visitor-entry', title: 'VISITOR ENTRY', visibility: 'PUBLIC',
    placements: [placement('one', 0), placement('two', 1)],
  });
  draft.grids.push({
    ...structuredClone(draft.grids[1]), id: 'grid:later', title: 'LATER', placements: [placement('later', 0)],
  });
  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [asset()], profile: { name: 'Resident' }, profileAddress: PROFILE, systemWorkflowDraft: draft,
  });
  assert.equal(preview.version, 9);
  assert.equal(profileDocumentV9EntryGrid(preview).id, 'grid:visitor-entry');
  assert.deepEqual(ownerSystemWorkflowPreviewEntryMediaUrls(preview), ['https://assets.example/image.png']);

  const decoded = [];
  class FakeImage {
    set src(value) { this.source = value; }
    decode() { decoded.push(this.source); return Promise.resolve(); }
  }
  await preloadOwnerSystemWorkflowPreviewEntryMedia(preview, { ImageConstructor: FakeImage });
  assert.deepEqual(decoded, ['https://assets.example/image.png']);
});

test('Preview rejects cross-profile draft authority and a draft without public Grids', () => {
  const other = createEmptySystemWorkflowDraft('0x3333333333333333333333333333333333333333', { generateId: () => 'other' });
  assert.throws(() => buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [], profile: {}, profileAddress: PROFILE, systemWorkflowDraft: other,
  }), /profile document authority/);
  const privateOnly = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'private' });
  privateOnly.grids[0].visibility = 'PRIVATE';
  assert.throws(() => buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [], profile: {}, profileAddress: PROFILE, systemWorkflowDraft: privateOnly,
  }), { code: 'INSCAPE_PROFILE_PUBLIC_GRID_REQUIRED' });
});
