import assert from 'node:assert/strict';
import test from 'node:test';
import { systemWorkflowPlacementRequest } from './systemWorkflowPlacementRequest.js';

test('placement retains the resolved image fallback and decoded dimensions without changing token identity', () => {
  const asset = { id: 'token', selectedMedia: { url: 'https://example.com/missing.png', width: 100, height: 100 } };
  const destination = { column: 0, row: 0, columnSpan: 32, rowSpan: 18 };
  const request = systemWorkflowPlacementRequest(asset, { source: 'https://example.com/resolved.webp', width: 1800, height: 900 }, 'grid:home', destination);
  assert.deepEqual(request, { gridId: 'grid:home', stableAssetId: 'token', nativeWidth: 1800, nativeHeight: 900,
    selectedMedia: { url: 'https://example.com/resolved.webp', width: 1800, height: 900 }, destination });
  assert.equal(asset.selectedMedia.url, 'https://example.com/missing.png');
});

test('ordinary token placement does not add a selected image or override automatic positioning', () => {
  assert.deepEqual(systemWorkflowPlacementRequest({ stableAssetId: 'token' }, { width: 900, height: 1800 }, 'grid:two'), {
    gridId: 'grid:two', stableAssetId: 'token', nativeWidth: 900, nativeHeight: 1800,
  });
});
