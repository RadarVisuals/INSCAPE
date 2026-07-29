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

test('Phase 5B.1 shell delegates one canonical PLACE action without expanding accepted boundaries', () => {
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
  assert.match(authoringSource, /ADDITIONAL PLACEMENT REQUIRES NEXT AUTHORING SLICE/);
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

test('Browser open, close, and Escape state stays runtime-only with focus restoration', () => {
  assert.match(source, /const \[browserOpen, setBrowserOpen\] = useState\(false\)/);
  assert.match(source, /queueMicrotask\(\(\) => browserToolRef\.current\?\.focus/);
  assert.match(source, /onRequestClose=\{closeBrowser\}/);
  assert.match(source, /open=\{browserOpen\}/);
  assert.match(source, /toolButtonRefs=\{\{ browser: browserToolRef \}\}/);
});
