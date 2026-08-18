import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectLatticeProductionArtwork } from '../../lattice/rendering/latticeProductionProjection.js';

const preview = readFileSync(new URL('./ProfileDocumentV9Preview.jsx', import.meta.url), 'utf8');
const visitor = readFileSync(new URL('./ProfileDocumentV9Visitor.jsx', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('./GridProductionRenderer.jsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('./PublishedProfileDocumentPreview.jsx', import.meta.url), 'utf8');

const placement = (overrides = {}) => ({
  id: 'p', column: 2, row: 3, columnSpan: 8, rowSpan: 6, layer: 4, navigationOrder: 0,
  crop: null, frameId: 'NONE', mat: { enabled: false, color: '#000000', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#ffffff' }, transparencyMode: 'AUTO', visibility: 'PUBLIC',
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, ...overrides,
});
const field = { left: 0, top: 0, cellSize: 10 };

test('production routing remains v8 while the isolated review seam validates exact v9 before lazy rendering', () => {
  assert.match(production, /VisitorLatticeWorld/);
  assert.match(production, /selectPublishedProfileRuntime/);
  assert.doesNotMatch(production, /ProfileDocumentV9Visitor|VisitorGridWorld/);
  assert.match(preview, /assertValidProfileDocumentV9\(input\)/);
  assert.match(preview, /VisitorGridWorld/);
});

test('v9 Grid renderer reuses canonical contain, crop remap, swapped dimensions, and render-rectangle transforms', () => {
  const native = projectLatticeProductionArtwork(placement(), field, { width: 1600, height: 900 });
  assert.equal(native.imageRectangle.width, 80);
  assert.equal(native.imageRectangle.height, 45);
  assert.equal(native.imageRectangle.top, 37.5);
  const transformed = projectLatticeProductionArtwork(placement({ crop: { x: 0.2, y: 0.8, zoom: 2 },
    transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }), field, { width: 900, height: 1600 });
  assert.equal(transformed.imageTransform, 'scale(-1, 1) rotate(90deg)');
  assert.equal(transformed.imageRenderRectangle.width, transformed.imageRectangle.height);
  assert.equal(transformed.imageRenderRectangle.height, transformed.imageRectangle.width);
  assert.match(renderer, /projectLatticeProductionArtwork/);
  assert.match(renderer, /imageRenderRectangle/);
});

test('v9 Visitor retains media state, retry/recovery, focus, identity, input ownership, and ordered Grid navigation', () => {
  assert.match(renderer, /GRID_PRODUCTION_EAGER_MEDIA_ATTEMPTS/);
  assert.match(renderer, /onError/);
  assert.match(renderer, /onLoad/);
  assert.match(renderer, /data-media-state/);
  assert.match(visitor, /activeIndex === 0 \? 'eager' : 'lazy'/);
  assert.match(visitor, /LatticeFocusViewer/);
  assert.match(renderer, /data-viewer-source-hidden/);
  assert.match(visitor, /LatticeProductionIdentityDossier/);
  assert.match(visitor, /identitySourceHidden/);
  assert.match(visitor, /returnFocus/);
  assert.match(visitor, /ArrowRight/);
  assert.match(visitor, /Previous Grid/);
  assert.match(visitor, /Next Grid/);
  assert.doesNotMatch(visitor, /Keeper|tables|coordinate|useLibraryStore|ownerAuthoring|wallet/iu);
});
