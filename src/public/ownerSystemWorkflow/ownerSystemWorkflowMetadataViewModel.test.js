import assert from 'node:assert/strict';
import test from 'node:test';
import { createOwnerSystemWorkflowMetadataViewModel } from './ownerSystemWorkflowMetadataViewModel.js';

const placement = { id: 'placed', stableAssetId: '42:contract:token' };

test('metadata model exposes dossier facts without viewer state', () => {
  const model = createOwnerSystemWorkflowMetadataViewModel(placement, {
    attributes: [{ key: 'Mood', value: 'Quiet' }], creators: [{ address: '0xcreator', name: 'Artist' }],
    collectionName: 'Studies', contractAddress: '0x1111111111111111111111111111111111111111',
    description: 'Independent metadata.', imageHeight: 900, imageWidth: 1600, name: 'Study', standard: 'LSP8',
  });
  assert.equal(model.dossier.title, 'Study');
  assert.equal(model.dossier.collection, 'Studies');
  assert.deepEqual(model.dossier.traits, [{ label: 'Mood', value: 'Quiet' }]);
  assert.deepEqual(model.dossier.creators, [{ address: '0xcreator', name: 'Artist' }]);
  assert.equal(model.dossier.assetDetailHref, 'https://explorer.lukso.network/address/0x1111111111111111111111111111111111111111');
  assert.equal('technical' in model.dossier, false);
  assert.equal('media' in model, false);
  assert.equal('placement' in model, false);
  assert.equal('focusDimensions' in model, false);
});

test('metadata remains available when artwork media or dimensions are unknown', () => {
  const model = createOwnerSystemWorkflowMetadataViewModel(placement, { description: 'Text survives.', name: 'Unknown media' });
  assert.equal(model.dossier.description, 'Text survives.');
  assert.equal(model.dossier.assetDetailHref, null);
});

test('metadata preserves every source attribute without a display-length limit', () => {
  const attributes = Array.from({ length: 16 }, (_, index) => ({ key: `Trait ${index + 1}`, value: index + 1 }));
  const model = createOwnerSystemWorkflowMetadataViewModel(placement, { attributes });
  assert.equal(model.dossier.traits.length, 16);
  assert.deepEqual(model.dossier.traits.at(-1), { label: 'Trait 16', value: '16' });
});

test('metadata omits empty traits', () => {
  const model = createOwnerSystemWorkflowMetadataViewModel(placement, {
    attributes: [{ key: 'Mood', value: '' }, { key: '', value: 'Quiet' }, { key: 'Edition', value: 1 }],
  });
  assert.deepEqual(model.dossier.traits, [{ label: 'Edition', value: '1' }]);
});

test('metadata requires a placement and asset record', () => {
  assert.equal(createOwnerSystemWorkflowMetadataViewModel(null, {}), null);
  assert.equal(createOwnerSystemWorkflowMetadataViewModel(placement, null), null);
});
