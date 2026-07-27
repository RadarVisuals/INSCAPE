import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('./LatticeEnginePrototype.jsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('./lattice/controller/latticeNavigation.js', import.meta.url), 'utf8');
const placementController = readFileSync(new URL('./lattice/controller/latticePlacementAuthoring.js', import.meta.url), 'utf8');
const resizeController = readFileSync(new URL('./lattice/controller/latticePlacementResize.js', import.meta.url), 'utf8');
const lifecycleController = readFileSync(new URL('./lattice/controller/latticePlacementLifecycle.js', import.meta.url), 'utf8');

test('lattice engine harness is a development-only lazy route backed by the Slice 1A topology', () => {
  assert.match(entry, /import\.meta\.env\.DEV && prototypePath === '\/prototype\/lattice-engine'/);
  assert.match(entry, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/LatticeEnginePrototype\.jsx'\)\)/);
  assert.match(source, /LATTICE_COORDINATES/);
  assert.match(source, /latticeTableFallbackTitle/);
  assert.match(source, /LatticeTableRenderer/);
  assert.match(source, /LatticeGridPlane/);
  assert.match(source, /PHASE 4 \/ SLICE 2H/);
  assert.match(source, /createFixturePlacements/);
  assert.match(source, /assetsByStableId=\{FIXTURE_MEDIA\}/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|useWalletStore|profileDocument/);
});

test('Arrange is session-only free placement with deterministic gesture ownership', () => {
  for (const token of [
    'arrangeEnabled',
    'handlePlacementPointerDown',
    'setPointerCapture',
    'createPlacementGesture',
    'updatePlacementGesture',
    'finishPlacementGesture',
    'nudgePlacementByPixels',
    'placementDragging',
  ]) assert.match(source, new RegExp(token));
  assert.match(source, /event\.button === 0/);
  assert.match(source, /!event\.altKey && !event\.ctrlKey && !event\.metaKey && !event\.shiftKey/);
  assert.doesNotMatch(placementController, /layer|navigationOrder|timer|velocity|inertia/iu);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|useWalletStore|profileDocument/);
});

test('smart guides, independent grid controls, hysteresis and Alt bypass stay transient', () => {
  for (const token of [
    'smartGuides',
    'gridVisible',
    'gridSnap',
    'alignmentGuides',
    'guideThreshold',
    'guideReleaseThreshold',
    'bypass: event.altKey',
    'otherPlacements: centerPlacements',
  ]) assert.match(source, new RegExp(token));
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('native proportional resize is corner-anchored and shares guide behavior without using movement state', () => {
  for (const token of [
    'handlePlacementResizePointerDown',
    'createPlacementResizeGesture',
    'updatePlacementResizeGesture',
    'finishPlacementResizeGesture',
    'placementResizing',
    'minimumArtworkPixels',
  ]) assert.match(source, new RegExp(token));
  assert.match(resizeController, /PLACEMENT_RESIZE_CORNERS/);
  assert.match(resizeController, /projectedScale/);
  assert.match(resizeController, /resolveResizeGuide/);
  assert.match(resizeController, /guideReleaseThreshold/);
  assert.match(source, /event\.target\.closest\?\.\('\[data-resize-corner\]'\)/);
  assert.match(source, /setAlignmentGuides\(next\.guides\)/);
  assert.doesNotMatch(resizeController, /crop|localStorage|sessionStorage|indexedDB/iu);
});

test('bounded cover framing uses Space-drag without becoming free lattice camera state', () => {
  for (const token of [
    'LATTICE_ARTBOARD_FITS.COVER',
    'latticeArtboardFramingBounds',
    'createArtboardFramingGesture',
    "kind: 'framing'",
    "event.code !== 'Space'",
    'framingPreview',
    'FRAME READY',
    'FRAMING',
  ]) assert.match(source, new RegExp(token.replaceAll('.', '\\.')));
  assert.match(source, /framing=\{framing\}/);
  assert.match(source, /projectedArtboard/);
  assert.doesNotMatch(source, /persistFraming|framing.*localStorage|framing.*sessionStorage/iu);
});

test('square crop authoring remains explicit, reversible, and session-only with mats present', () => {
  for (const token of [
    'squareCropPlacement',
    'restoreNativePlacement',
    'createCropFocusGesture',
    "kind: 'crop'",
    'nudgeCropFocus',
    'setCropZoom',
    'SQUARE CROP',
    'EDIT CROP',
    'DONE CROP',
    'REMOVE CROP',
    'CROPPING',
  ]) assert.match(source, new RegExp(token));
  assert.match(source, /spaceHeldRef\.current \|\| !arrangeEnabled/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('generic mats and optional presets remain per-placement and session-only', () => {
  assert.match(source, /createDefaultArtworkMats/);
  assert.match(source, /artworkMats\[placement\.id\]/);
  assert.match(source, /ARTWORK_MAT_PRESET_IDS\.NONE/);
  assert.match(source, /ARTWORK_MAT_PRESET_IDS\.DOSSIER/);
  assert.match(source, /ARTWORK_MAT_PRESET_IDS\.CAPTION/);
  assert.match(source, /\['top', 'right', 'bottom', 'left'\]\.map/);
  assert.match(source, /updateSelectedMatInset/);
  assert.match(source, /POLAROID \/ CAPTION/);
  assert.doesNotMatch(source, /artist|edition|collection|tokenId|localStorage|sessionStorage|indexedDB/iu);
});

test('transparent artwork backing stays independent from mat color and session-only', () => {
  assert.match(source, /createDefaultArtworkBackings/);
  assert.match(source, /artworkBackings\[selectedPlacement\.id\]/);
  assert.match(source, /artworkBackingsByPlacementId=\{artworkBackings\}/);
  assert.match(source, /Artwork background/);
  assert.match(source, /Background color/);
  assert.doesNotMatch(source, /persistArtworkBacking|publishArtworkBacking/);
});

test('selected placement lifecycle replaces global fixture swapping without touching navigation order', () => {
  assert.match(source, /createDefaultPlacementDefinitions/);
  assert.match(source, /replaceSelectedArtwork/);
  assert.match(source, /moveSelectedArtworkLayer/);
  assert.match(source, /removeSelectedArtwork/);
  assert.match(source, /SEND BACKWARD/);
  assert.match(source, /BRING FORWARD/);
  assert.match(source, /REMOVE PLACEMENT/);
  assert.doesNotMatch(source, /Swap layers|layersSwapped/);
  assert.match(source, /layer: 0/);
  assert.match(source, /layer: 1/);
  assert.match(source, /layer: 2/);
  assert.match(source, /navigationOrder: 2/);
  assert.match(source, /navigationOrder: 0/);
  assert.match(source, /navigationOrder: 1/);
  assert.doesNotMatch(lifecycleController, /localStorage|sessionStorage|indexedDB|wallet|publish/iu);
});

test('empty-space and placement gestures remain separate while Escape restores or clears', () => {
  assert.match(source, /kind: 'navigation'/);
  assert.match(source, /kind: 'placement'/);
  assert.match(source, /setSelectedPlacementId\(null\)/);
  assert.match(source, /finishGesture\(true\)/);
  assert.match(source, /focusedPlacementId === selectedPlacementId/);
  assert.match(source, /event\.shiftKey \? 10 : 1/);
});

test('Phase 2 fixture composition belongs permanently to the authored center table', () => {
  assert.match(source, /isAuthoredTable = coordinate\.x === 0 && coordinate\.y === 0/);
  assert.match(source, /placements: isAuthoredTable/);
  assert.doesNotMatch(source, /placements: isActive/);
  assert.match(source, /TRANSPARENCY_MODES\.AUTO/);
  assert.match(source, /TRANSPARENCY_MODES\.PRESERVE_ALPHA/);
  assert.match(source, /Object\.values\(TRANSPARENCY_MODES\)/);
  assert.doesNotMatch(source, /crop:\s*\{/);
});

test('renderer controls exercise geometry and label contract values without persistence', () => {
  for (const token of [
    'LATTICE_GEOMETRY_PRESETS',
    'PROTOTYPE_START_GEOMETRY',
    'LATTICE_SURFACES',
    'TABLE_LABEL_ANCHORS',
    'labelVisible',
    'labelOffset',
    'RESET RENDER',
  ]) assert.match(source, new RegExp(token));
  assert.doesNotMatch(source, /IDENTITY|COLLECTIONS|ARCHIVE|DROPS|CURATED/);
});

test('prototype uses the canonical artboard and normalized free-placement bounds', () => {
  assert.match(source, /CANONICAL_LATTICE_ARTBOARD/);
  assert.match(source, /x: 0\.46, y: 0\.13, width: 0\.4, height: 0\.4 \* \(16 \/ 9\) \* \(2000 \/ 4636\)/);
  assert.doesNotMatch(source, /scaledFixturePlacement|columnSpan|rowSpan/);
});

test('all tunable interaction behavior lives in one transient configuration object', () => {
  for (const field of [
    'deadZone',
    'commitThreshold',
    'diagonalTolerance',
    'edgeResistance',
    'wheelAccumulationThreshold',
    'wheelCooldown',
    'snapDuration',
    'guideThreshold',
    'guideReleaseThreshold',
    'minimumArtworkPixels',
  ]) {
    assert.match(controller, new RegExp(`${field}:`));
    assert.match(source, new RegExp(`'${field}'`));
  }
  assert.doesNotMatch(controller, /velocity|inertia|friction|spring/iu);
});
