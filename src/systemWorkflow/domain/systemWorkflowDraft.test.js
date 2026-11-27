import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfileDocumentV9Asset } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import {
  SYSTEM_WORKFLOW_DRAFT_VERSION,
  SYSTEM_WORKFLOW_LIMITS,
  createEmptySystemWorkflowDraft,
  createSystemWorkflowGridId,
  validateSystemWorkflowDraft,
  systemWorkflowSnapStep,
} from './systemWorkflowDraft.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const createDraft = () => createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home-uuid' });
test('draft starts without retired Display fields', () => {
  const draft = createDraft();
  assert.equal(draft.draftVersion, SYSTEM_WORKFLOW_DRAFT_VERSION);
  assert.deepEqual(draft.artboard, { aspectWidth: 16, aspectHeight: 9 });
  assert.deepEqual(draft.geometry, { columns: 32, rows: 18 });
  assert.deepEqual(draft.appearance, {
    surfaceId: 'mist',
    guideMode: 'LINES', guideSize: 0, guideColor: '#6f746f',
  });
  assert.equal(Object.hasOwn(draft, 'grids'), false);
  assert.equal(validateSystemWorkflowDraft(draft).valid, true);
});

test('validation is exact and rejects legacy or malformed contract fields', () => {
  for (const mutate of [
    (draft) => { draft.draftVersion = 3; },
    (draft) => { draft.tables = []; },
    (draft) => { draft.appearance.guideMode = 'GRID'; },
    (draft) => { draft.appearance.guideSize = -9; },
    (draft) => { draft.grids = []; },
    (draft) => { draft.displays = []; },
    (draft) => { draft.workbench = { version: 1, identity: { open: false, window: { left: 0, top: 0, width: 420 } }, display: {} }; },
  ]) {
    const draft = createDraft();
    mutate(draft);
    assert.equal(validateSystemWorkflowDraft(draft).valid, false);
  }
});

test('signed Grid density maps -8 through +8 onto exact ninth-cell snap intervals', () => {
  assert.equal(systemWorkflowSnapStep(-8), 1 / 9);
  assert.equal(systemWorkflowSnapStep(0), 1);
  assert.equal(systemWorkflowSnapStep(8), 9);
  assert.throws(() => systemWorkflowSnapStep(-9), { code: 'SYSTEM_WORKFLOW_GRID_DENSITY_INVALID' });
  assert.throws(() => systemWorkflowSnapStep(9), { code: 'SYSTEM_WORKFLOW_GRID_DENSITY_INVALID' });
});

test('Grid IDs use bounded injected randomness and never timestamp fallback', () => {
  assert.equal(createSystemWorkflowGridId([], { generateId: () => 'uuid-one' }), 'grid:uuid-one');
  assert.equal(createSystemWorkflowGridId(['grid:repeat'], {
    generateId: (attempt) => attempt === 1 ? 'repeat' : 'fresh',
  }), 'grid:fresh');
  assert.throws(
    () => createSystemWorkflowGridId([], { generateId: () => 'bad value' }),
    { code: 'SYSTEM_WORKFLOW_ID_CANDIDATE_INVALID' },
  );
});

test('draft size validation still accepts the exact byte ceiling for native images', () => {
  const draft = createDraft();
  const contractAddress = '0x' + '2'.repeat(40);
  const id = `42:${contractAddress}:0x01`;
  const imageUrl = count => 'data:image/svg+xml;base64,' + Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><desc>' + 'x'.repeat(count) + '</desc><rect width="100" height="100"/></svg>',
  ).toString('base64');
  const asset = buildProfileDocumentV9Asset({ id, contractAddress, tokenId: '0x01', chainId: 42,
    standard: 'LSP8', name: 'Image', imageUrl: imageUrl(190000), imageWidth: 100, imageHeight: 100 }, id);
  draft.imageModules = [0, 1].map(index => ({ id: `image:test-${index}`, name: 'Image', width: 100, height: 100,
    visibility: 'PRIVATE', artwork: { id: `artwork:test-${index}`, asset: structuredClone(asset), crop: null,
      transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } } }));
  const bytes = () => Buffer.byteLength(JSON.stringify(draft));
  const second = draft.imageModules[1].artwork.asset;
  second.media.url = imageUrl(190000 + 3 * Math.floor((SYSTEM_WORKFLOW_LIMITS.maxJsonBytes - bytes()) / 4));
  second.description = 'x'.repeat(SYSTEM_WORKFLOW_LIMITS.maxJsonBytes - bytes());
  assert.equal(bytes(), SYSTEM_WORKFLOW_LIMITS.maxJsonBytes);
  assert.equal(validateSystemWorkflowDraft(draft).valid, true);
  second.description += 'x';
  assert.ok(validateSystemWorkflowDraft(draft).errors.some(error => error.code === 'draft_too_large'));
});
