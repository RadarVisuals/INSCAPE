import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';

test('canonical image dimensions win over ambiguous display dimensions', () => {
  assert.deepEqual(ownerSystemWorkflowAssetDimensions({
    imageWidth: 2000,
    imageHeight: 2000,
    width: 320,
    height: 180,
  }), { width: 2000, height: 2000 });
});

test('legacy dimensions remain a bounded fallback', () => {
  assert.deepEqual(ownerSystemWorkflowAssetDimensions({ width: 1200, height: 800 }), { width: 1200, height: 800 });
  assert.equal(ownerSystemWorkflowAssetDimensions({ width: 1200 }), null);
});
