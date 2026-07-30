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
const styles = readFileSync(new URL('./ownerLatticeShell.css', import.meta.url), 'utf8');
const PROFILE = '0x1111111111111111111111111111111111111111';

test('temporary owner lattice value follows the complete Phase 2A contract and active profile scope', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const publication = projectLatticeProductionPublication(draft, [], {
    lastPublished: '1970-01-01T00:00:00.000Z',
  });
  assert.equal(validateLatticeProductionPublication(publication).valid, true);
  assert.equal(draft.profileAddress, PROFILE);
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
    'Reconciliation', 'ProfileDocument', 'IPFS', 'PublishedProfile',
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
  assert.doesNotMatch(source, /commands=|requestPlacement|toggleFavorite|createCategory|setCategory/);
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
  assert.match(source, /queueMicrotask\(\(\) => browserToolRef\.current\?\.focus/);
  assert.match(source, /onRequestClose=\{closeBrowser\}/);
  assert.match(source, /open=\{browserOpen\}/);
  assert.match(source, /toolButtonRefs=\{\{ browser: browserToolRef \}\}/);
});

test('Phase 5B composition stays in an owner-only projection-derived layer and cannot start table navigation', () => {
  assert.match(source, /LatticeProductionMovementLayer/);
  assert.match(source, /createLatticeProductionMovementCandidate/);
  assert.match(source, /createLatticeProductionResizeCandidate/);
  assert.match(source, /createLatticeProductionCropCandidate/);
  assert.match(source, /compositionPreview/);
  assert.match(source, /onCommitMove=\{authoring\.movePublicPlacement\}/);
  assert.match(source, /onCommitResize=\{authoring\.resizePublicPlacement\}/);
  assert.match(source, /onCommitRemove=\{authoring\.removePublicPlacement\}/);
  assert.match(source, /onCommitCrop=\{authoring\.cropPublicPlacement\}/);
  assert.match(source, /onCommitLayer=\{authoring\.layerPublicPlacement\}/);
  assert.match(source, /onCropModeChange=\{setCropModeActive\}/);
  assert.match(source, /onPreviewOperation=\{setCompositionPreview\}/);
  assert.match(source, /data-lattice-placement-action/);
  assert.match(source, /\[data-lattice-placement-layer\]/);
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
