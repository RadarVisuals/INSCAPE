import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG,
  focusViewerDestination,
  focusViewerLayout,
  focusedViewerRectangle,
  normalizeViewerRectangle,
  orderedFocusViewerEntries,
} from './latticeFocusViewer.js';

test('focused viewer preserves native presentation ratio and centers within safe viewport margins', () => {
  const origin = { left: 120, top: 80, width: 240, height: 360 };
  const focused = focusedViewerRectangle(origin, { width: 1440, height: 900 });
  assert.ok(Math.abs((focused.width / focused.height) - (origin.width / origin.height)) < Number.EPSILON);
  assert.equal(focused.left + (focused.width / 2), 720);
  assert.equal(focused.top + (focused.height / 2), 450);
  assert.ok(focused.left >= 48);
  assert.ok(focused.top >= 40);
});

test('focused viewer refits deterministically for compact and iframe viewports', () => {
  const origin = { left: 10, top: 20, width: 640, height: 320 };
  const compact = focusedViewerRectangle(origin, { width: 480, height: 320 });
  assert.equal(compact.left + compact.width / 2, 240);
  assert.equal(compact.top + compact.height / 2, 160);
  assert.ok(Math.abs(compact.width - 345.6) < 1e-9);
  assert.ok(Math.abs(compact.width / compact.height - 2) < 1e-12);
});

test('side inspection layout detaches dossiers from portrait artwork', () => {
  const origin = { left: 120, top: 80, width: 240, height: 360 };
  const viewport = { width: 1440, height: 900 };
  const closed = focusViewerLayout(origin, viewport, false);
  const open = focusViewerLayout(origin, viewport, true);
  assert.equal(closed.mode, 'side');
  assert.deepEqual(closed.artwork, open.artwork);
  assert.ok(open.leftDossier.left + open.leftDossier.width < open.inspectionFrame.left);
  assert.ok(open.rightDossier.left > open.inspectionFrame.left + open.inspectionFrame.width);
  assert.ok(open.inspectionFrame.left < open.artwork.left);
  assert.ok(open.inspectionFrame.left + open.inspectionFrame.width > open.artwork.left + open.artwork.width);
  assert.ok(open.leftDossier.height < open.artwork.height);
  assert.ok(open.rightDossier.height < open.artwork.height);
  assert.ok(open.leftDossier.left >= 0);
  assert.ok(open.rightDossier.left + open.rightDossier.width <= viewport.width);
});

test('square inspection artwork is reduced by fifteen percent without changing its ratio', () => {
  const origin = { left: 120, top: 80, width: 400, height: 400 };
  const viewport = { width: 1440, height: 900 };
  const reduced = focusViewerLayout(origin, viewport, true);
  const fullScale = focusViewerLayout(origin, viewport, true, {
    ...DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG,
    squareArtworkScale: 1,
  });
  assert.equal(reduced.mode, 'side');
  assert.ok(Math.abs(reduced.artwork.width - fullScale.artwork.width * 0.85) < 1);
  assert.equal(reduced.artwork.width, reduced.artwork.height);
});

test('side inspection leaves clear gaps between dossiers and portrait artwork', () => {
  const origin = { left: 13.25, top: 7.5, width: 333, height: 517 };
  const layout = focusViewerLayout(origin, { width: 1365, height: 767 }, true);
  const artworkRight = layout.artwork.left + layout.artwork.width;
  assert.equal(Number.isInteger(layout.artwork.left), true);
  assert.equal(Number.isInteger(artworkRight), true);
  assert.ok(layout.leftDossier.left + layout.leftDossier.width < layout.inspectionFrame.left);
  assert.ok(layout.rightDossier.left > layout.inspectionFrame.left + layout.inspectionFrame.width);
  assert.ok(Math.abs((layout.artwork.width / layout.artwork.height) - (origin.width / origin.height)) < 1e-12);
});

test('panoramic inspection layout preserves artwork width and places one wide dossier below', () => {
  const origin = { left: 20, top: 30, width: 1600, height: 450 };
  const layout = focusViewerLayout(origin, { width: 1440, height: 900 }, true);
  assert.equal(layout.mode, 'lower');
  assert.ok(layout.leftDossier.top > layout.inspectionFrame.top + layout.inspectionFrame.height);
  assert.deepEqual(layout.leftDossier, layout.rightDossier);
  assert.ok(layout.leftDossier.width >= layout.artwork.width);
  assert.ok(layout.leftDossier.width < layout.inspectionFrame.width);
  assert.equal(layout.leftDossier.left + layout.leftDossier.width / 2, 720);
  assert.ok(layout.artwork.width <= 1440 * DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.horizontalArtworkMaxWidthScale);
  assert.ok(Math.abs((layout.artwork.width / layout.artwork.height) - (origin.width / origin.height)) < 1e-12);
  assert.ok(layout.inspectionFrame.left >= 0);
  assert.ok(layout.inspectionFrame.left + layout.inspectionFrame.width <= 1440);
});

test('compact dossier layout preserves artwork ratio and stacks both panels below it', () => {
  const origin = { left: 10, top: 20, width: 640, height: 320 };
  const layout = focusViewerLayout(origin, { width: 480, height: 720 }, true);
  assert.equal(layout.mode, 'compact');
  assert.equal(layout.artwork.width / layout.artwork.height, 2);
  assert.ok(layout.leftDossier.top >= layout.artwork.top + layout.artwork.height);
  assert.ok(layout.rightDossier.top >= layout.leftDossier.top + layout.leftDossier.height);
  assert.ok(layout.contentHeight > 720);
});

test('dossier layout rejects ambiguous state and invalid configuration', () => {
  const origin = { left: 0, top: 0, width: 10, height: 10 };
  assert.throws(() => focusViewerLayout(origin, { width: 1000, height: 800 }, {}), /boolean/);
  assert.throws(() => focusViewerLayout(origin, { width: 1000, height: 800 }, false, { ...DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG, dossierWidth: 0 }), /positive/);
  assert.throws(() => focusViewerLayout(origin, { width: 1000, height: 800 }, false, { ...DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG, verticalArtworkScale: 1.1 }), /between/);
});

test('viewer rectangle validation rejects missing, non-finite and zero-sized geometry', () => {
  assert.throws(() => normalizeViewerRectangle(null), /required/);
  assert.throws(() => normalizeViewerRectangle({ left: 0, top: 0, width: 0, height: 1 }), /positive/);
  assert.throws(() => normalizeViewerRectangle({ left: NaN, top: 0, width: 1, height: 1 }), /finite/);
});

const entry = (id, navigationOrder, layer, stableAssetId = `asset:${id}`) => ({
  placement: { id, navigationOrder, layer, stableAssetId },
});

test('viewer sequence is controlled only by navigationOrder and never by visual layer', () => {
  const entries = [entry('third', 2, 0), entry('first', 0, 99), entry('second', 1, 4)];
  assert.deepEqual(orderedFocusViewerEntries(entries).map(({ placement }) => placement.id), ['first', 'second', 'third']);
  entries[0].placement.layer = 200;
  entries[1].placement.layer = -10;
  assert.deepEqual(orderedFocusViewerEntries(entries).map(({ placement }) => placement.id), ['first', 'second', 'third']);
});

test('viewer navigation wraps in both directions and keeps repeated assets as distinct placements', () => {
  const entries = [entry('first', 0, 0, 'same'), entry('second', 1, 1, 'same'), entry('third', 2, 2)];
  assert.equal(focusViewerDestination(entries, 'first', -1).placement.id, 'third');
  assert.equal(focusViewerDestination(entries, 'third', 1).placement.id, 'first');
  assert.equal(focusViewerDestination(entries, 'first', 1).placement.id, 'second');
});

test('viewer navigation rejects ambiguous directions and missing current placements', () => {
  const entries = [entry('first', 0, 0)];
  assert.throws(() => focusViewerDestination(entries, 'first', 0), /direction/);
  assert.throws(() => focusViewerDestination(entries, 'missing', 1), /not present/);
});
