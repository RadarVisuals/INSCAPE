import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./VisitorLatticeWorld.jsx', import.meta.url), 'utf8');
const selector = readFileSync(new URL('./PublishedProfileDocumentPreview.jsx', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../../lattice/rendering/LatticeProductionTableRenderer.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./visitorLatticeWorld.css', import.meta.url), 'utf8');

test('v8 selects one visitor-safe lattice world while legacy rendering remains the rollback', () => {
  assert.match(selector, /selectPublishedProfileRuntime\(document\)/);
  assert.match(selector, /<VisitorLatticeWorld document=\{document\}/);
  assert.match(selector, /<PublishedHomeWorld document=\{document\}/);
});

test('visitor lattice owns only transient navigation and reads canonical appearance', () => {
  assert.match(source, /assertValidLatticeProductionPublication\(document\.lattice\)/);
  assert.match(source, /entryLatticeCoordinate/);
  assert.match(source, /finishPointerGesture/);
  assert.match(source, /resolveWheelDestination/);
  assert.match(source, /keyboardDirection/);
  assert.match(source, /LatticeNavigationOverlay/);
  assert.match(source, /LatticeProductionTableRenderer/);
  assert.match(source, /createWidthFitLatticeOwnerViewport/);
  assert.match(source, /updateLatticeOwnerCameraY/);
  assert.match(source, /lattice\.appearance\.surfaceId/);
  assert.match(source, /lattice\.appearance\.menuSurfaceId/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|useLibraryStore|useSignalStore|ownerAuthoring|uploadProfile|createCanonicalPublication|wallet/iu);
});

test('the active visitor table bypasses transformed-stage native lazy-load starvation', () => {
  assert.match(source, /imageLoading=\{sameCoordinate\(coordinate, active\) \? 'eager' : 'lazy'\}/);
  assert.match(renderer, /imageLoading = 'lazy'/);
  assert.match(renderer, /loading=\{imageLoading\}/);
});

test('visitor navigation enables snapping in the same frame that changes destination', () => {
  const settle = source.slice(source.indexOf('const settle'), source.indexOf('const finishGesture'));
  assert.doesNotMatch(settle.slice(0, settle.indexOf('requestAnimationFrame')), /setActive\(destination\)/);
  assert.match(settle, /requestAnimationFrame\(\(\) => \{\s*activeRef\.current = destination;\s*setActive\(destination\);\s*setSnapping\(true\)/);
});

test('an unactivated visitor click never starts a redundant table snap', () => {
  const finish = source.slice(source.indexOf('const finishGesture ='), source.indexOf('const navigate ='));
  assert.match(finish, /if \(!current\.gesture\.activated\) \{[\s\S]*setDragOffset\(\{ x: 0, y: 0 \}\);[\s\S]*return;/);
  assert.ok(finish.indexOf('if (!current.gesture.activated)') < finish.indexOf('settle('));
});

test('owner Preview overrides the inert interface layer and restores keyboard focus on pointer entry', () => {
  assert.match(styles, /\.visitor-lattice-world[\s\S]*pointer-events: auto/);
  assert.match(source, /rootRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*gestureRef\.current/);
});

test('visitor placements open the accepted production viewer from public projection data only', () => {
  assert.match(source, /LatticeFocusViewer/);
  assert.match(source, /LatticeProductionFocusArtwork/);
  assert.match(source, /trustPublishedMetadata: true/);
  assert.match(source, /onPlacementActivate=\{sameCoordinate\(coordinate, active\) \? openPlacementViewer : undefined\}/);
  assert.match(source, /viewerPlacementId=\{viewerSession\?\.tableId === table\.id \? viewerSession\.placementId : null\}/);
  assert.match(source, /getReturnRectangle=\{\(\) => findPlacementElement\(viewerSession\.placementId\)\?\.getBoundingClientRect\(\)\}/);
  assert.match(source, /inspectionVariant="rack"/);
  assert.doesNotMatch(source, /useLibraryStore|assetRecordsById|luksoRpc|Chillwhales|Envio/iu);
});

test('visitor identity opens the accepted read-only module rack from public projection and live public profile facts', () => {
  assert.match(source, /useProfileIdentity\(document\.profile\.address\)/);
  assert.match(source, /useProfileContractFacts\(document\.profile\.address, \{ enabled: Boolean\(identityOpening \|\| identitySession\) \}\)/);
  assert.match(source, /createPublishedIdentityRackViewModel/);
  assert.match(source, /<LatticeProfileRail/);
  assert.match(source, /<LatticeProductionIdentityDossier/);
  assert.match(source, /menuSurfaceId=\{lattice\.appearance\.menuSurfaceId\}/);
  assert.match(source, /preloadIdentityProfileImage\(identityRack\.profile\.avatarUrl\)/);
  assert.match(source, /identitySourceHidden=\{Boolean\(identitySession\)\}/);
  assert.doesNotMatch(source, /useLibraryStore|assetRecordsById|ownerAuthoring|saveProfile|publishProfile|Persona|Alter Persona/iu);
});

test('NFT activation never primes or retains the visitor table drag gesture', () => {
  const pointerDown = source.slice(source.indexOf('const handlePointerDown ='), source.indexOf('const handlePointerMove ='));
  assert.match(pointerDown, /!keeperClickToMoveTargetAllowed\(event\.target\)/);
  assert.match(source, /const releaseVisitorInputOwnership[\s\S]*gestureRef\.current = null;[\s\S]*cameraGestureRef\.current = null;/);
  assert.match(source, /const closePlacementViewer[\s\S]*releaseVisitorInputOwnership\(\);[\s\S]*setViewerSession\(null\)/);
  assert.match(source, /setDragOffset\(\{ x: 0, y: 0 \}\)/);
  assert.match(source, /onClosed=\{closePlacementViewer\}/);
});

test('visitor reuses the accepted Keeper controller while inspection and navigation retain priority', () => {
  assert.match(source, /createKeeperPointerFollowScheduler/);
  assert.match(source, /keeperPointerFollowAllowed/);
  assert.match(source, /keeperClickToMoveAllowed/);
  assert.match(source, /keeperClickToMoveTargetAllowed/);
  assert.match(source, /continuous: true/);
  assert.match(source, /continuous: false/);
  assert.match(source, /identityActive: Boolean\(identityOpening \|\| identitySession\)/);
  assert.match(source, /viewerActive: Boolean\(viewerSession\)/);
  assert.match(source, /settling: snapping/);
  assert.match(source, /<KeeperDock/);
  assert.match(source, /followCursor=\{keeperFollowCursor\}/);
  assert.match(source, /onFollowCursorChange=\{setKeeperFollowCursor\}/);
  assert.match(source, /onMovementSpeedChange=\{setKeeperMovementSpeed\}/);
  assert.match(source, /residentHandoff=\{keeperDockHandoff\}/);
  assert.doesNotMatch(source, /useLibraryStore|ownerAuthoring|saveProfile|publishProfile/iu);
});

test('identity close releases visitor input ownership before and after its return transition', () => {
  assert.match(source, /const releaseVisitorInputOwnership[\s\S]*wheelAccumulatorRef\.current = \{ x: 0, y: 0 \};[\s\S]*setGestureActive\(false\);[\s\S]*setCameraActive\(false\);[\s\S]*setDragOffset\(\{ x: 0, y: 0 \}\);[\s\S]*setSpacePressed\(false\)/);
  assert.match(source, /const closeIdentityRack[\s\S]*releaseVisitorInputOwnership\(\);[\s\S]*setIdentitySession\(null\)/);
  assert.match(source, /onClosing=\{releaseVisitorInputOwnership\}/);
  assert.match(source, /onClosed=\{closeIdentityRack\}/);
});
