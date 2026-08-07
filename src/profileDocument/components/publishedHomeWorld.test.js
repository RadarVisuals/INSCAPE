import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { clampVerticalHomeWorldCamera } from '../../public/homeWorldCamera.js';
import { exceedsSpatialPointerDragThreshold, finalizeSpatialPointer, shouldActivateSpatialPointer } from '../../public/spatialWorldCamera.js';
import { createPublishedVisitorLayout } from '../domain/publishedVisitorWorld.js';

const here = dirname(fileURLToPath(import.meta.url));
const documentFixture = Object.freeze({
  version: 4,
  profile: { address: '0x1111111111111111111111111111111111111111', cachedIdentity: { name: 'Visitor fixture', avatarUrl: null } },
  spaces: [
    { id: 'space:west', order: 0, label: 'West archive', kind: 'folder', placement: { column: -7, row: 4 }, appearance: { mode: 'icon_label', iconKey: 'folder', showLabel: true, columnSpan: 4, rowSpan: 2 }, startOpen: false, windowGeometry: { column: -3, row: 2, columnSpan: 13, rowSpan: 9 }, assets: [] },
    { id: 'space:east', order: 1, label: 'East archive', kind: 'favorites', placement: { column: 12, row: -5 }, appearance: { mode: 'label', iconKey: 'favorites', showLabel: true, columnSpan: 3, rowSpan: 1 }, startOpen: true, windowGeometry: null, assets: [] }
  ],
  canvasObjects: [{ id: 'art:one', order: 0, placement: { column: -2, row: -3 }, span: { columns: 5, rows: 4 }, presentation: { frame: 'thin', mat: 'dark', background: 'dark', fit: 'contain' }, asset: { stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01', cachedName: 'A work' } }]
});

test('published desktop layout keeps categories in navigation and projects artwork without mutating its document', () => {
  const source = structuredClone(documentFixture);
  const layout = createPublishedVisitorLayout(source, 1280, 720);
  assert.deepEqual(layout.spaces, []);
  assert.deepEqual(layout.objects[0].position, { column: -2, row: -3 });
  assert.deepEqual(source, documentFixture, 'visitor projection cannot mutate the authored document');
});

test('published camera stays on the fixed horizontal axis and fixed scale', () => {
  const layout = createPublishedVisitorLayout(documentFixture, 1280, 720);
  assert.deepEqual(clampVerticalHomeWorldCamera({ x: -9999, y: 800, zoom: 1.25 }, layout.world, layout.camera.x), { x: 1280, y: 800, zoom: 1 });
  assert.deepEqual(clampVerticalHomeWorldCamera({ x: 9999, y: 999999, zoom: 0.5 }, layout.world, layout.camera.x), { x: 1280, y: 1440, zoom: 1 });
});

test('published component exposes gallery activation and structural mouse/touch pointer handling', () => {
  const source = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const cameraSource = readFileSync(resolve(here, '../../public/HomeWorldSurface.jsx'), 'utf8');
  assert.doesNotMatch(source, /toggleSpace|PublishedProfileDocumentSpaceWindow|data-launcher-id/);
  assert.match(source, /<GalleryWorld/);
  assert.match(source, /onOpenArtwork=\{openArtworkPreview\}/);
  assert.match(source, /artworkTriggerRef\.current = trigger\?\.isConnected \? trigger : null/);
  assert.match(source, /event\.pointerType === 'mouse'/);
  assert.match(cameraSource, /event\.pointerType !== 'mouse'/);
  assert.match(cameraSource, /pointerRef/);
  assert.doesNotMatch(cameraSource, /ArrowLeft|touchPointersRef|data-pannable|spatial-index/);
  assert.match(cameraSource, /onPointerCancel/);
  assert.match(cameraSource, /addEventListener\('wheel', handleWheel, \{ passive: false \}\)/);
  assert.match(cameraSource, /removeEventListener\('wheel', handleWheel\)/);
  assert.doesNotMatch(cameraSource, /onWheel=\{handleWheel\}/);
  assert.match(cameraSource, /event\.target\.closest\?\.\('button'\)/);
});

test('published artwork fails closed for editing while the verified owner keeps the real edit callback', () => {
  const artworkSource = readFileSync(resolve(here, '../../public/FramedArtwork.jsx'), 'utf8');
  const worldSource = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const previewSource = readFileSync(resolve(here, 'ProfileDocumentSurface.jsx'), 'utf8');
  const ownerSource = readFileSync(resolve(here, '../../public/ModuleGridShell.jsx'), 'utf8');
  const gallerySource = readFileSync(resolve(here, '../../public/GalleryWorld.jsx'), 'utf8');
  assert.match(artworkSource, /editable = false/);
  assert.match(artworkSource, /editable && \(\(compact && !arranging\)/);
  assert.doesNotMatch(worldSource + previewSource, /onEdit=\{\(\) => \{\}\}/);
  assert.doesNotMatch(worldSource + previewSource, /editable=\{/);
  assert.match(ownerSource, /ownerAuthoringEnabled=\{ownerAuthoringEnabled\}/);
  assert.match(gallerySource, /ownerAuthoringEnabled && !object\.locked/);
  assert.doesNotMatch(worldSource, /ownerAuthoringEnabled/);
});

test('navigation-only public categories do not create Home launchers', () => {
  const navigationOnly = { ...documentFixture.spaces[0], id: 'space:navigation-only', order: 2, homeShortcut: false };
  const layout = createPublishedVisitorLayout({ ...documentFixture, spaces: [...documentFixture.spaces, navigationOnly] }, 1280, 720);
  assert.equal(layout.spaces.some((item) => item.id === navigationOnly.id), false);
});

test('compact published content clears masthead and identity through 719px, with 720px spatial mode', () => {
  const css = readFileSync(resolve(here, '../profileDocument.css'), 'utf8');
  for (const width of [320, 390, 719]) assert.equal(createPublishedVisitorLayout(documentFixture, width, 800).geometry.narrow, true);
  assert.equal(createPublishedVisitorLayout(documentFixture, 720, 800).geometry.narrow, false);
  assert.match(css, /@media\(max-width:719px\)/);
  assert.match(css, /top:calc\(124px \+ env\(safe-area-inset-top,0px\)\)/);
  assert.match(css, /bottom:calc\(12px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css, /overflow-y:auto/);
  assert.match(css, /touch-action:pan-y/);
  assert.match(css, /published-home-world__spatial>\.module-button\{touch-action:pan-y\}/);
});

test('published Keeper movement callback is wired without passing the owner handoff object into the published graph', () => {
  const appSource = readFileSync(resolve(here, '../../App.jsx'), 'utf8');
  const boundarySource = readFileSync(resolve(here, 'PublishedProfileBoundary.jsx'), 'utf8');
  const previewSource = readFileSync(resolve(here, 'PublishedProfileDocumentPreview.jsx'), 'utf8');
  const worldSource = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  assert.match(appSource, /<PublishedProfileBoundary[^>]*onMoveKeeper=\{residentHandoff\.moveToScreenPosition\}/);
  assert.match(appSource, /onMoveKeeperHorizontally=\{residentHandoff\.moveHorizontallyToScreenPosition\}/);
  assert.match(boundarySource, /<PublishedProfileDocumentPreview document=\{visibleDocument\}[\s\S]*onMoveKeeper=\{onMoveKeeper\}/);
  assert.match(boundarySource, /onMoveKeeperHorizontally=\{onMoveKeeperHorizontally\}/);
  assert.match(previewSource, /<PublishedHomeWorld document=\{document\} onExit=\{onExit\} onMoveKeeper=\{onMoveKeeper\}/);
  assert.match(previewSource, /onMoveKeeperHorizontally=\{onMoveKeeperHorizontally\}/);
  assert.match(worldSource, /<HomeWorldSurface[^>]*onMoveKeeper=\{onMoveKeeper\}/);
  assert.match(worldSource, /<GalleryWorld[\s\S]*onMoveKeeperHorizontally=\{onMoveKeeperHorizontally\}/);
  assert.doesNotMatch(boundarySource + previewSource + worldSource, /residentHandoff/);
});

test('empty-world click or tap activates Keeper movement while drag, explicit pan, and cancellation do not', () => {
  const origin = { x: 100, y: 100 };
  assert.equal(exceedsSpatialPointerDragThreshold(origin, { x: 103, y: 104 }), false, 'the existing 5px threshold remains a click');
  assert.equal(exceedsSpatialPointerDragThreshold(origin, { x: 106, y: 100 }), true, 'movement beyond the threshold is a drag');
  assert.equal(shouldActivateSpatialPointer({ moved: false, panning: false }), true);
  assert.equal(shouldActivateSpatialPointer({ moved: true, panning: false }), false);
  assert.equal(shouldActivateSpatialPointer({ moved: false, panning: true }), false);
  assert.equal(shouldActivateSpatialPointer({ moved: false, panning: false, multiTouch: true }), false);
  assert.equal(shouldActivateSpatialPointer({ moved: false, panning: false }, true), false);
});

test('desktop pointer completion clears drag state without narrow gesture bookkeeping', () => {
  const click = { pointerId: 7, moved: false, panning: false };

  assert.doesNotThrow(() => finalizeSpatialPointer({
    pointerId: 7,
    pointerType: undefined,
    drag: click,
    sharedGesture: false
  }));
  assert.deepEqual(finalizeSpatialPointer({
    pointerId: 7,
    pointerType: undefined,
    drag: click,
    sharedGesture: false
  }), { drag: null, shouldActivate: true });
  assert.deepEqual(finalizeSpatialPointer({
    pointerId: 7,
    pointerType: 'mouse',
    drag: click,
    sharedGesture: null,
    cancelled: true
  }), { drag: null, shouldActivate: false });
});

test('late lost pointer capture cannot reactivate a completed desktop click or retain a drag', () => {
  const click = { pointerId: 11, moved: false, panning: false };
  const released = finalizeSpatialPointer({ pointerId: 11, pointerType: 'mouse', drag: click });
  const lostCapture = finalizeSpatialPointer({ pointerId: 11, pointerType: undefined, drag: released.drag, cancelled: true });

  assert.equal(released.shouldActivate, true, 'pointerup activates the Keeper exactly once');
  assert.deepEqual(lostCapture, { drag: null, shouldActivate: false });

  const completedDrag = finalizeSpatialPointer({
    pointerId: 12,
    pointerType: 'mouse',
    drag: { pointerId: 12, moved: true, panning: true }
  });
  assert.deepEqual(completedDrag, { drag: null, shouldActivate: false });
});

test('narrow pointer completion preserves multi-touch cancellation and gesture cleanup', () => {
  const sharedGesture = { activePointers: new Set([21]), multiTouch: true };
  const result = finalizeSpatialPointer({
    pointerId: 21,
    pointerType: 'touch',
    drag: { pointerId: 21, moved: false, panning: false },
    sharedGesture
  });

  assert.deepEqual(result, { drag: null, shouldActivate: false });
  assert.equal(sharedGesture.activePointers.size, 0);
  assert.equal(sharedGesture.multiTouch, false);
});

test('390px narrow empty-space taps activate but scrolling, cancellation, multi-touch, and child targets do not', () => {
  assert.equal(createPublishedVisitorLayout(documentFixture, 390, 800).geometry.narrow, true);
  const origin = { x: 180, y: 420 };
  const stationaryTap = { originPointer: origin, moved: exceedsSpatialPointerDragThreshold(origin, { x: 183, y: 424 }), panning: false, multiTouch: false };
  const scrollingSwipe = { originPointer: origin, moved: exceedsSpatialPointerDragThreshold(origin, { x: 181, y: 448 }), panning: false, multiTouch: false };
  assert.equal(shouldActivateSpatialPointer(stationaryTap), true);
  assert.equal(shouldActivateSpatialPointer(scrollingSwipe), false);
  assert.equal(shouldActivateSpatialPointer(stationaryTap, true), false);
  assert.equal(shouldActivateSpatialPointer({ ...stationaryTap, multiTouch: true }), false);

  const source = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const recognizer = source.slice(source.indexOf('const beginCompactTap'), source.indexOf('const openArtwork ='));
  assert.match(recognizer, /event\.target !== event\.currentTarget/);
  assert.match(recognizer, /activePointers\.size > 1/);
  assert.match(recognizer, /tracking\.multiTouch = true/);
  assert.match(recognizer, /exceedsSpatialPointerDragThreshold/);
  assert.match(recognizer, /shouldActivateSpatialPointer\(candidate, cancelled \|\| tracking\.multiTouch\)/);
  assert.doesNotMatch(recognizer, /preventDefault|setPointerCapture/);
});

test('narrow published scrolling is explicitly bounded and leaves browser touch scrolling native', () => {
  const css = readFileSync(resolve(here, '../profileDocument.css'), 'utf8');
  const cameraSource = readFileSync(resolve(here, '../../public/HomeWorldSurface.jsx'), 'utf8');
  assert.match(css, /published-home-world__spatial\{position:fixed/);
  assert.match(css, /height:calc\(100dvh - 136px - env\(safe-area-inset-top,0px\) - env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(css, /overflow-y:auto/);
  assert.match(css, /touch-action:pan-y/);
  assert.match(css, /-webkit-overflow-scrolling:touch/);
  assert.match(cameraSource, /if \(!surface \|\| narrow\) return undefined/);
  assert.match(cameraSource, /event\.isPrimary === false/);
  assert.match(cameraSource, /if \(narrow\) return;\s*event\.preventDefault\(\)/);
  assert.match(cameraSource, /sharedGesture: narrow \? narrowGestureRef\?\.current : null/);
  assert.match(cameraSource, /finalizeSpatialPointer\(\{[\s\S]*sharedGesture:[\s\S]*cancelled[\s\S]*\}\)/);
});

test('active published boundary isolates legacy styling while both visitor renderers stay outside owner authority', () => {
  const visited = new Set();
  const forbiddenSource = /useLibraryStore|useSignalStore|useProfileDocumentStore|\buseStore\b|profileDocumentStorage|runtimeWindowState|ModuleGridShell|localStorage|sessionStorage|indexedDB|snapshotStorage/i;
  const forbiddenPath = /[\\/](?:store|signals[\\/]state|library[\\/]state|profileDocument[\\/]storage[\\/]profileDocumentStorage)(?:[\\/]|\.)/i;
  function visit(filename) {
    const full = resolve(filename); if (visited.has(full)) return; visited.add(full);
    const source = readFileSync(full, 'utf8');
    assert.doesNotMatch(full, forbiddenPath, `${full} crossed into a private store or persistence path`);
    assert.doesNotMatch(source, forbiddenSource, `${full} crossed the published visitor boundary`);
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"](\.[^'\"]+)['\"]/g)) {
      const target = resolve(dirname(full), match[1]);
      const candidates = /\.[cm]?[jt]sx?$/.test(target) ? [target] : [`${target}.js`, `${target}.jsx`, resolve(target, 'index.js')];
      const next = candidates.find((candidate) => { try { readFileSync(candidate); return true; } catch { return false; } });
      if (next) visit(next);
    }
  }
  visit(resolve(here, 'PublishedProfileBoundary.jsx'));
  const boundarySource = readFileSync(resolve(here, 'PublishedProfileBoundary.jsx'), 'utf8');
  const selectorSource = readFileSync(resolve(here, 'PublishedProfileDocumentPreview.jsx'), 'utf8');
  assert.doesNotMatch(boundarySource, /moduleGrid\.css|collection\.css|profileDocument\.css|canvasObjects\.css/);
  assert.match(selectorSource, /lazy\(\(\) => import\('\.\/PublishedLegacyStyles\.jsx'\)\)/);
  assert.equal([...visited].some((file) => file.endsWith('PublishedLegacyStyles.jsx')), false);
  assert.ok([...visited].some((file) => file.endsWith('PublishedHomeWorld.jsx')));
  assert.ok([...visited].some((file) => file.endsWith('HomeWorldSurface.jsx')));
});

test('published visitor level navigation uses the shared controller contract', () => {
  const worldSource = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  assert.match(worldSource, /<UpperWorldSurface/);
  assert.match(worldSource, /const spatialLevel = upperOpen[\s\S]*SPATIAL_WORLD_LEVEL\.UPPER[\s\S]*SPATIAL_WORLD_LEVEL\.GALLERY[\s\S]*SPATIAL_WORLD_LEVEL\.HOME/);
  assert.match(worldSource, /<SpatialLevelNavigation[\s\S]*level=\{spatialLevel\}/);
  assert.match(worldSource, /disabled=\{spatialTransitioning\}/);
  assert.match(worldSource, /onDown=\{upperOpen \? exitUpper : enterGallery\}/);
  assert.match(worldSource, /onUp=\{galleryOpen \? exitGallery : enterUpper\}/);
  assert.doesNotMatch(worldSource, /currentLevel=|transitioning=|onMoveDown=|onMoveUp=/);
});

test('published profile cards resolve public LSP3 metadata without invented biography fallback', () => {
  const worldSource = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const cardSource = readFileSync(resolve(here, '../../public/ProfileIdentityCard.jsx'), 'utf8');
  assert.match(worldSource, /useProfileIdentity\(document\.profile\.address\)/);
  assert.match(worldSource, /bio: liveProfile\.metadataResolved \? liveProfile\.bio : null/);
  assert.match(worldSource, /tags: liveProfile\.metadataResolved \? liveProfile\.tags : \[\]/);
  assert.match(worldSource, /links: liveProfile\.metadataResolved \? liveProfile\.links : \[\]/);
  assert.match(cardSource, /profile\?\.bio && <p>\{profile\.bio\}<\/p>/);
  assert.doesNotMatch(cardSource, /A world assembled beneath the surface/);
});
