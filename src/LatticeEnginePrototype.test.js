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
const focusInspection = readFileSync(new URL('./lattice/rendering/LatticeFocusInspection.jsx', import.meta.url), 'utf8');
const focusViewerStyles = readFileSync(new URL('./lattice/rendering/latticeFocusViewer.css', import.meta.url), 'utf8');
const menuSurfaceStyles = readFileSync(new URL('./lattice/rendering/latticeMenuSurface.css', import.meta.url), 'utf8');
const prototypeStyles = readFileSync(new URL('./latticeEnginePrototype.css', import.meta.url), 'utf8');
const keeperHarness = readFileSync(new URL('./lattice/prototype/LatticeKeeperDockHarness.jsx', import.meta.url), 'utf8');
const fixtureSource = readFileSync(new URL('./lattice/prototype/latticeEngineFixtures.js', import.meta.url), 'utf8');
const navigationOverlay = readFileSync(new URL('./lattice/rendering/LatticeNavigationOverlay.jsx', import.meta.url), 'utf8');
const insertionOverlay = readFileSync(new URL('./lattice/prototype/LatticeArtworkInsertionOverlay.jsx', import.meta.url), 'utf8');
const devControls = readFileSync(new URL('./lattice/prototype/LatticeEngineDevControls.jsx', import.meta.url), 'utf8');
const prototypeSources = `${source}\n${fixtureSource}\n${navigationOverlay}\n${insertionOverlay}\n${devControls}`;

test('lattice engine harness is a development-only lazy route backed by the Slice 1A topology', () => {
  assert.match(entry, /import\.meta\.env\.DEV && prototypePath === '\/prototype\/lattice-engine'/);
  assert.match(entry, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/LatticeEnginePrototype\.jsx'\)\)/);
  assert.match(source, /LATTICE_COORDINATES/);
  assert.match(source, /latticeTableFallbackTitle/);
  assert.match(source, /LatticeTableRenderer/);
  assert.match(source, /LatticeGridPlane/);
  assert.doesNotMatch(source, /FIXED CHROME \/ PHASE 6 \/ SLICE 4F/);
  assert.match(source, /latticeEngineFixtures\.js/);
  assert.match(fixtureSource, /createFixturePlacements/);
  assert.match(source, /assetsByStableId=\{FIXTURE_MEDIA\}/);
  assert.doesNotMatch(prototypeSources, /localStorage|sessionStorage|indexedDB|useWalletStore|profileDocument/);
});

test('Phase 6 profile rail stays an unresolved session-only public-navigation probe', () => {
  assert.match(source, /LatticeProfileRail/);
  assert.match(source, /PROFILE_RAIL_ENTRIES/);
  for (const label of ['CATEGORIES', 'CREATIONS', 'ACTIVITY', 'DISCOVER']) {
    assert.match(source, new RegExp(`label: '${label}'`));
  }
  assert.match(source, /officialIdentity=\{profileRailIdentity\}/);
  assert.match(source, /compact=\{dimensions\.width <= 900\}/);
  assert.match(source, /blocked=\{Boolean\(viewerSession\)\}/);
  assert.match(source, /chromeWindows\.activate\(LATTICE_CHROME_REGIONS\.RAIL/);
  assert.match(source, /chromeWindows\.closeRegion\(LATTICE_CHROME_REGIONS\.RAIL/);
  assert.doesNotMatch(source, /profileRail.*(?:localStorage|sessionStorage|wallet|publish)/iu);
});

test('Phase 6 public profile dossier expands only from the identity control with injected public data', () => {
  assert.match(source, /LatticeProfileDossier/);
  assert.match(source, /PROFILE_DOSSIER_PRESENTATION/);
  assert.match(fixtureSource, /createUnresolvedPublicProfilePresentation/);
  assert.match(source, /identityControlRef=\{profileIdentityControlRef\}/);
  assert.match(source, /identityExpanded=\{profileDossierOpen\}/);
  assert.match(source, /if \(profileDossierOpen\)/);
  assert.match(source, /closeProfileDossier/);
  assert.match(source, /profileIdentityControlRef\.current\?\.focus/);
  assert.match(source, /open=\{profileDossierOpen && !viewerSession\}/);
  assert.doesNotMatch(source, /INSCAPE FIXTURE|RADAR|VXCTXR|RESIDENT ZERO|last seen|asset count|collection count/iu);
});

test('Phase 6 owner workspace toolbar stays session-only and separate from public navigation', () => {
  assert.match(source, /LatticeWorkspaceToolbar/);
  assert.match(source, /WORKSPACE_TOOL_ENTRIES/);
  for (const label of ['BROWSER', 'ARRANGE', 'PREVIEW', 'THEME', 'PUBLISH', 'MORE']) {
    assert.match(source, new RegExp(`label: '${label}'`));
  }
  assert.match(source, /owner=\{ownerChromeVisible\}/);
  assert.match(source, /compact=\{dimensions\.width <= 980\}/);
  assert.match(source, /blocked=\{Boolean\(viewerSession\)\}/);
  assert.match(source, /if \(toolId === 'arrange'\)/);
  assert.match(source, /setArrangeMode\(!arrangeEnabled\)/);
  assert.match(source, /chromeWindows\.activate\(LATTICE_CHROME_REGIONS\.TOOLBAR/);
  assert.match(source, /chromeWindows\.closeRegion\(LATTICE_CHROME_REGIONS\.TOOLBAR/);
  assert.doesNotMatch(source, /workspaceTool.*(?:localStorage|sessionStorage|wallet|publish)/iu);
  assert.match(source, /data-menu-surface=\{menuSurfaceId\}/);
  assert.match(source, /data-overlay-ink=\{overlayInkSurfaceId\}/);
  assert.match(source, /LatticeEngineDevControls/);
  assert.match(devControls, /<span>Menu surface<\/span>/);
  assert.match(devControls, /setMenuSurfaceId\(event\.target\.value\)/);
  assert.match(menuSurfaceStyles, /data-menu-surface="paper"/);
});

test('Phase 6 INSCAPE signature stays fixed, pointer-inert, and presentation-only', () => {
  assert.match(source, /className="lattice-inscape-signature" aria-label="INSCAPE"/);
  assert.match(source, /SPATIAL PROFILE SYSTEM \/ ACTIVE/);
  assert.match(prototypeStyles, /@font-face\s*\{[^}]*font-family: "Inscape H Variant";[^}]*HVariant\.otf/s);
  assert.match(prototypeStyles, /\.lattice-inscape-signature\s*\{[^}]*position: fixed;[^}]*left: 24px;[^}]*bottom: 24px;[^}]*pointer-events: none;/s);
  assert.match(prototypeStyles, /\.lattice-inscape-signature\s*\{[^}]*color: var\(--lattice-overlay-ink\);/s);
  assert.match(prototypeStyles, /\.lattice-inscape-signature small\s*\{[^}]*color: var\(--lattice-overlay-ink\);/s);
  assert.match(prototypeStyles, /\.lattice-inscape-signature span\s*\{[^}]*color: var\(--lattice-overlay-ink\);/s);
  assert.match(prototypeStyles, /font: 400 clamp\(15px, 1\.2vw, 18px\)\/0\.82 "Inscape H Variant"/);
  assert.match(source, /labelVisible: false/);
  assert.doesNotMatch(prototypeSources, /renderPreview\.label(?:Visible|Anchor|Offset)/);
  assert.match(source, /<small>\{activeTableName\}<\/small>/);
  assert.match(devControls, /className="lattice-engine-diagnostics"/);
  assert.doesNotMatch(source, /className="lattice-engine-readout"/);
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
  assert.match(prototypeStyles, /--keeper-dock-size: clamp\(60px, 5\.5vw, 78px\)/);
  assert.match(keeperHarness, /LATTICE_DOCKED_KEEPER_SCALE = 0\.5/);
  assert.match(keeperHarness, /residentScale=\{LATTICE_DOCKED_KEEPER_SCALE\}/);
  assert.match(prototypeStyles, /\.lattice-keeper-dock-underlay \.keeper-dock__ghost::before\s*\{[^}]*background: var\(--lattice-overlay-ink\);/s);
  assert.match(prototypeStyles, /\.lattice-keeper-dock-layer \.keeper-dock__options,[^}]*\.keeper-dock__menu\s*\{[^}]*display: none;/s);
  assert.match(prototypeStyles, /\.lattice-keeper-world \*\s*\{[^}]*pointer-events: none !important;/s);
  assert.match(prototypeStyles, /@media \(prefers-reduced-motion: reduce\)[^{]*\{[^}]*\.lattice-engine-stage/s);
  assert.doesNotMatch(keeperHarness, /localStorage|sessionStorage|wallet|publish|\bDate\b|Math\.random/iu);
});

test('Phase 6 navigation controls share the canonical topology without introducing a boxed map', () => {
  assert.match(source, /LatticeNavigationOverlay/);
  assert.match(navigationOverlay, /latticeCardinalDestinations\(active\)/);
  assert.match(navigationOverlay, /LATTICE_COORDINATES\.map\(\(coordinate\)/);
  assert.match(source, /!arrangeEnabled && !viewerSession/);
  assert.match(navigationOverlay, /aria-current=\{isActive \? 'location'/);
  assert.match(navigationOverlay, /latticeMapFocusDestination/);
  assert.match(navigationOverlay, /event\.key === 'Escape'/);
  assert.match(source, /settlingRef\.current \|\| gestureRef\.current/);
  assert.match(prototypeStyles, /\.lattice-coordinate-map\s*\{[^}]*bottom: calc\(12px \+ 34px \+ 8px\);[^}]*grid-template-columns: repeat\(3, 20px\);/s);
  assert.match(prototypeStyles, /\.lattice-direction-chevron\.is-down\s*\{[^}]*bottom: 12px;/s);
  assert.doesNotMatch(prototypeStyles, /\.lattice-coordinate-map\s*\{[^}]*(?:background|border|box-shadow):/s);
  assert.doesNotMatch(prototypeSources, /table\.title|tableDisplayTitle/);
  assert.doesNotMatch(prototypeStyles, /\.lattice-engine-viewport:focus-visible::after/);
  assert.match(prototypeStyles, /\.lattice-direction-chevron,[^{]*\.lattice-coordinate-map button\s*\{[^}]*color: var\(--lattice-overlay-ink\);/s);
  assert.match(prototypeStyles, /\.lattice-coordinate-map button\.is-active::before\s*\{[^}]*background: var\(--lattice-overlay-ink\);/s);
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

test('focus viewer owns modal focus and Escape on the selected inspection surface', () => {
  assert.match(focusViewer, /createPortal/);
  assert.match(focusViewer, /aria-modal="true"/);
  assert.match(focusViewer, /event\.key !== 'Escape'/);
  assert.match(focusViewer, /window\.addEventListener\('keydown', closeOnEscape, true\)/);
  assert.match(focusViewer, /node\.inert = true/);
  assert.match(focusViewer, /returnFocusRef\.current\.focus/);
  assert.match(focusViewer, /LatticeArtworkPresentation/);
  assert.match(source, /surfaceColor=\{latticeSurfaceColor\(renderPreview\.surfaceId\)\}/);
  assert.match(source, /semanticGridVariables\(/);
  assert.match(source, /gridVariables=\{viewerGridVariables\}/);
  assert.match(source, /gridVisible=\{gridVisible\}/);
  assert.match(focusViewer, /--lattice-inspection-surface/);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer__surface\s*\{[^}]*background-color: var\(--lattice-inspection-surface, #090a0a\);/s);
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
  assert.match(focusViewer, /className="lattice-focus-viewer__surface"/);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer\[data-phase="starting"\] \.lattice-focus-viewer__surface,[\s\S]*?\.lattice-focus-viewer\[data-phase="closing"\] \.lattice-focus-viewer__surface\s*\{[^}]*opacity: 0;/s);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer\[data-phase="opening"\] \.lattice-focus-viewer__surface,[\s\S]*?\.lattice-focus-viewer\[data-phase="closing"\] \.lattice-focus-viewer__surface\s*\{[^}]*transition: opacity 240ms/);
  assert.doesNotMatch(focusViewerStyles, /\.lattice-focus-viewer\[data-phase="closing"\]\s*\{[^}]*opacity:/s);
  assert.match(focusViewerStyles, /will-change: transform/);
  assert.doesNotMatch(focusViewerStyles, /(?:left|top|width|height) 420ms/);
  assert.match(focusViewerStyles, /@keyframes lattice-focus-viewer-browse-in\s*\{[^}]*transform: scale\(0\.995\)/s);
  assert.match(focusViewerStyles, /@keyframes lattice-focus-viewer-browse-out\s*\{[^}]*transform: scale\(1\)/s);
  assert.match(focusViewerStyles, /\[data-phase="open"\] \.lattice-focus-viewer__artwork\s*\{[^}]*transition: none;/s);
});

test('Phase 5 dossiers open as one detached inspection pair and remain fixture-only', () => {
  assert.match(focusViewer, /useState\(false\)/);
  assert.match(focusViewer, /cycleArtworkViewer/);
  assert.match(focusViewer, /setDossiersOpen\(\(current\) => !current\)/);
  assert.doesNotMatch(focusViewer, /dossierStage|setDossierStage|else\s*\{\s*requestClose/);
  assert.match(focusViewer, /focusViewerLayout\(outgoingLayer\.originRectangle, viewport, dossiersOpen\)/);
  assert.match(focusViewer, /LatticeFocusInspection/);
  assert.match(focusInspection, /data-lattice-viewer-scroll/);
  assert.match(focusInspection, /NO TRAITS RESOLVED/);
  assert.match(focusInspection, /NOT RESOLVED/);
  assert.match(focusInspection, /lattice-focus-viewer__inspection-frame/);
  assert.match(focusInspection, /lattice-focus-viewer__connectors/);
  assert.match(focusInspection, /--lattice-inspection-frame-left/);
  assert.doesNotMatch(focusViewer, /openPanel/);
  assert.doesNotMatch(focusViewer, /toggleDossier|dossier-toggle/);
  assert.match(source, /fixtureFocusDossier/);
  assert.match(fixtureSource, /STABLE ASSET ID/);
  assert.match(fixtureSource, /TOKEN STANDARD', value: null/);
  assert.doesNotMatch(prototypeSources, /marketplaceUrl|explorerUrl|creatorUrl/);
  assert.match(focusViewerStyles, /\[data-layout="compact"\]/);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer__dossier-body\s*\{[^}]*overflow: auto;/s);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer__inspection-frame\s*\{[^}]*background-size: var\(--lattice-grid-cell-size\) var\(--lattice-grid-cell-size\);/s);
  assert.doesNotMatch(focusViewerStyles, /background-size: 40px 40px/);
  assert.match(focusViewerStyles, /\.lattice-focus-viewer__navigation\s*\{[^}]*color: var\(--lattice-overlay-ink\);/s);
  assert.doesNotMatch(focusViewerStyles, /\.lattice-focus-viewer__dossier\.is-left\s*\{[^}]*translateX\(100%\)/s);
  assert.doesNotMatch(focusViewerStyles, /\.lattice-focus-viewer__dossier\.is-right\s*\{[^}]*translateX\(-100%\)/s);
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
    'CROPPING',
  ]) assert.match(source, new RegExp(token));
  for (const label of ['SQUARE CROP', 'EDIT CROP', 'DONE CROP', 'REMOVE CROP']) {
    assert.match(devControls, new RegExp(label));
  }
  assert.match(source, /spaceHeldRef\.current \|\| !arrangeEnabled/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('generic mats and optional presets remain per-placement and session-only', () => {
  assert.match(fixtureSource, /createDefaultArtworkMats/);
  assert.match(source, /artworkMats\[placement\.id\]/);
  assert.match(source, /ARTWORK_MAT_PRESET_IDS\.NONE/);
  assert.match(devControls, /ARTWORK_MAT_PRESET_IDS\.DOSSIER/);
  assert.match(devControls, /ARTWORK_MAT_PRESET_IDS\.CAPTION/);
  assert.match(devControls, /\['top', 'right', 'bottom', 'left'\]\.map/);
  assert.match(source, /updateSelectedMatInset/);
  assert.match(devControls, /POLAROID \/ CAPTION/);
  assert.doesNotMatch(source, /artist|edition|collection|tokenId|localStorage|sessionStorage|indexedDB/iu);
});

test('transparent artwork backing stays independent from mat color and session-only', () => {
  assert.match(fixtureSource, /createDefaultArtworkBackings/);
  assert.match(source, /artworkBackings\[selectedPlacement\.id\]/);
  assert.match(source, /artworkBackingsByPlacementId=\{artworkBackings\}/);
  assert.match(devControls, /Artwork background/);
  assert.match(devControls, /Background color/);
  assert.doesNotMatch(source, /persistArtworkBacking|publishArtworkBacking/);
});

test('selected placement lifecycle replaces global fixture swapping without touching navigation order', () => {
  assert.match(fixtureSource, /createDefaultPlacementDefinitions/);
  assert.match(source, /replaceSelectedArtwork/);
  assert.match(source, /moveSelectedArtworkLayer/);
  assert.match(source, /removeSelectedArtwork/);
  assert.match(devControls, /SEND BACKWARD/);
  assert.match(devControls, /BRING FORWARD/);
  assert.match(devControls, /REMOVE PLACEMENT/);
  assert.doesNotMatch(source, /Swap layers|layersSwapped/);
  assert.match(fixtureSource, /layer: 0/);
  assert.match(fixtureSource, /layer: 1/);
  assert.match(fixtureSource, /layer: 2/);
  assert.match(fixtureSource, /navigationOrder: 2/);
  assert.match(fixtureSource, /navigationOrder: 0/);
  assert.match(fixtureSource, /navigationOrder: 1/);
  assert.doesNotMatch(lifecycleController, /localStorage|sessionStorage|indexedDB|wallet|publish/iu);
});

test('fixture-backed right-click insertion stays normalized, replaceable and development-only', () => {
  for (const token of [
    'FIXTURE_ASSET_SOURCE',
    'resolveAsset',
    'openInsertionMenu',
    'normalizedInsertionAnchor',
    'createPlacementAtAnchor',
    'DEFAULT_LATTICE_INSERTION_CONFIG',
  ]) assert.match(source, new RegExp(token));
  assert.match(source, /LatticeArtworkInsertionOverlay/);
  assert.match(source, /assetSource=\{FIXTURE_ASSET_SOURCE\}/);
  assert.match(insertionOverlay, /ADD \/ ARTWORK/);
  assert.match(insertionOverlay, /assetSource\.listAssets\(\)/);
  assert.match(insertionOverlay, /role="menu"/);
  assert.match(insertionOverlay, /aria-modal="true"/);
  assert.match(insertionOverlay, /event\.target === event\.currentTarget/);
  assert.match(insertionOverlay, /autoFocus=\{index === 0\}/);
  assert.match(source, /onContextMenu=\{openInsertionMenu\}/);
  assert.match(source, /pendingPlacementFocusRef/);
  assert.match(source, /phase-4-inserted-/);
  assert.doesNotMatch(insertionController, /Date|Math\.random|innerWidth|innerHeight|localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source, /useLibraryStore|AssetIndex|CategoryAssetBrowser|ProfileNavigationDock|useWalletStore/);
});

test('isolated owner Browser remains an adapter-driven composition dependency', () => {
  assert.match(source, /LatticeChromeFixtureHost/);
  assert.match(source, /requestPlacement=\{\(stableAssetId\) => insertFixtureArtwork\(stableAssetId, \{ x: 0\.5, y: 0\.5 \}\)\}/);
  assert.match(source, /toolButtonRefs=\{\{ browser: browserToolRef, more: moreToolRef \}\}/);
  assert.doesNotMatch(source, /BrowserIndexPanel|BrowserCategoriesPanel|filterBrowserAssets|createCategory\(|renameCategory\(|deleteCategory\(|resizeBrowserAroundCenter/);
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
  assert.match(fixtureSource, /TRANSPARENCY_MODES\.AUTO/);
  assert.match(fixtureSource, /TRANSPARENCY_MODES\.PRESERVE_ALPHA/);
  assert.match(devControls, /Object\.values\(TRANSPARENCY_MODES\)/);
  assert.doesNotMatch(source, /crop:\s*\{/);
});

test('renderer controls exercise geometry and the wordmark title without restoring the removed canvas label controls', () => {
  assert.match(source, /LatticeEngineDevControls/);
  assert.match(fixtureSource, /PROTOTYPE_START_GEOMETRY/);
  for (const token of [
    'LATTICE_GEOMETRY_PRESETS',
    'LATTICE_SURFACES',
    '<span>Title<\/span>',
    'RESET RENDER',
  ]) assert.match(devControls, new RegExp(token));
  for (const token of ['Anchor', 'Offset X', 'Offset Y', 'Label visible']) {
    assert.doesNotMatch(devControls, new RegExp(`<span>${token}<\\/span>`));
  }
  assert.doesNotMatch(prototypeSources, /IDENTITY|COLLECTIONS|ARCHIVE|DROPS|CURATED/);
});

test('prototype uses the canonical artboard and normalized free-placement bounds', () => {
  assert.match(source, /CANONICAL_LATTICE_ARTBOARD/);
  assert.match(fixtureSource, /x: 0\.46, y: 0\.13, width: 0\.4, height: 0\.4 \* \(16 \/ 9\) \* \(2000 \/ 4636\)/);
  assert.doesNotMatch(prototypeSources, /scaledFixturePlacement|columnSpan|rowSpan/);
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
    assert.match(devControls, new RegExp(`'${field}'`));
  }
  assert.doesNotMatch(controller, /velocity|inertia|friction|spring/iu);
});
