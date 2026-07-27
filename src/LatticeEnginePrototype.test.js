import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('./LatticeEnginePrototype.jsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('./lattice/controller/latticeNavigation.js', import.meta.url), 'utf8');
const placementController = readFileSync(new URL('./lattice/controller/latticePlacementAuthoring.js', import.meta.url), 'utf8');
const resizeController = readFileSync(new URL('./lattice/controller/latticePlacementResize.js', import.meta.url), 'utf8');
const lifecycleController = readFileSync(new URL('./lattice/controller/latticePlacementLifecycle.js', import.meta.url), 'utf8');
const insertionController = readFileSync(new URL('./lattice/controller/latticePlacementInsertion.js', import.meta.url), 'utf8');
const focusViewer = readFileSync(new URL('./lattice/rendering/LatticeFocusViewer.jsx', import.meta.url), 'utf8');
const focusViewerStyles = readFileSync(new URL('./lattice/rendering/latticeFocusViewer.css', import.meta.url), 'utf8');
const prototypeStyles = readFileSync(new URL('./latticeEnginePrototype.css', import.meta.url), 'utf8');
const keeperHarness = readFileSync(new URL('./lattice/prototype/LatticeKeeperDockHarness.jsx', import.meta.url), 'utf8');

test('lattice engine harness is a development-only lazy route backed by the Slice 1A topology', () => {
  assert.match(entry, /import\.meta\.env\.DEV && prototypePath === '\/prototype\/lattice-engine'/);
  assert.match(entry, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/LatticeEnginePrototype\.jsx'\)\)/);
  assert.match(source, /LATTICE_COORDINATES/);
  assert.match(source, /latticeTableFallbackTitle/);
  assert.match(source, /LatticeTableRenderer/);
  assert.match(source, /LatticeGridPlane/);
  assert.match(source, /PHASE 6 \/ SLICE 4E/);
  assert.match(source, /createFixturePlacements/);
  assert.match(source, /assetsByStableId=\{FIXTURE_MEDIA\}/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|useWalletStore|profileDocument/);
});

test('Phase 6 profile rail stays an unresolved session-only public-navigation probe', () => {
  assert.match(source, /LatticeProfileRail/);
  assert.match(source, /PROFILE_RAIL_ENTRIES/);
  for (const label of ['CATEGORIES', 'CREATIONS', 'ACTIVITY', 'DISCOVER']) {
    assert.match(source, new RegExp(`label: '${label}'`));
  }
  assert.match(source, /officialIdentity=\{null\}/);
  assert.match(source, /compact=\{dimensions\.width <= 640\}/);
  assert.match(source, /blocked=\{Boolean\(viewerSession\)\}/);
  assert.match(source, /setActiveProfileEntryId\(null\)/);
  assert.doesNotMatch(source, /profileRail.*(?:localStorage|sessionStorage|wallet|publish)/iu);
});

test('Phase 6 INSCAPE signature stays fixed, pointer-inert, and presentation-only', () => {
  assert.match(source, /className="lattice-inscape-signature" aria-label="INSCAPE"/);
  assert.match(source, /SPATIAL PROFILE SYSTEM \/ ACTIVE/);
  assert.match(prototypeStyles, /@font-face\s*\{[^}]*font-family: "Inscape H Variant";[^}]*HVariant\.otf/s);
  assert.match(prototypeStyles, /\.lattice-inscape-signature\s*\{[^}]*position: fixed;[^}]*left: 24px;[^}]*bottom: 24px;[^}]*pointer-events: none;/s);
  assert.match(prototypeStyles, /\.lattice-engine-readout\s*\{[^}]*bottom: 78px;/s);
  assert.doesNotMatch(source, /signature.*(?:localStorage|sessionStorage|wallet|publish)/iu);
});

test('Phase 6 Keeper Dock reuses the real handoff contract inside the dev-only lattice harness', () => {
  assert.match(source, /LatticeKeeperDockHarness/);
  assert.match(source, /blocked=\{Boolean\(viewerSession\)\}/);
  assert.match(keeperHarness, /import KeeperDock from '\.\.\/\.\.\/public\/KeeperDock\.jsx'/);
  assert.match(keeperHarness, /import ArtCanvas from '\.\.\/\.\.\/components\/Canvas\/ArtCanvas\.jsx'/);
  for (const method of [
    'startResidentHandoff',
    'updateResidentHandoffBounds',
    'exitResidentHandoff',
    'cancelResidentHandoff',
  ]) assert.match(keeperHarness, new RegExp(method));
  assert.match(keeperHarness, /KEEPER_ID = 'abyssal_eye'/);
  assert.match(keeperHarness, /id="keeper-dock-underlay"/);
  assert.match(keeperHarness, /inert=\{blocked \? '' : undefined\}/);
  assert.match(keeperHarness, /TRANSITIONAL_PHASES = new Set\(\['approaching', 'entering', 'releasing'\]\)/);
  assert.match(keeperHarness, /onClickCapture=\{blockTransitionActivation\}/);
  assert.match(prototypeStyles, /--keeper-dock-size: clamp\(84px, 7\.8vw, 112px\)/);
  assert.match(prototypeStyles, /\.lattice-keeper-dock-layer \.keeper-dock__options,[^}]*\.keeper-dock__menu\s*\{[^}]*display: none;/s);
  assert.match(prototypeStyles, /\.lattice-keeper-world \*\s*\{[^}]*pointer-events: none !important;/s);
  assert.match(prototypeStyles, /@media \(prefers-reduced-motion: reduce\)[^{]*\{[^}]*\.lattice-engine-stage/s);
  assert.doesNotMatch(keeperHarness, /localStorage|sessionStorage|wallet|publish|\bDate\b|Math\.random/iu);
});

test('Phase 6 navigation controls share the canonical topology without introducing a boxed map', () => {
  assert.match(source, /latticeCardinalDestinations\(active\)/);
  assert.match(source, /LATTICE_COORDINATES\.map\(\(coordinate\)/);
  assert.match(source, /!arrangeEnabled && !viewerSession/);
  assert.match(source, /aria-current=\{isActive \? 'location'/);
  assert.match(source, /latticeMapFocusDestination/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /settlingRef\.current \|\| gestureRef\.current/);
  assert.match(prototypeStyles, /\.lattice-coordinate-map\s*\{[^}]*grid-template-columns: repeat\(3, 22px\);/s);
  assert.match(prototypeStyles, /\.lattice-direction-chevron\.is-down\s*\{[^}]*bottom: 104px;/s);
  assert.doesNotMatch(prototypeStyles, /\.lattice-coordinate-map\s*\{[^}]*(?:background|border|box-shadow):/s);
  assert.doesNotMatch(source, /table\.title|tableDisplayTitle/);
});

test('Phase 5 focus viewer opens only from view mode and preserves the live lattice origin', () => {
  assert.match(source, /openPlacementViewer/);
  assert.match(source, /event\.type === 'keydown' \|\| event\.button === 0/);
  assert.match(source, /if \(arrangeEnabled \|\| viewerSession/);
  assert.match(source, /originElement\.getBoundingClientRect\(\)/);
  assert.match(focusViewer, /artworkRef\.current\?\.getBoundingClientRect\(\)/);
  assert.doesNotMatch(focusViewer, /secondFrame/);
  assert.match(source, /onPlacementActivate=\{!arrangeEnabled && isActive && isAuthoredTable/);
  assert.match(source, /focusedPlacementId=\{viewerSession\?\.placementId \|\| null\}/);
  assert.match(source, /getReturnRectangle=\{\(\) => viewportRef\.current/);
  assert.match(source, /LatticeFocusViewer/);
  assert.doesNotMatch(source, /NftFlipViewer|NftTableViewerPrototype/);
});

test('focus viewer owns modal focus and Escape while leaving the lattice presentation visible', () => {
  assert.match(focusViewer, /createPortal/);
  assert.match(focusViewer, /aria-modal="true"/);
  assert.match(focusViewer, /event\.key !== 'Escape'/);
  assert.match(focusViewer, /window\.addEventListener\('keydown', closeOnEscape, true\)/);
  assert.match(focusViewer, /node\.inert = true/);
  assert.match(focusViewer, /returnFocusRef\.current\.focus/);
  assert.match(focusViewer, /LatticeArtworkPresentation/);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer\s*\{[^}]*background: transparent;/s);
  assert.doesNotMatch(focusViewer, /localStorage|sessionStorage|indexedDB|useWalletStore|profileDocument/iu);
});

test('viewer browsing follows explicit navigation order with wrapping and ratio-safe crossfades', () => {
  for (const token of [
    'orderedFocusViewerEntries',
    'focusViewerDestination',
    'navigatePlacementViewer',
  ]) assert.match(source, new RegExp(token));
  assert.match(focusViewer, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
  assert.match(focusViewer, /wheelAccumulationThreshold/);
  assert.match(focusViewer, /swipeThreshold/);
  assert.match(focusViewer, /Previous artwork/);
  assert.match(focusViewer, /Next artwork/);
  assert.match(focusViewer, /outgoingLayer/);
  assert.match(focusViewer, /focusViewerLayout\(outgoingLayer\.originRectangle, viewport, dossiersOpen\)\.artwork/);
  assert.match(focusViewerStyles, /lattice-focus-viewer-browse-in/);
  assert.match(focusViewerStyles, /lattice-focus-viewer-browse-out/);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer__navigation\s*\{[^}]*left: 50%;[^}]*bottom: 18px;/s);
  assert.doesNotMatch(focusViewer, /controlsTop/);
  assert.doesNotMatch(focusViewer, /navigationDirection|onNavigationSettled|setTimeout|localStorage|sessionStorage|indexedDB/iu);
  assert.doesNotMatch(focusViewerStyles, /lattice-focus-viewer-(?:next|previous)|data-direction|navigation-duration/iu);
  assert.match(focusViewerStyles, /transition: transform 420ms/);
  assert.match(focusViewerStyles, /will-change: transform/);
  assert.doesNotMatch(focusViewerStyles, /(?:left|top|width|height) 420ms/);
  assert.match(focusViewerStyles, /@keyframes lattice-focus-viewer-browse-in\s*\{[^}]*transform: scale\(0\.995\)/s);
  assert.match(focusViewerStyles, /@keyframes lattice-focus-viewer-browse-out\s*\{[^}]*transform: scale\(1\)/s);
  assert.match(focusViewerStyles, /\[data-phase="open"\] \.lattice-focus-viewer__artwork\s*\{[^}]*transition: none;/s);
});

test('Phase 5 dossiers open as one sticky pair from behind the artwork and remain fixture-only', () => {
  assert.match(focusViewer, /useState\(false\)/);
  assert.match(focusViewer, /cycleArtworkViewer/);
  assert.match(focusViewer, /setDossiersOpen\(\(current\) => !current\)/);
  assert.doesNotMatch(focusViewer, /dossierStage|setDossierStage|else\s*\{\s*requestClose/);
  assert.match(focusViewer, /focusViewerLayout\(outgoingLayer\.originRectangle, viewport, dossiersOpen\)/);
  assert.match(focusViewer, /data-lattice-viewer-scroll/);
  assert.match(focusViewer, /NO TRAITS RESOLVED/);
  assert.match(focusViewer, /NOT RESOLVED/);
  assert.doesNotMatch(focusViewer, /openPanel/);
  assert.doesNotMatch(focusViewer, /toggleDossier|dossier-toggle/);
  assert.match(source, /fixtureFocusDossier/);
  assert.match(source, /STABLE ASSET ID/);
  assert.match(source, /TOKEN STANDARD', value: null/);
  assert.doesNotMatch(source, /marketplaceUrl|explorerUrl|creatorUrl/);
  assert.match(focusViewerStyles, /\[data-layout="compact"\]/);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer__dossier-body\s*\{[^}]*overflow: auto;/s);
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

test('fixture-backed right-click insertion stays normalized, replaceable and development-only', () => {
  for (const token of [
    'FIXTURE_ASSET_SOURCE',
    'listAssets',
    'resolveAsset',
    'openInsertionMenu',
    'normalizedInsertionAnchor',
    'createPlacementAtAnchor',
    'DEFAULT_LATTICE_INSERTION_CONFIG',
    'ADD / ARTWORK',
  ]) assert.match(source, new RegExp(token));
  assert.match(source, /onContextMenu=\{openInsertionMenu\}/);
  assert.match(source, /pendingPlacementFocusRef/);
  assert.match(source, /phase-4-inserted-/);
  assert.doesNotMatch(insertionController, /Date|Math\.random|innerWidth|innerHeight|localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source, /useLibraryStore|AssetIndex|CategoryAssetBrowser|ProfileNavigationDock|useWalletStore/);
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
