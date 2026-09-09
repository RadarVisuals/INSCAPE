import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createOwnerShellSystemViewerEntry } from './useOwnerShellSystemArtworkViewer.js';

const asset = {
  collection: 'Collection',
  height: 1200,
  mediaType: 'image',
  src: '/asset.webp',
  stableAssetId: 'asset-1',
  title: 'Artwork',
  width: 1600,
};
const placement = { assetId: 'asset-1', crop: { x: 0.5, y: 0.5, zoom: 1.2 }, height: 300, id: 'placement-1', width: 400 };

test('viewer entry projection preserves canonical media, crop, proportions and honest fixture metadata', () => {
  const entry = createOwnerShellSystemViewerEntry({ asset, placement });
  assert.equal(entry.accessibleLabel, 'Artwork');
  assert.deepEqual(entry.focusDimensions, { height: 1200, width: 1600 });
  assert.deepEqual(entry.media, { accessibleLabel: 'Artwork', src: '/asset.webp' });
  assert.deepEqual(entry.placement.crop, placement.crop);
  assert.equal(entry.placement.columnSpan, 4);
  assert.equal(entry.placement.rowSpan, 3);
  assert.deepEqual(entry.dossier.traits, [
    { label: 'COLLECTION', value: 'Collection' },
    { label: 'FORMAT', value: '1600 × 1200' },
    { label: 'MEDIA', value: 'IMAGE' },
  ]);
});

test('viewer projection fails closed without both an asset and placement', () => {
  assert.equal(createOwnerShellSystemViewerEntry({ asset: null, placement }), null);
  assert.equal(createOwnerShellSystemViewerEntry({ asset, placement: null }), null);
});

test('viewer session ownership is isolated from the owner-shell parent', async () => {
  const [controller, parent] = await Promise.all([
    readFile(new URL('./useOwnerShellSystemArtworkViewer.js', import.meta.url), 'utf8'),
    readFile(new URL('./OwnerShellSystemPrototype.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(parent, /useOwnerShellSystemArtworkViewer/);
  assert.doesNotMatch(parent, /setViewerPlacementId|setViewerOriginRectangle|new Image\(\)/);
  assert.match(controller, /placementRefs = useRef\(new Map\(\)\)/);
  assert.match(controller, /replaceSelection\(\[nextId\], nextId\)/);
  assert.match(controller, /if \(placementId && index < 0\) close\(\)/);
});
