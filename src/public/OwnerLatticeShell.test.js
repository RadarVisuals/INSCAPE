import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createEmptyLatticeProductionDraft,
  validateLatticeProductionDraft,
} from '../lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../lattice/domain/latticeProductionAdapter.js';
import { validateLatticeProductionPublication } from '../lattice/domain/latticeProductionPublication.js';

const source = readFileSync(new URL('./OwnerLatticeShell.jsx', import.meta.url), 'utf8');
const authoringSource = readFileSync(new URL('./useOwnerLatticeAuthoring.js', import.meta.url), 'utf8');
const previewBuilderSource = readFileSync(new URL('./ownerLatticePreviewDocument.js', import.meta.url), 'utf8');
const publicationRackSource = readFileSync(new URL('./OwnerLatticePublicationRack.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./ownerLatticeShell.css', import.meta.url), 'utf8');
const PROFILE = '0x1111111111111111111111111111111111111111';

test('temporary owner lattice value follows the complete Phase 2A contract and active profile scope', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const publication = projectLatticeProductionPublication(draft, [], {
    lastPublished: '1970-01-01T00:00:00.000Z',
  });
  assert.equal(validateLatticeProductionPublication(publication).valid, true);
  assert.equal(draft.profileAddress, PROFILE);
  assert.equal(draft.appearance.surfaceId, 'mist');
  assert.equal(draft.appearance.menuSurfaceId, 'mist');
  assert.equal(Object.hasOwn(publication, 'profileAddress'), false);
  assert.equal(Object.hasOwn(publication, 'activeTable'), false);
  assert.match(source, /normalizeProfileAddress\(profileAddress\)/);
  assert.match(source, /createEmptyLatticeProductionDraft\(profile\)/);
  assert.match(source, /projectLatticeProductionPublication\(draft, \[\]/);
  assert.match(source, /assertValidLatticeProductionPublication\(publication\)/);
});

test('invalid profiles fail closed before a render value can be produced', () => {
  assert.equal(validateLatticeProductionDraft(createEmptyLatticeProductionDraft('invalid profile')).valid, false);
  assert.match(source, /if \(!profile\) throw new TypeError/);
  assert.match(source, /profileAddress !== viewedAddress/);
  assert.match(source, /function OwnerLatticeRuntime/);
  assert.match(source, /export default function OwnerLatticeShell\(props\)/);
  assert.match(source, /return <OwnerLatticeRuntime/);
  const innerSource = source.slice(source.indexOf('function OwnerLatticeRuntime'), source.indexOf('export default function OwnerLatticeShell'));
  assert.doesNotMatch(innerSource, /ownerAuthoringEnabled|return null/);
});

test('Phase 5B shell delegates repeated canonical PLACE without expanding unrelated boundaries', () => {
  for (const forbidden of [
    'localStorage', 'sessionStorage', 'indexedDB', 'latticeProductionDraftStore',
    'Reconciliation', 'IPFS', 'PublishedProfile',
    'LatticeEnginePrototype', 'latticeEngineFixtures', 'ModuleGridShell',
  ]) assert.doesNotMatch(source, new RegExp(forbidden, 'iu'));
  assert.match(source, /LatticeProductionTableRenderer/);
  assert.match(source, /KeeperDock/);
  assert.match(source, /BrowserWorkspace/);
  assert.match(source, /useOwnerLatticeBrowser/);
  assert.match(source, /useOwnerLatticeAuthoring/);
  assert.match(source, /placePublicAsset/);
  assert.match(source, /ownerLatticePlacementUnavailableReason/);
  assert.match(authoringSource, /PUBLIC PLACEMENT UNAVAILABLE \/ PRIVATE TABLE/);
  assert.match(authoringSource, /generatePlacementId/);
  assert.doesNotMatch(authoringSource, /ADDITIONAL PLACEMENT REQUIRES NEXT AUTHORING SLICE/);
  assert.match(source, /STORED RECORD PRESERVED \/ EXPLICIT RECOVERY REQUIRED/);
  assert.match(source, /categoryCommands=\{browserCategoryCommands\}/);
  assert.doesNotMatch(source, /requestPlacement|toggleFavorite|commitCategoryForProfile/);
});

test('navigation owns one runtime destination while minimap requests remain exact', () => {
  assert.match(source, /finishPointerGesture/);
  assert.match(source, /resolveWheelDestination/);
  assert.match(source, /latticeDestination\(activeRef\.current, direction\)/);
  assert.match(source, /onNavigate=\{navigateDirectly\}/);
  assert.match(source, /settle\(destination\)/);
  assert.doesNotMatch(source, /stepToward|intermediate|navigationQueue/iu);
});

test('fixed chrome stays outside the moving authored-plane stage', () => {
  assert.match(source, /createPortal\(spatialSurface, spatialRoot\)/);
  assert.match(styles, /\.owner-lattice-stage[^}]*will-change: transform/);
  assert.match(styles, /\.owner-lattice-signature[^}]*position: fixed/);
  assert.match(styles, /\.owner-lattice-theme[^}]*position: fixed/);
  assert.match(source, /disabled: true/);
  assert.match(source, /SESSION ONLY \/ NOT PERSISTED/);
});

test('owner viewport fills all 32 columns and keeps bounded per-table Space-drag camera state runtime-only', () => {
  assert.match(source, /createWidthFitLatticeOwnerViewport\(dimensions\)/);
  assert.match(source, /updateLatticeOwnerCameraY/);
  assert.match(source, /cameraOffsets\[activeTableId\]/);
  assert.match(source, /event\.code === 'Space'/);
  assert.match(source, /onPointerDownCapture=\{handlePointerDownCapture\}/);
  assert.match(source, /active\.y \* plane\.height\) \+ activeCameraY/);
  assert.match(styles, /\.owner-lattice-table \.lattice-production-table[^}]*background-image: none/);
  assert.doesNotMatch(source, /Math\.min\(dimensions\.width \/ 32, dimensions\.height \/ 18\)/);
});

test('Browser open, close, and Escape state stays runtime-only with focus restoration', () => {
  assert.match(source, /const \[browserOpen, setBrowserOpen\] = useState\(false\)/);
  assert.match(source, /const \[railCollapsed, setRailCollapsed\] = useState\(true\)/);
  assert.match(source, /useEffect\(\(\) => setRailCollapsed\(true\), \[profileAddress\]\)/);
  assert.match(source, /const \[browserActiveTab, setBrowserActiveTab\] = useState\('index'\)/);
  assert.match(source, /id: 'categories', label: 'CATEGORIES', note: 'ORGANIZE \/ PROFILE SCOPED'/);
  assert.doesNotMatch(source, /id: 'categories'[^\n]*disabled: true/);
  assert.match(source, /setBrowserTabRequest\(\(current\) => \(\{ id: 'categories', requestId:/);
  assert.match(source, /onEntryActivate=\{\(entryId, trigger\) =>/);
  assert.match(source, /if \(entryId === 'categories'\) openCategories\(trigger\)/);
  assert.match(source, /activeEntryId=\{browserOpen && browserActiveTab === 'categories' \? 'categories' : null\}/);
  assert.match(source, /const returnFocus = browserReturnFocusRef\.current \|\| browserToolRef\.current/);
  assert.match(source, /returnFocus\?\.isConnected && returnFocus\.focus/);
  assert.match(source, /onRequestClose=\{closeBrowser\}/);
  assert.match(source, /onActiveTabChange=\{setBrowserActiveTab\}/);
  assert.match(source, /open=\{browserOpen\}/);
  assert.match(source, /tabRequest=\{browserTabRequest\}/);
  assert.match(source, /activeToolIds=\{\[browserOpen \? 'browser' : null, publicationOpen \? 'publish' : null, themeOpen \? 'theme' : null\]\.filter\(Boolean\)\}/);
  assert.match(source, /activeWorkspaceWindowRef\.current = 'browser'/);
  assert.match(source, /activeWorkspaceWindowRef\.current = 'theme'/);
  assert.match(source, /const activateWorkspaceTool = useCallback\(\(toolId, trigger\) =>/);
  assert.match(source, /if \(toolId === 'browser'\) \{\s*browserReturnFocusRef\.current = trigger \|\| browserToolRef\.current;\s*activeWorkspaceWindowRef\.current = 'browser';\s*setBrowserActivated\(true\);\s*setBrowserOpen\(\(open\) => !open\);\s*\}/);
  assert.match(source, /if \(toolId === 'theme'\) \{\s*activeWorkspaceWindowRef\.current = 'theme';\s*if \(trigger\) setThemeAnchor\(frozenRectangle\(trigger\.getBoundingClientRect\(\)\)\);\s*setThemeOpen\(\(open\) => !open\);\s*\}/);
  assert.match(source, /toolButtonRefs=\{\{ browser: browserToolRef, preview: previewToolRef, publish: publishToolRef \}\}/);
  assert.match(source, /workspaceTools=\{RACK_AUTHORING_TOOLS\.map/);
  assert.match(source, /systemTools=\{RACK_SYSTEM_TOOLS\}/);
  assert.match(source, /onWorkspaceToolActivate=\{activateWorkspaceTool\}/);
});

test('Phase 8B publication stays lazy, owner-only, and explicit at every irreversible action', () => {
  assert.match(source, /\{ id: 'publish', label: 'PUBLISH' \}/);
  assert.match(source, /lazy\(\(\) => import\('\.\/OwnerLatticePublicationRack\.jsx'\)\)/);
  assert.match(source, /if \(toolId === 'publish'\) \{[\s\S]*setPublicationOpen\(\(open\) => !open\)/);
  assert.match(source, /getWalletPublicationContext=\{getWalletPublicationContext\}/);
  assert.match(source, /latticeDraft=\{authoring\.draft\}/);
  assert.match(source, /onPublished=\{\(\) => onPublicationConfirmed\?\.\(\)\}/);
  assert.doesNotMatch(source, /uploadProfileDocument|createProfileDocumentPublisher|createCanonicalPublication|walletClient|publicClient/);
  assert.match(publicationRackSource, /PREPARE SNAPSHOT/);
  assert.match(publicationRackSource, /UPLOAD \+ VERIFY/);
  assert.match(publicationRackSource, /PUBLISH VERSION 8/);
  assert.match(publicationRackSource, /publication\.publish\(\)/);
  assert.doesNotMatch(publicationRackSource, /localStorage|sessionStorage|Pinata|PINATA_JWT/);
});

test('Phase 5B composition stays in an owner-only projection-derived layer and cannot start table navigation', () => {
  assert.match(source, /LatticeProductionMovementLayer/);
  assert.match(source, /createLatticeProductionMovementCandidate/);
  assert.match(source, /createLatticeProductionResizeCandidate/);
  assert.match(source, /createLatticeProductionGroupResizeCandidate/);
  assert.match(source, /createLatticeProductionCropCandidate/);
  assert.match(source, /compositionPreview/);
  assert.match(source, /onCommitMove=\{authoring\.movePublicPlacement\}/);
  assert.match(source, /onCommitMoveGroup=\{authoring\.movePublicPlacements\}/);
  assert.match(source, /onCommitRemoveGroup=\{authoring\.removePublicPlacements\}/);
  assert.match(source, /onSelectedPlacementsChange=\{\(placementIds\) => setSelectedPlacementIds/);
  assert.match(source, /createLatticeProductionGroupMovementCandidate\(authoring\.draft, compositionPreview\.request\)/);
  assert.match(source, /authoring\.duplicatePublicPlacements/);
  assert.match(source, /authoring\.transformPublicPlacements/);
  assert.match(source, /onCommitResize=\{authoring\.resizePublicPlacement\}/);
  assert.match(source, /onCommitResizeGroup=\{authoring\.resizePublicPlacements\}/);
  assert.match(source, /onCommitRemove=\{authoring\.removePublicPlacement\}/);
  assert.match(source, /onCommitCrop=\{authoring\.cropPublicPlacement\}/);
  assert.match(source, /onCommitLayer=\{authoring\.layerPublicPlacement\}/);
  assert.match(source, /onCropModeChange=\{setCropModeActive\}/);
  assert.match(source, /onPreviewOperation=\{setCompositionPreview\}/);
  assert.match(source, /data-lattice-placement-action/);
  assert.match(source, /!keeperClickToMoveTargetAllowed\(event\.target\)/);
  assert.doesNotMatch(source, /normalizedInsertionAnchor|createPlacementGesture|nudgePlacementByPixels/);
});

test('active crop suspends every table-navigation entry while Space camera capture remains first', () => {
  assert.match(source, /const \[cropModeActive, setCropModeActive\] = useState\(false\)/);
  assert.match(source, /if \(cropModeActive \|\| spacePressedRef\.current/);
  assert.match(source, /if \(cropModeActive \|\| settlingRef\.current \|\| gestureRef\.current/);
  assert.match(source, /if \(cropModeActive && keyboardDirection\(event\.key\)\)/);
  assert.match(source, /if \(cropModeActive \|\| settlingRef\.current \|\| gestureRef\.current \|\| sameCoordinate/);
  assert.ok(source.indexOf("if (event.code === 'Space')") < source.indexOf('if (cropModeActive && keyboardDirection(event.key))'));
  assert.match(source, /onPointerDownCapture=\{handlePointerDownCapture\}/);
});

test('Phase 6 ARRANGE is one session-only owner mode and viewer activation remains decoded and Enter-only', () => {
  assert.match(source, /const \[surfaceId, setSurfaceId\] = useState\('mist'\)/);
  assert.match(source, /const \[menuSurfaceId, setMenuSurfaceId\] = useState\('mist'\)/);
  assert.match(source, /const \[arrangeEnabled, setArrangeEnabled\] = useState\(false\)/);
  assert.match(source, /arrangeEnabled \? authoringPlacementUnavailableReason : 'PLACE REQUIRES ARRANGE'/);
  assert.match(source, /if \(destination\) authoring\.placePublicAsset/);
  assert.match(source, /arrangeEnabled && sameCoordinate\(coordinate, active\).*LatticeProductionMovementLayer/su);
  assert.match(source, /!arrangeEnabled && sameCoordinate\(coordinate, active\) \? openPlacementViewer/);
  assert.match(source, /if \(arrangeEnabled\) \{\s*setCompositionPreview\(null\);\s*setSelectedPlacementId\(null\);\s*\}/);
  assert.match(source, /setArrangeEnabled\(!arrangeEnabled\)/);
  assert.match(source, /mediaState\?\.status !== 'ready' \|\| !mediaState\.dimensions/);
  assert.match(source, /<LatticeFocusViewer/);
  assert.match(source, /surfaceColor="var\(--lattice-menu-panel\)"/);
  assert.doesNotMatch(source, /transparencyMode.*dossier|collectionName.*dossier|marketplace/iu);
});

test('Phase 7 Identity Dossier has strict owner-runtime precedence and exact trigger focus restoration', () => {
  assert.match(source, /useProfileContractFacts\(profileAddress, \{ enabled: Boolean\(identityDossierOpening \|\| identityDossierSession\) \}\)/);
  assert.match(source, /createProductionIdentityDossierViewModel/);
  assert.match(source, /const \[identityDossierSession, setIdentityDossierSession\] = useState\(null\)/);
  assert.match(source, /viewerSession \|\| gestureRef\.current \|\| cameraGestureRef\.current \|\| cropModeActive \|\| compositionPreview/);
  assert.match(source, /preloadIdentityProfileImage\(identityDossier\.profile\.avatarUrl\)/);
  assert.match(source, /const originRectangle = frozenRectangle\(source\.getBoundingClientRect\(\)\)/);
  assert.match(source, /identityDisabled=\{Boolean\(identityDossierOpening \|\| identityDossierSession/);
  assert.match(source, /identitySourceHidden=\{Boolean\(identityDossierSession\)\}/);
  assert.match(source, /onIdentityActivate=\{openIdentityDossier\}/);
  assert.match(source, /getReturnRectangle=\{\(\) => identityDossierSession\.originRectangle\}/);
  assert.match(source, /requestAnimationFrame\(\(\) => identityControlRef\.current\?\.focus\(\{ preventScroll: true \}\)\)/);
  assert.match(source, /onClosed=\{closeIdentityDossier\}/);
  const identityOpenSource = source.slice(source.indexOf('const openIdentityDossier'), source.indexOf('const closeIdentityDossier'));
  assert.doesNotMatch(identityOpenSource, /setArrangeEnabled\(false\)/);
});

test('Phase 8A Owner Preview builds and validates v8 before entering the shared visitor boundary', () => {
  assert.match(source, /\{ id: 'preview', label: 'PREVIEW' \}/);
  assert.match(source, /import\('\.\/ownerLatticePreviewDocument\.js'\)/);
  assert.match(previewBuilderSource, /version: PROFILE_DOCUMENT_VERSION_8/);
  assert.match(previewBuilderSource, /lattice: projectLatticeProductionPublication/);
  assert.match(previewBuilderSource, /return assertValidProfileDocument/);
  assert.match(source, /latticeDraft: authoring\.draft/);
  assert.match(source, /await preloadOwnerLatticePreviewEntryMedia\(preview\)/);
  assert.match(source, /authoring\.missingReferencedAssets/);
  assert.match(source, /if \(toolId === 'preview'\) startOwnerPreview\(trigger\)/);
  assert.match(source, /<ProfileDocumentPreview document=\{previewDocument\} onExit=\{stopOwnerPreview\}/);
  assert.match(source, /finishCameraGesture\(true\)/);
  assert.doesNotMatch(source, /\bfinishCamera\(/);
  assert.match(source, /setCompositionPreview\(null\)/);
  assert.match(source, /setArrangeEnabled\(false\)/);
  assert.match(source, /returnFocus\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(source + previewBuilderSource, /saveProfileSnapshot|uploadProfileDocument|createCanonicalPublication/);
});

test('Phase 7.5 delegates cursor follow and follow-disabled click-to-move without stealing interaction ownership', () => {
  assert.match(source, /createKeeperPointerFollowScheduler/);
  assert.match(source, /keeperPointerFollowAllowed/);
    assert.match(source, /keeperClickToMoveAllowed/);
    assert.match(source, /keeperClickToMoveTargetAllowed/);
  assert.match(source, /keeperPointerTarget/);
  assert.match(source, /residentHandoff\?\.moveToScreenPosition\?\.\(clientX, clientY, \{[\s\S]*reducedMotion: revealPresentation\.reducedMotion === true/);
  assert.match(source, /continuous: true/);
  assert.match(source, /onDockStateChange=\{setKeeperDockActive\}/);
  assert.match(source, /followCursor=\{keeperFollowCursor\}/);
  assert.match(source, /movementSpeed=\{keeperMovementSpeed\}/);
  assert.match(source, /onFollowCursorChange=\{setKeeperFollowCursor\}/);
  assert.match(source, /onMovementSpeedChange=\{setKeeperMovementSpeed\}/);
  assert.match(source, /arrangeEnabled,[\s\S]*cropModeActive,[\s\S]*gestureActive,[\s\S]*keeperDockActive,[\s\S]*viewerActive/);
  assert.match(source, /const target = keeperPointerTarget\(event, event\.currentTarget\.getBoundingClientRect\(\)\);[\s\S]*keeperPointerTargetRef\.current = target;[\s\S]*if \(!keeperPointerFollowEnabled\) return;[\s\S]*keeperPointerFollowRef\.current\?\.push\(target\);/);
    assert.match(source, /const wasClick = !gestureRef\.current\.gesture\.activated;[\s\S]*finishGesture\(false\);[\s\S]*if \(wasClick && keeperClickToMoveEnabled && keeperClickToMoveTargetAllowed\(event\.target\)\)[\s\S]*continuous: false/);
  assert.ok(source.indexOf('const activeCameraGesture = cameraGestureRef.current') < source.indexOf('keeperPointerTarget(event'));
  assert.ok(source.indexOf('const activeGesture = gestureRef.current') < source.indexOf('keeperPointerTarget(event'));
});
