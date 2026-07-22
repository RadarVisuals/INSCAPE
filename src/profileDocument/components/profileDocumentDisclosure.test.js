import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panelSource = readFileSync(new URL('./ProfileDocumentPanel.jsx', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('./ProfileDocumentPreview.jsx', import.meta.url), 'utf8');
const previewCss = readFileSync(new URL('./profileDocumentPreview.css', import.meta.url), 'utf8');
const ownerSource = readFileSync(new URL('../../public/ModuleGridShell.jsx', import.meta.url), 'utf8');
const ownerWorldSource = readFileSync(new URL('../../public/OwnerHomeWorld.jsx', import.meta.url), 'utf8');
const ownerRackCss = readFileSync(new URL('../../public/ownerRackHome.css', import.meta.url), 'utf8');
const keeperPresentationSource = readFileSync(new URL('./KeeperPresentationLayer.jsx', import.meta.url), 'utf8');
const keeperPresentationCss = readFileSync(new URL('./keeperPresentation.css', import.meta.url), 'utf8');

test('owner Share exposes explicit semantic disclosure controls', () => {
  assert.match(panelSource, /Public identity/);
  assert.match(panelSource, /aria-pressed=\{identityDisclosure\?\.bio === true\}/);
  assert.match(panelSource, /aria-pressed=\{identityDisclosure\?\.linksTags === true\}/);
  assert.match(panelSource, /Changes save to your draft immediately/);
  assert.match(panelSource, /Prepare a publication snapshot only when you are ready to publish/);
});

test('both draft fingerprinting and snapshot construction bind the persisted rack presentation', () => {
  assert.equal(ownerSource.match(/rackPresentation: profileRackPresentation/g)?.length, 2);
  assert.match(ownerSource, /saveProfileRackPresentation\(window\.localStorage, workspace\.profileAddress, next\)/);
  assert.match(ownerSource, /setIdentityModuleOrder\(current, orderedIds\)/);
  assert.match(ownerSource, /ownerAuthoringEnabled && activeHudCommand === 'share'/);
  assert.match(ownerSource, /onIdentityDisclosureChange=\{updateIdentityDisclosure\}/);
  assert.match(ownerSource, /draft=\{draftDocument\}/);
  assert.match(panelSource, /const current = imported \|\| draft \|\| snapshot/);
});

test('owner preview uses the same detached published world as a real visitor', () => {
  assert.match(previewSource, /import PublishedHomeWorld from '\.\/PublishedHomeWorld\.jsx'/);
  assert.match(previewSource, /<PublishedHomeWorld document=\{document\} onMoveKeeper=\{onMoveKeeper\}/);
  assert.doesNotMatch(previewSource, /ProfileDocumentSurface|ProfileDocumentSpaceWindow/);
  assert.match(ownerSource, /onMoveKeeper=\{moveKeeperFromHome\}/);
  assert.match(ownerSource, /enterPreview\(source, source === 'draft' \? draftDocument : undefined\)/);
  assert.match(panelSource, /onClick=\{\(\) => onPreview\('draft'\)\}>Preview current draft/);
  assert.doesNotMatch(panelSource, /disabled=\{!snapshot\} onClick=\{\(\) => onPreview\('snapshot'\)\}/);
  assert.match(previewCss, /z-index:\s*150/);
  assert.match(previewCss, /bottom:\s*max\(18px, env\(safe-area-inset-bottom\)\)/);
  assert.match(previewCss, /pointer-events:\s*auto/);
});

test('Keeper presentation is Preview-only, accessible, and receives only bounded runtime adapters', () => {
  assert.match(previewSource, /<KeeperPresentationLayer reactionBridge=\{reactionBridge\} positionTracker=\{positionTracker\} reducedMotion=\{reducedMotion\}/);
  assert.match(ownerSource, /reactionBridge=\{keeperReactions\} positionTracker=\{residentHandoff\} reducedMotion=\{revealPresentation\.reducedMotion\}/);
  assert.match(ownerSource, /if \(previewDocument\) return undefined;[\s\S]*trackActorPosition/);
  assert.match(keeperPresentationSource, /positionTracker\?\.trackActorPosition\?\.\(presentationRef\.current\)/);
  assert.match(keeperPresentationSource, /resolveKeeperBubblePlacement/);
  assert.match(keeperPresentationCss, /--keeper-bubble-left/);
  assert.doesNotMatch(keeperPresentationCss, /keeper-presentation__line::before/);
  assert.doesNotMatch(keeperPresentationCss, /border-left/);
  assert.match(keeperPresentationSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(keeperPresentationCss, /keeper-presentation__line \{[\s\S]*pointer-events:\s*none/);
  assert.match(keeperPresentationCss, /keeper-presentation__line button \{[\s\S]*pointer-events:\s*auto/);
  assert.match(keeperPresentationSource, /document\.addEventListener\('visibilitychange', syncVisibility\)/);
  assert.match(keeperPresentationSource, /aria-label="Keeper presentation controls"/);
  assert.match(keeperPresentationSource, /aria-live="polite"/);
  assert.match(keeperPresentationSource, /director\.stop\(\)/);
  assert.doesNotMatch(keeperPresentationSource, /useLibraryStore|useSignalStore|localStorage|profileDocumentBuilder|wallet/i);
  assert.match(keeperPresentationCss, /pointer-events:\s*none/);
  assert.match(keeperPresentationCss, /@media \(max-width:\s*719px\)/);
  assert.match(keeperPresentationCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test('verified owners enter the rack world by default and retain an explicit authoring workspace', () => {
  assert.match(ownerSource, /const \[ownerWorkspaceOpen, setOwnerWorkspaceOpen\] = useState\(false\)/);
  assert.match(ownerSource, /if \(ownerAuthoringEnabled && !ownerWorkspaceOpen\)/);
  assert.match(ownerSource, /<OwnerHomeWorld document=\{draftDocument\}/);
  assert.match(ownerSource, /onIdentityModuleOrderChange=\{updateIdentityModuleOrder\}/);
  assert.match(ownerSource, /\[ Rack View \]/);
  assert.match(ownerWorldSource, /aria-label="Owner profile controls"/);
  assert.match(ownerRackCss, /\.owner-rack-home \.profile-document-panel/);
  assert.equal(ownerRackCss.match(/pointer-events:\s*auto/g)?.length, 2);
  assert.match(ownerRackCss, /padding-bottom:\s*52px/);
});

test('owner draft status is based on successful source flushes and flushes again when the page exits', () => {
  assert.match(ownerSource, /const librarySaved = flushLibraryWorkspace\(\)/);
  assert.match(ownerSource, /const signalsSaved = flushSignalDocument\(\)/);
  assert.match(ownerSource, /saveProfileRackPresentation\(window\.localStorage, workspace\.profileAddress, profileRackPresentation\)/);
  assert.match(ownerSource, /saveRestoredPresentation\(window\.localStorage, workspace\.profileAddress/);
  assert.match(ownerSource, /window\.addEventListener\('pagehide', flush\)/);
  assert.match(ownerSource, /window\.addEventListener\('beforeunload', flush\)/);
  assert.match(ownerSource, /controls=\{\{save:draftSaveStatus/);
  assert.match(ownerRackCss, /owner-rack-home__controls :is\(button, output\)/);
  assert.match(ownerWorldSource, /owner-rack-home__save-status" data-state=\{controls\.save\}/);
  assert.match(panelSource, /'SAVE FAILED'/);
});

test('owner authored layout reads and writes only through profile-scoped migration storage', () => {
  assert.match(ownerSource, /loadProfileModulePositions\(window\.localStorage,profileAddress,geometry\)/);
  assert.match(ownerSource, /saveProfileModulePositions\(window\.localStorage, workspace\.profileAddress, positions\)/);
  assert.match(ownerSource, /saveProfileSystemPresentation\(window\.localStorage, workspace\.profileAddress, systemPresentation\)/);
  assert.doesNotMatch(ownerSource, /localStorage\.setItem\(MODULE_LAYOUT_STORAGE_KEY/);
  assert.doesNotMatch(ownerSource, /localStorage\.setItem\(SYSTEM_SCENE_KEY/);
});

test('finishing identity arrangement explicitly commits the current order and resynchronizes from the saved rack', () => {
  const identityRackSource = readFileSync(new URL('./PublishedIdentityRack.jsx', import.meta.url), 'utf8');
  assert.match(identityRackSource, /if \(!arranging\) setOrder\(initialOrder\)/);
  assert.match(identityRackSource, /if \(arranging\) \{[\s\S]*setArranging\(false\);[\s\S]*onOrderChange\?\.\(\[\.\.\.order\]\)/);
  assert.match(identityRackSource, /onClick=\{toggleArranging\}/);
  assert.doesNotMatch(identityRackSource, /setArranging\(\(value\) => \{[\s\S]*onOrderChange/);
});
