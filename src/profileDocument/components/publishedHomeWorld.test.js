import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { clampHomeWorldCamera, getZoomedHomeWorldCamera, HOME_WORLD_ZOOM_LEVELS } from '../../public/homeWorldCamera.js';
import { panSpatialCamera } from '../../public/spatialWorldCamera.js';
import {
  clampVisitorWindowRect,
  createPublishedVisitorLayout,
  createVisitorWindowState,
  publishedItemPixelRect,
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

test('launcher opening, focus, minimize, drag/resize geometry, and close stay ephemeral', () => {
  const rect = { left: 40, top: 80, width: 700, height: 480 };
  let state = createVisitorWindowState();
  state = visitorWindowTransition(state, { type: 'open', id: 'space:west', rect });
  state = visitorWindowTransition(state, { type: 'open', id: 'space:east', rect: { ...rect, left: 90 } });
  state = visitorWindowTransition(state, { type: 'focus', id: 'space:west' });
  assert.deepEqual(state.zOrder, ['space:east', 'space:west']);
  state = visitorWindowTransition(state, { type: 'geometry', id: 'space:west', rect: clampVisitorWindowRect({ ...rect, left: 150, width: 820 }, { width: 1280, height: 720 }) });
  state = visitorWindowTransition(state, { type: 'minimize', id: 'space:west' });
  assert.equal(state.windows['space:west'].minimized, true);
  assert.equal(state.windows['space:west'].rect.left, 150);
  assert.equal(documentFixture.spaces[0].windowGeometry.column, -3, 'runtime geometry never writes authored geometry');
  state = visitorWindowTransition(state, { type: 'close', id: 'space:west' });
  assert.equal(state.windows['space:west'], undefined);
});

test('published component exposes launcher/artwork activation and structural mouse/touch pointer handling', () => {
  const source = readFileSync(resolve(here, 'PublishedHomeWorld.jsx'), 'utf8');
  const cameraSource = readFileSync(resolve(here, '../../public/HomeWorldSurface.jsx'), 'utf8');
  assert.match(source, /onClick=\{\(\) => openSpace\(item\.space\)\}/);
  assert.match(source, /setOpenArtworkId\(object\.id\)/);
  assert.match(source, /event\.pointerType === 'mouse'/);
  assert.match(source, /setPointerCapture/);
  assert.match(cameraSource, /event\.pointerType !== 'mouse'/);
  assert.match(cameraSource, /touchPointersRef/);
  assert.match(cameraSource, /ArrowLeft/);
  assert.match(cameraSource, /onPointerCancel/);
  assert.match(cameraSource, /onWheel=\{handleWheel\}/);
});

test('published renderer import graph cannot reach owner stores, persistence, or ModuleGridShell', () => {
  const visited = new Set();
  const forbidden = /useLibraryStore|useSignalStore|useProfileDocumentStore|profileDocumentStorage|runtimeWindowState|ModuleGridShell|localStorage|snapshotStorage/i;
  function visit(filename) {
    const full = resolve(filename); if (visited.has(full)) return; visited.add(full);
    const source = readFileSync(full, 'utf8');
    assert.doesNotMatch(source, forbidden, `${full} crossed the published visitor boundary`);
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
