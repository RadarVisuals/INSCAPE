import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { CANONICAL_LATTICE_ARTBOARD, FRAME_IDS, TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import {
  projectTableMediaPlacements,
  resolvedTransparencyMode,
} from './latticePlacement.js';
import { ARTWORK_MAT_PRESET_IDS, resolveArtworkMatPreset } from './latticeMat.js';

const ASSET_A = '42:0x1111111111111111111111111111111111111111:0x01';
const ASSET_B = '42:0x2222222222222222222222222222222222222222:0x02';
const media = {
  [ASSET_A]: { src: '/fixture-a.webp', width: 400, height: 200 },
  [ASSET_B]: { src: '/fixture-b.webp', width: 100, height: 200 },
};
const placement = (overrides) => ({
  id: 'placement-a', stableAssetId: ASSET_A,
  x: 0, y: 0, width: 0.5, height: 0.5,
  navigationOrder: 0, layer: 0,
  frameId: FRAME_IDS.NONE,
  transparencyMode: TRANSPARENCY_MODES.AUTO,
  ...overrides,
});
const table = (id, coordinate, placements) => ({ id, coordinate, placements });

test('each render projection contains only placements owned by its authored table', () => {
  const first = table('table-05', { x: 0, y: 0 }, [placement({})]);
  const second = table('table-06', { x: 1, y: 0 }, [placement({
    id: 'placement-b', stableAssetId: ASSET_B,
  })]);
  const input = { artboard: CANONICAL_LATTICE_ARTBOARD, assetsByStableId: media, viewport: { width: 1600, height: 900 } };
  assert.deepEqual(projectTableMediaPlacements({ ...input, table: first }).map(({ placement: item, tableId }) => [item.id, tableId]), [
    ['placement-a', 'table-05'],
  ]);
  assert.deepEqual(projectTableMediaPlacements({ ...input, table: second }).map(({ placement: item, tableId }) => [item.id, tableId]), [
    ['placement-b', 'table-06'],
  ]);
});

test('AUTO and PRESERVE_ALPHA resolve to the exact same deterministic presentation mode', () => {
  assert.equal(resolvedTransparencyMode(TRANSPARENCY_MODES.AUTO), TRANSPARENCY_MODES.PRESERVE_ALPHA);
  assert.equal(resolvedTransparencyMode(TRANSPARENCY_MODES.PRESERVE_ALPHA), TRANSPARENCY_MODES.PRESERVE_ALPHA);
  assert.equal(resolvedTransparencyMode(TRANSPARENCY_MODES.OPAQUE), TRANSPARENCY_MODES.OPAQUE);
});

test('cover framing offset projects the complete owned composition with the table', () => {
  const [entry] = projectTableMediaPlacements({
    artboard: CANONICAL_LATTICE_ARTBOARD,
    assetsByStableId: media,
    framing: { fit: 'cover', offset: { x: 0, y: 40 } },
    table: table('table-05', { x: 0, y: 0 }, [placement({})]),
    viewport: { width: 1280, height: 600 },
  });
  assert.deepEqual(entry.mediaRectangle, { left: 0, top: 0, width: 640, height: 320 });
  assert.equal(entry.tableId, 'table-05');
});

test('explicit crop uses its placement as a mask and cover-projects native media beneath it', () => {
  const [entry] = projectTableMediaPlacements({
    artboard: CANONICAL_LATTICE_ARTBOARD,
    assetsByStableId: media,
    table: table('table-05', { x: 0, y: 0 }, [placement({
      width: 0.25,
      height: 4 / 9,
      crop: { x: 0.5, y: 0.5, zoom: 1 },
    })]),
    viewport: { width: 1600, height: 900 },
  });
  assert.equal(entry.cropped, true);
  assert.deepEqual(entry.mediaRectangle, { left: 0, top: 0, width: 400, height: 400 });
  assert.deepEqual(entry.imageRectangle, { left: -200, top: 0, width: 800, height: 400 });
});

test('navigationOrder alone controls DOM projection order while layer remains independent', () => {
  const placements = [
    placement({ id: 'later', navigationOrder: 2, layer: 0 }),
    placement({ id: 'earlier', stableAssetId: ASSET_B, navigationOrder: 0, layer: 9 }),
  ];
  const input = {
    assetsByStableId: media,
    artboard: CANONICAL_LATTICE_ARTBOARD,
    table: table('table-05', { x: 0, y: 0 }, placements),
    viewport: { width: 1600, height: 900 },
  };
  const before = projectTableMediaPlacements(input);
  assert.deepEqual(before.map(({ placement: item }) => item.id), ['earlier', 'later']);
  assert.deepEqual(before.map(({ placement: item }) => item.layer), [9, 0]);
  placements[0].layer = 20;
  placements[1].layer = 1;
  const after = projectTableMediaPlacements(input);
  assert.deepEqual(after.map(({ placement: item }) => item.id), ['earlier', 'later']);
  assert.deepEqual(after.map(({ placement: item }) => item.layer), [1, 20]);
});

test('Arrange exposes navigation-ordered focus while native hit testing uses visual layer', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./latticePlacementRenderer.css', import.meta.url), 'utf8');
  assert.match(source, /tabIndex=\{arrangeEnabled \|\| viewerEnabled \? 0 : undefined\}/);
  assert.match(source, /zIndex: placement\.layer/);
  assert.match(source, /onPlacementPointerDown\?\.\(event, placement\)/);
  assert.match(source, /onContextMenu=\{\(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/);
  assert.match(styles, /\.lattice-placement-layer\.is-arranging \.lattice-placement\s*\{[^}]*pointer-events: auto/s);
});

test('one generic mat controls the complete selection and four-sided media opening', () => {
  const mat = { enabled: true, color: '#123456', inset: { top: 0.1, right: 0.2, bottom: 0.3, left: 0.4 } };
  const [entry] = projectTableMediaPlacements({
    artworkMatsByPlacementId: { 'placement-a': mat },
    assetsByStableId: media,
    artboard: CANONICAL_LATTICE_ARTBOARD,
    table: table('table-05', { x: 0, y: 0 }, [placement({ crop: { x: 0.5, y: 0.5, zoom: 1 } })]),
    viewport: { width: 1600, height: 900 },
  });
  assert.deepEqual(entry.backplateRectangle, { left: 0, top: 0, width: 800, height: 450 });
  assert.deepEqual(entry.selectionRectangle, entry.backplateRectangle);
  assert.deepEqual({ ...entry.mediaRectangle, height: Math.round(entry.mediaRectangle.height) }, { left: 320, top: 45, width: 320, height: 270 });
  assert.deepEqual(entry.mat, mat);
});

test('mat color and transparency mode remain independent projection values', () => {
  const mat = resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.DOSSIER);
  const [entry] = projectTableMediaPlacements({
    artworkMatsByPlacementId: { 'placement-a': mat },
    assetsByStableId: media,
    artboard: CANONICAL_LATTICE_ARTBOARD,
    table: table('table-05', { x: 0, y: 0 }, [placement({
      transparencyMode: TRANSPARENCY_MODES.OPAQUE,
    })]),
    viewport: { width: 1600, height: 900 },
  });
  assert.equal(entry.mat.color, '#d8d4ca');
  assert.equal(entry.transparencyMode, TRANSPARENCY_MODES.OPAQUE);
});

test('transparent artwork backing remains independent from mat and transparency values', () => {
  const [entry] = projectTableMediaPlacements({
    artworkBackingsByPlacementId: { 'placement-a': { enabled: true, color: '#102030' } },
    artworkMatsByPlacementId: { 'placement-a': resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.DOSSIER) },
    assetsByStableId: media,
    artboard: CANONICAL_LATTICE_ARTBOARD,
    table: table('table-05', { x: 0, y: 0 }, [placement({ transparencyMode: TRANSPARENCY_MODES.PRESERVE_ALPHA })]),
    viewport: { width: 1600, height: 900 },
  });
  assert.deepEqual(entry.backing, { enabled: true, color: '#102030' });
  assert.equal(entry.mat.color, '#d8d4ca');
  assert.equal(entry.transparencyMode, TRANSPARENCY_MODES.PRESERVE_ALPHA);
});

test('renderer uses one continuous borderless backplate beneath transparent media', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./latticePlacementRenderer.css', import.meta.url), 'utf8');
  assert.match(source, /className="lattice-placement-backplate"[\s\S]*'--lattice-mat-color': mat\.color/);
  assert.match(source, /selectedEntry\.selectionRectangle/);
  assert.match(styles, /\.lattice-placement-backplate\s*\{[^}]*inset: 0;[^}]*background-color: var\(--lattice-mat-color\);/s);
  assert.match(styles, /color-mix\(in srgb, var\(--lattice-mat-color\)/);
  const backplateRule = styles.match(/\.lattice-placement-backplate\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(backplateRule, /border|outline|stroke/);
  assert.match(styles, /\.lattice-placement-media\s*\{[^}]*background: transparent;[^}]*z-index: 1;/s);
  assert.doesNotMatch(source, /frameId ===|is-dossier|is-caption|frameBar/);
});

test('renderer-owned aperture overlaps the artwork perimeter without owning input or authoring state', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./latticePlacementRenderer.css', import.meta.url), 'utf8');
  const mediaIndex = source.indexOf('className={`lattice-placement-media');
  const apertureIndex = source.indexOf('className="lattice-placement-aperture"');
  assert.ok(mediaIndex >= 0 && apertureIndex > mediaIndex);
  assert.match(source, /className="lattice-placement-aperture"[\s\S]*percentage\(mediaRectangle\.left - selectionRectangle\.left, selectionRectangle\.width\)/);
  const apertureRuleStart = styles.lastIndexOf('.lattice-placement-aperture {');
  const apertureRule = styles.slice(apertureRuleStart, styles.indexOf('}', apertureRuleStart));
  assert.match(apertureRule, /z-index: 2/);
  assert.match(apertureRule, /pointer-events: none/);
  assert.match(apertureRule, /inset 0 0 0 1px rgba\(0, 0, 0/);
  assert.match(apertureRule, /inset 3px 3px 7px rgba\(0, 0, 0/);
  assert.match(apertureRule, /inset -1px -1px 2px rgba\(255, 255, 255/);
  assert.doesNotMatch(apertureRule, /(?:^|\s)(?:border|filter|opacity|transform)\s*:/);
  assert.doesNotMatch(source, /shadowControl|bevelControl|textureControl|depthControl/);
});

test('optional artwork background colors only the media opening beneath alpha artwork', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  assert.match(source, /backgroundColor: backing\.enabled \? backing\.color : undefined/);
  assert.match(source, /left: percentage\(mediaRectangle\.left - selectionRectangle\.left, selectionRectangle\.width\)/);
  assert.doesNotMatch(source, /backplate[^\n]*backing\.color/);
});

test('only the selected arranged placement exposes four pointer-only corner resize handles', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./latticePlacementRenderer.css', import.meta.url), 'utf8');
  assert.match(source, /renderEntries\.find\(\(\{ placement \}\) => placement\.id === selectedPlacementId\)/);
  assert.match(source, /PLACEMENT_RESIZE_CORNERS\.map/);
  assert.match(source, /data-resize-corner=\{corner\}/);
  assert.doesNotMatch(source, /tabIndex[^\n]*resize/);
  assert.match(source, /Math\.max\(\.\.\.renderEntries\.map/);
  assert.match(styles, /\.lattice-placement-selection-overlay\s*\{[^}]*pointer-events: none;/s);
  assert.match(styles, /\.lattice-placement-selection-overlay\s*\{[^}]*outline-offset: 0;/s);
  assert.match(styles, /\.lattice-placement-resize-handle\s*\{[^}]*width: 24px;[^}]*height: 24px;/s);
  assert.match(styles, /\.lattice-placement-resize-handle::after\s*\{[^}]*width: 7px;[^}]*height: 7px;/s);
  assert.match(styles, /\.lattice-placement-resize-handle::after\s*\{[^}]*background: transparent;/s);
  assert.match(styles, /\.lattice-placement-resize-handle\.is-nw::after\s*\{[^}]*right: 12px;[^}]*bottom: 12px;/s);
  assert.match(styles, /\.lattice-placement-resize-handle\.is-se::after\s*\{[^}]*left: 12px;[^}]*top: 12px;/s);
  assert.doesNotMatch(styles, /\.lattice-placement-resize-handle::after\s*\{[^}]*background: #/s);
});

test('crop masking is explicit, transparent by default, and hides resize handles while focus is edited', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./latticePlacementRenderer.css', import.meta.url), 'utf8');
  assert.match(source, /cropped \? ' is-cropped'/);
  assert.match(source, /cropEditingPlacementId !== selectedEntry\.placement\.id/);
  assert.match(source, /data-crop-placement-id/);
  assert.match(source, /left: percentage\(imageRectangle\.left - mediaRectangle\.left, mediaRectangle\.width\)/);
  assert.match(styles, /\.lattice-placement-media\.is-cropped\s*\{[^}]*overflow: hidden/s);
  assert.doesNotMatch(styles, /\.lattice-placement-media\.is-cropped\s*\{[^}]*(background|border):/s);
  assert.match(styles, /\.lattice-placement-selection-overlay\.is-crop-editing\s*\{[^}]*pointer-events: auto/s);
});

test('OPAQUE background is bounded by the fitted native-media rectangle, never the cell footprint', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./latticePlacementRenderer.css', import.meta.url), 'utf8');
  const [entry] = projectTableMediaPlacements({
    assetsByStableId: media,
    artboard: CANONICAL_LATTICE_ARTBOARD,
    table: table('table-05', { x: 0, y: 0 }, [placement({ transparencyMode: TRANSPARENCY_MODES.OPAQUE })]),
    viewport: { width: 1600, height: 900 },
  });
  assert.deepEqual(entry.mediaRectangle, { left: 0, top: 25, width: 800, height: 400 });
  assert.match(source, /left: percentage\(mediaRectangle\.left/);
  assert.match(source, /width: percentage\(mediaRectangle\.width/);
  assert.match(styles, /\.lattice-placement-media\.is-opaque\s*\{[^}]*background:/s);
  assert.doesNotMatch(styles, /\.lattice-placement-layer\s*\{[^}]*background:/s);
});

test('isolated placement rendering has no resolution, persistence, or production dependencies', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /canvas|getImageData|crossOrigin|mime|fetch|ipfs|useWalletStore|localStorage|sessionStorage|indexedDB/iu);
});
