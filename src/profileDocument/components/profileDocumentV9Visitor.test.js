import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectLatticeProductionArtwork } from '../../lattice/rendering/latticeProductionProjection.js';

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const boundary = readFileSync(new URL('./PublishedProfileBoundary.jsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('./ProfileDocumentV9Preview.jsx', import.meta.url), 'utf8');
const visitor = readFileSync(new URL('./ProfileDocumentV9Visitor.jsx', import.meta.url), 'utf8');
const directoryCss = readFileSync(new URL('../../profileDiscovery/inscapeDirectorySystemWorkflow.css', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('./GridProductionRenderer.jsx', import.meta.url), 'utf8');
const rendererCss = readFileSync(new URL('../../lattice/rendering/latticeProductionTableRenderer.css', import.meta.url), 'utf8');
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
  assert.match(preview, /VisitorGridWorld/);
});

test('published Visitor has no Keeper handoff and Directory fully covers fallback content', () => {
  assert.doesNotMatch(`${app}\n${boundary}\n${production}\n${preview}\n${visitor}`,
    /Keeper|keeperVisible|residentHandoff|onVisitorReady|onMoveKeeper|onDockKeeper|onReleaseKeeper/iu);
  assert.match(directoryCss, /background-color: var\(--lattice-menu-panel/);
  assert.match(directoryCss, /background-image: linear-gradient/);
});

test('v9 Grid renderer reuses canonical contain, crop remap, swapped dimensions, and render-rectangle transforms', () => {
  const native = projectLatticeProductionArtwork(placement(), field, { width: 1600, height: 900 });
  assert.equal(native.imageRectangle.width, 80);
  assert.equal(native.imageRectangle.height, 45);
  assert.equal(native.imageRectangle.top, 37.5);
  const transformed = projectLatticeProductionArtwork(placement({ crop: { x: 0.2, y: 0.8, zoom: 2 },
    transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }), field, { width: 900, height: 1600 });
  assert.equal(transformed.imageTransform, 'scale(-1, 1) rotate(90deg)');
  assert.equal(transformed.imageRenderRectangle.width, transformed.imageRectangle.height + 1);
  assert.equal(transformed.imageRenderRectangle.height, transformed.imageRectangle.width);
  assert.match(renderer, /projectLatticeProductionPixelArtwork/);
  assert.match(renderer, /imageRenderRectangle/);
});

test('v9 Visitor retains media state, retry/recovery, focus, identity, input ownership, and ordered Grid navigation', () => {
  assert.match(renderer, /GRID_PRODUCTION_EAGER_MEDIA_ATTEMPTS/);
  assert.match(renderer, /onError/);
  assert.match(renderer, /onLoad/);
  assert.match(renderer, /data-media-state/);
  assert.match(renderer, /resolveProfileDocumentV9ContentReference/);
  assert.match(renderer, /referenceResolution\.key === referenceKey/);
  assert.match(renderer, /controller\.abort\(\)/);
  assert.match(renderer, /naturalHeight: height, naturalWidth: width/);
  assert.match(visitor, /activeIndex === 0 \? 'eager' : 'lazy'/);
  assert.match(visitor, /LatticeFocusViewer/);
  assert.equal((visitor.match(/gridVisible=\{false\}/g) || []).length, 2,
    'both the artwork viewer and identity dossier remain free of the published workspace Grid');
  assert.doesNotMatch(visitor, /gridVisible=\{document\.appearance\.guideMode !== 'NONE'\}/);
  assert.match(renderer, /data-viewer-source-hidden/);
  assert.match(visitor, /projectionBottomInset=\{VISITOR_GRID_NAVIGATION_SAFE_AREA\}/);
  assert.match(visitor, /VISITOR_GRID_NAVIGATION_SAFE_AREA = 42/);
  assert.match(visitor, /LatticeProductionIdentityDossier/);
  assert.match(visitor, /gridVisible=\{false\}/);
  assert.match(visitor, /identityOnly/);
  assert.match(visitor, /identityControlRef=\{identityControlRef\}/);
  assert.match(visitor, /profileDockControlRef/);
  assert.match(visitor, /returnFocus/);
  assert.match(visitor, /className="visitor-grid-world" data-lattice-menu-surface/);
  assert.match(visitor, /ArrowRight/);
  assert.match(visitor, /resolveVisitorGridDragDestination/);
  assert.match(visitor, /event\.code !== 'Space'/);
  assert.match(visitor, /onPointerDown=\{beginGridDrag\}/);
  assert.match(visitor, /suppressPlacementClickRef/);
  assert.match(visitor, /Previous Grid/);
  assert.match(visitor, /Next Grid/);
  assert.match(visitor, /onOpenDirectory \|\| onReturn \|\| onExit/);
  assert.match(visitor, /onReturn && <button onClick=\{onReturn\} type="button">RETURN<\/button>/);
  assert.match(visitorCss, /@media \(max-width: 640px\)[\s\S]*\.visitor-grid-world__dock button \{[^}]*width: 64px;[^}]*min-width: 64px;[^}]*flex-basis: 64px;/);
  assert.match(visitorCss, /\.visitor-grid-world__dock > nav > button \{ width: 56px; min-width: 56px; flex-basis: 56px; \}/);
  assert.match(visitorCss, /\.visitor-grid-world__actions button \{ width: 60px; min-width: 60px; padding-inline: 4px; flex-basis: 60px; \}/);
  assert.match(visitorCss, /\.visitor-grid-world__navigation span \{ min-width: 52px; \}/);
  assert.doesNotMatch(visitor, /Keeper|tables|coordinate|useLibraryStore|ownerAuthoring|wallet/iu);
});

test('v9 Grid renderer projects canonical guide mode, density, and color without an obsolete Visitor plane', () => {
  assert.match(renderer, /data-guide-mode=\{document\.appearance\.guideMode\}/);
  assert.match(renderer, /--lattice-production-guide-color/);
  assert.match(renderer, /LatticePixelGrid/);
  assert.match(renderer, /color=\{document\.appearance\.guideColor\}/);
  assert.match(renderer, /guideInterval=\{systemWorkflowSnapStep\(document\.appearance\.guideSize\)\}/);
  assert.match(rendererCss, /data-guide-mode="LINES"/);
  assert.match(rendererCss, /data-guide-mode="DOTS"/);
  assert.match(rendererCss, /background-image: none/);
  assert.doesNotMatch(rendererCss, /linear-gradient|radial-gradient/);
});
