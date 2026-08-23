import assert from 'node:assert/strict';
import test from 'node:test';
import { createOwnerSystemWorkflowFocusViewModel } from './ownerSystemWorkflowFocusViewModel.js';

const placement = {
  id: 'placement-one', stableAssetId: '42:0xasset:0x01', navigationOrder: 4,
  column: 2, row: 3, columnSpan: 5, rowSpan: 4, layer: 1,
  crop: { x: 0.4, y: 0.6, zoom: 1.5 }, frameId: 'LINE',
  mat: { enabled: true, color: '#111111', inset: { top: 1, right: 1, bottom: 1, left: 1 } },
  backing: { enabled: true, color: '#eeeeee' }, transparencyMode: 'OPAQUE',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 1, mirrorX: true, mirrorY: false },
};

test('owner focus view model retains canonical presentation and builds all three metadata modules', () => {
  const model = createOwnerSystemWorkflowFocusViewModel(placement, {
    id: placement.stableAssetId, name: 'Signal Field', description: 'Narrative record.',
    src: '/signal.webp', width: 2400, height: 1350, collectionName: 'STUDIES', standard: 'LSP8',
    creators: [{ address: '0x1111111111111111111111111111111111111111', name: 'RADAR' }],
    attributes: [{ key: 'FREQUENCY', value: 'LOW' }],
  });
  assert.equal(model.media.src, '/signal.webp');
  assert.deepEqual(model.focusDimensions, { width: 2400, height: 1350 });
  assert.equal(model.dossier.description, 'Narrative record.');
  assert.deepEqual(model.dossier.traits, [
    { label: 'COLLECTION', value: 'STUDIES' },
    { label: 'FREQUENCY', value: 'LOW' },
  ]);
  assert.ok(model.dossier.technical.some(({ label }) => label === 'SOURCE DIMENSIONS'));
  assert.deepEqual(model.placement, placement);
  assert.notEqual(model.placement, placement);
});

test('owner focus view model rejects missing media without inventing a fallback authority', () => {
  assert.equal(createOwnerSystemWorkflowFocusViewModel(placement, { name: 'Missing' }), null);
});
