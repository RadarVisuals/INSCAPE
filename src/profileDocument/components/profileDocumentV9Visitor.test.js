import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectLatticeProductionArtwork } from '../../lattice/rendering/latticeProductionProjection.js';

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const boundary = readFileSync(new URL('./PublishedProfileBoundary.jsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('./ProfileDocumentV9Preview.jsx', import.meta.url), 'utf8');
const visitor = readFileSync(new URL('./ProfileDocumentV9Visitor.jsx', import.meta.url), 'utf8');
const visitorCss = readFileSync(new URL('./visitorGridWorld.css', import.meta.url), 'utf8');
const production = readFileSync(new URL('./PublishedProfileDocumentPreview.jsx', import.meta.url), 'utf8');

const placement = (overrides = {}) => ({
  id: 'p', column: 2, row: 3, columnSpan: 8, rowSpan: 6, layer: 4, navigationOrder: 0,
  crop: null, frameId: 'NONE', mat: { enabled: false, color: '#000000', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#ffffff' }, transparencyMode: 'AUTO', visibility: 'PUBLIC',
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, ...overrides,
});
const field = { left: 0, top: 0, cellSize: 10 };

test('production routing now delegates only to the exact v9 Preview and Visitor boundary', () => {
  assert.match(production, /ProfileDocumentV9Preview/);
  assert.doesNotMatch(production, /VisitorLatticeWorld|PublishedHomeWorld|PublishedLegacyStyles|selectPublishedProfileRuntime/);
  assert.match(preview, /assertValidProfileDocumentV9\(input\)/);
  assert.match(preview, /lazy\(\(\) => import\('\.\/ProfileDocumentV9Visitor\.jsx'\)\)/);
});

test('published Visitor does not restore the obsolete global resident handoff', () => {
  assert.doesNotMatch(`${app}\n${boundary}\n${production}\n${preview}\n${visitor}`,
    /keeperVisible|residentHandoff|onVisitorReady|onMoveKeeper|onDockKeeper|onReleaseKeeper/iu);
});

test('artwork projection preserves contain, crop remap, swapped dimensions, and render-rectangle transforms', () => {
  const native = projectLatticeProductionArtwork(placement(), field, { width: 1600, height: 900 });
  assert.equal(native.imageRectangle.width, 80);
  assert.equal(native.imageRectangle.height, 45);
  assert.equal(native.imageRectangle.top, 37.5);
  const transformed = projectLatticeProductionArtwork(placement({ crop: { x: 0.2, y: 0.8, zoom: 2 },
    transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }), field, { width: 900, height: 1600 });
  assert.equal(transformed.imageTransform, 'scale(-1, 1) rotate(90deg)');
  assert.equal(transformed.imageRenderRectangle.width, transformed.imageRectangle.height);
  assert.equal(transformed.imageRenderRectangle.height, transformed.imageRectangle.width);
});

test('v9 Visitor retains identity and input ownership', () => {
  assert.doesNotMatch(visitor, /LatticeFocusViewer|inspectionVariant="rack"/);
  assert.doesNotMatch(visitor, /gridVisible=\{document\.appearance\.guideMode !== 'NONE'\}/);
  assert.match(visitor, /IdentityModule/);
  assert.match(visitor, /identityOnly/);
  assert.match(visitor, /identityControlRef=\{identityControlRef\}/);
  assert.match(visitor, /profileDockControlRef/);
  assert.match(visitor, /returnFocus/);
  assert.match(visitor, /!renderHeader && onReturn\) \|\| onExit/);
  assert.match(visitor, /onReturn && <button onClick=\{onReturn\} type="button">RETURN<\/button>/);
  assert.match(visitorCss, /@media \(max-width: 640px\)[\s\S]*\.visitor-grid-world__dock button \{[^}]*width: 64px;[^}]*min-width: 64px;[^}]*flex-basis: 64px;/);
  assert.match(visitorCss, /\.visitor-grid-world__dock > nav > button \{ width: 56px; min-width: 56px; flex-basis: 56px; \}/);
  assert.match(visitorCss, /\.visitor-grid-world__actions button \{ width: 60px; min-width: 60px; padding-inline: 4px; flex-basis: 60px; \}/);
  assert.doesNotMatch(visitor, /tables|coordinate|useLibraryStore|ownerAuthoring|wallet/iu);
});
