import assert from 'node:assert/strict';
import test from 'node:test';
import { moveLatticeLayerEntries, moveLatticeLayerEntry } from './latticeLayersModel.js';

test('visual layer movement is deterministic and leaves input order untouched', () => {
  const layers = [{ id: 'front' }, { id: 'middle' }, { id: 'back' }];
  assert.deepEqual(moveLatticeLayerEntry(layers, 'back', 'front').map(({ id }) => id), ['back', 'front', 'middle']);
  assert.deepEqual(layers.map(({ id }) => id), ['front', 'middle', 'back']);
  assert.equal(moveLatticeLayerEntry(layers, 'missing', 'front'), null);
});

test('visual multi-layer movement preserves selected order and moves it as one block', () => {
  const layers = [{ id: 'front' }, { id: 'upper' }, { id: 'lower' }, { id: 'back' }];
  assert.deepEqual(moveLatticeLayerEntries(layers, ['upper', 'lower'], 'front').map(({ id }) => id), [
    'upper', 'lower', 'front', 'back',
  ]);
  assert.deepEqual(moveLatticeLayerEntries(layers, ['upper', 'lower'], 'back').map(({ id }) => id), [
    'front', 'back', 'upper', 'lower',
  ]);
  assert.equal(moveLatticeLayerEntries(layers, ['upper', 'lower'], 'lower'), null);
  assert.deepEqual(layers.map(({ id }) => id), ['front', 'upper', 'lower', 'back']);
});
