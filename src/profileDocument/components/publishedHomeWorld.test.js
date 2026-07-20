import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { clampHomeWorldCamera, getZoomedHomeWorldCamera, HOME_WORLD_ZOOM_LEVELS } from '../../public/homeWorldCamera.js';
import { exceedsSpatialPointerDragThreshold, panSpatialCamera, shouldActivateSpatialPointer } from '../../public/spatialWorldCamera.js';
import {
  clampVisitorWindowRect,
  createPublishedVisitorLayout,
  createVisitorWindowState,
  initialVisitorWindowRect,
  publishedItemPixelRect,
  publishedNavigatorLocations,
  snapVisitorWindowRect,
  visitorWindowTransition
} from '../domain/publishedVisitorWorld.js';

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

test('published desktop layout preserves authored signed-grid launcher and artwork placements without mutation', () => {
  const source = structuredClone(documentFixture);
  const layout = createPublishedVisitorLayout(source, 1280, 720);
  assert.deepEqual(layout.spaces.map((item) => item.position), [{ column: -7, row: 4 }, { column: 12, row: -5 }]);
  assert.deepEqual(layout.objects[0].position, { column: -2, row: -3 });
  assert.equal(publishedItemPixelRect(layout.spaces[0], layout).left, -278);
  assert.deepEqual(publishedNavigatorLocations(layout)[0], { id: 'space:west', label: 'West archive', kind: 'launcher', x: 1240, y: 1000 });
  assert.deepEqual(source, documentFixture, 'visitor projection cannot mutate the authored document');
});

test('camera mouse-pan math and anchored zoom remain clamped to the published world', () => {
  const layout = createPublishedVisitorLayout(documentFixture, 1280, 720);
  const panned = panSpatialCamera(layout.camera, { x: 300, y: 300 }, { x: 180, y: 220 });
  assert.deepEqual(clampHomeWorldCamera({ ...panned, zoom: 1 }, layout.world), { x: 1400, y: 800, zoom: 1 });
  const maximum = HOME_WORLD_ZOOM_LEVELS.at(-1);
  assert.equal(getZoomedHomeWorldCamera(layout.camera, 99, { x: 200, y: 100 }, layout.world).zoom, maximum);
  assert.equal(clampHomeWorldCamera({ x: -9999, y: 999999, zoom: -20 }, layout.world).x, 0);
});

test('launcher toggles open, close, and restore while minimize remains an explicit ephemeral state', () => {
  const rect = { left: 40, top: 80, width: 700, height: 480 };
  let state = createVisitorWindowState();
  state = visitorWindowTransition(state, { type: 'toggle', id: 'space:west', rect });
  assert.deepEqual(state.windows['space:west'], { rect, minimized: false });
  state = visitorWindowTransition(state, { type: 'toggle', id: 'space:west', rect });
  assert.equal(state.windows['space:west'], undefined, 'an open launcher closes its runtime window');
  state = visitorWindowTransition(state, { type: 'toggle', id: 'space:west', rect });
  state = visitorWindowTransition(state, { type: 'open', id: 'space:east', rect: { ...rect, left: 90 } });
  state = visitorWindowTransition(state, { type: 'focus', id: 'space:west' });
  assert.deepEqual(state.zOrder, ['space:east', 'space:west']);
  state = visitorWindowTransition(state, { type: 'geometry', id: 'space:west', rect: clampVisitorWindowRect({ ...rect, left: 150, width: 820 }, { width: 1280, height: 720 }) });
  state = visitorWindowTransition(state, { type: 'minimize', id: 'space:west' });
  assert.equal(state.windows['space:west'].minimized, true);
  assert.equal(state.windows['space:west'].rect.left, 150);
  state = visitorWindowTransition(state, { type: 'minimize', id: 'space:west' });
  assert.equal(state.windows['space:west'].minimized, true, 'minimize cannot accidentally restore');
  state = visitorWindowTransition(state, { type: 'toggle', id: 'space:west', rect });
  assert.equal(state.windows['space:west'].minimized, false, 'a minimized launcher restores its prior geometry');
  assert.equal(state.windows['space:west'].rect.left, 150);
  assert.equal(state.zOrder.at(-1), 'space:west', 'restore also focuses the runtime window');
  assert.equal(documentFixture.spaces[0].windowGeometry.column, -3, 'runtime geometry never writes authored geometry');
  state = visitorWindowTransition(state, { type: 'close', id: 'space:west' });
  assert.equal(state.windows['space:west'], undefined);
});

test('desktop visitor drag and resize snap every viewport dimension to 40px before clamping', () => {
  assert.deepEqual(
    snapVisitorWindowRect({ left: 113, top: 131, width: 707, height: 493 }, { width: 1280, height: 720 }),
    { left: 120, top: 120, width: 720, height: 480 }
  );
  assert.deepEqual(
    snapVisitorWindowRect({ left: 1261, top: -20, width: 709, height: 501 }, { width: 1280, height: 720 }),
    { left: 536, top: 64, width: 720, height: 520 },
    'the snapped rectangle is finally clamped with its controls reachable'
  );
  const cameraAndZoomIndependent = snapVisitorWindowRect({ left: 203, top: 197, width: 641, height: 399 }, { width: 1280, height: 720 });
  assert.deepEqual(cameraAndZoomIndependent, { left: 200, top: 200, width: 640, height: 400 });
});

test('authored window geometry is projected through the ephemeral visitor camera zoom', () => {
  const layout = createPublishedVisitorLayout(documentFixture, 1280, 720);
  const camera = { x: 1140, y: 630, zoom: 1.25 };
  const rect = initialVisitorWindowRect(documentFixture.spaces[0], layout, camera);
  assert.deepEqual(rect, { left: 225, top: 246, width: 650, height: 450 });
  assert.deepEqual(documentFixture.spaces[0].windowGeometry, { column: -3, row: 2, columnSpan: 13, rowSpan: 9 });
});

test('published component exposes launcher/artwork activation and structural mouse/touch pointer handling', () => {
  const source = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const cameraSource = readFileSync(resolve(here, '../../public/HomeWorldSurface.jsx'), 'utf8');
  assert.match(source, /onClick=\{\(\) => toggleSpace\(item\.space\)\}/);
  assert.match(source, /setOpenArtworkId\(object\.id\)/);
  assert.match(source, /event\.pointerType === 'mouse'/);
  assert.match(source, /setPointerCapture/);
  assert.match(cameraSource, /event\.pointerType !== 'mouse'/);
  assert.match(cameraSource, /touchPointersRef/);
  assert.match(cameraSource, /ArrowLeft/);
  assert.match(cameraSource, /onPointerCancel/);
  assert.match(cameraSource, /addEventListener\('wheel', handleWheel, \{ passive: false \}\)/);
  assert.match(cameraSource, /removeEventListener\('wheel', handleWheel\)/);
  assert.doesNotMatch(cameraSource, /onWheel=\{handleWheel\}/);
  assert.match(cameraSource, /event\.target\.closest\?\.\('button,\.spatial-index'\)/);
});

test('published controls are distinct, keyboard labelled, and cannot initiate window dragging', () => {
  const worldSource = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const windowSource = readFileSync(resolve(here, 'PublishedProfileDocumentSpaceWindow.jsx'), 'utf8');
  assert.match(windowSource, /published-space-window__controls/);
  assert.match(windowSource, /minimized \? 'Restore' : 'Minimize'/);
  assert.match(windowSource, /aria-label=\{`Close \$\{space\.label\}`\}/);
  assert.equal(windowSource.match(/onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/g)?.length, 2);
  assert.match(worldSource, /type: entry\.minimized \? 'restore' : 'minimize'/);
  assert.match(worldSource, /!layout\.geometry\.narrow && !entry\.minimized/);
  assert.match(worldSource, /if \(layout\.geometry\.narrow/);
});

test('published artwork fails closed for editing while the verified owner keeps the real edit callback', () => {
  const artworkSource = readFileSync(resolve(here, '../../public/FramedArtwork.jsx'), 'utf8');
  const worldSource = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const previewSource = readFileSync(resolve(here, 'ProfileDocumentSurface.jsx'), 'utf8');
  const ownerSource = readFileSync(resolve(here, '../../public/ModuleGridShell.jsx'), 'utf8');
  assert.match(artworkSource, /editable = false/);
  assert.match(artworkSource, /editable && \(\(compact && !arranging\)/);
  assert.doesNotMatch(worldSource + previewSource, /onEdit=\{\(\) => \{\}\}/);
  assert.doesNotMatch(worldSource + previewSource, /editable=\{/);
  assert.match(ownerSource, /editable=\{ownerAuthoringEnabled\}/);
  assert.match(ownerSource, /onEdit=\{\(\)=>openArtworkInspector\(object\.id\)\}/);
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
});

test('minimized published bars use the closed header height without dashed borders or enlarged mobile controls', () => {
  const css = readFileSync(resolve(here, '../profileDocument.css'), 'utf8');
  assert.match(css, /published-home-world__window\[data-minimized\]\{height:36px!important/);
  assert.match(css, /profile-document-space-window\{grid-template-rows:34px\}/);
  assert.doesNotMatch(css, /border-style:dashed/);
  assert.doesNotMatch(css, /44px/);
});

test('published Keeper movement callback is wired without passing the owner handoff object into the published graph', () => {
  const appSource = readFileSync(resolve(here, '../../App.jsx'), 'utf8');
  const boundarySource = readFileSync(resolve(here, 'PublishedProfileBoundary.jsx'), 'utf8');
  const previewSource = readFileSync(resolve(here, 'PublishedProfileDocumentPreview.jsx'), 'utf8');
  const worldSource = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  assert.match(appSource, /<PublishedProfileBoundary[^>]*onMoveKeeper=\{residentHandoff\.moveToScreenPosition\}/);
  assert.match(boundarySource, /<PublishedProfileDocumentPreview document=\{visibleDocument\} onMoveKeeper=\{onMoveKeeper\}/);
  assert.match(previewSource, /<PublishedHomeWorld document=\{document\} onMoveKeeper=\{onMoveKeeper\}/);
  assert.match(worldSource, /<HomeWorldSurface[^>]*onMoveKeeper=\{onMoveKeeper\}/);
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
  const recognizer = source.slice(source.indexOf('const beginCompactTap'), source.indexOf('const openArtwork'));
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
  assert.match(cameraSource, /if \(narrow && event\.isPrimary === false\) return/);
  assert.match(cameraSource, /if \(narrow\) return;\s*event\.preventDefault\(\)/);
  assert.match(cameraSource, /cancelled \|\| sharedMultiTouch/);
});

test('published renderer import graph cannot reach owner stores, persistence, or ModuleGridShell', () => {
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
  assert.ok([...visited].some((file) => file.endsWith('PublishedHomeWorld.jsx')));
  assert.ok([...visited].some((file) => file.endsWith('HomeWorldSurface.jsx')));
});
