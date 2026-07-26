import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panelSource = readFileSync(new URL('./ProfileDocumentPanel.jsx', import.meta.url), 'utf8');
const ownerSource = readFileSync(new URL('../../public/ModuleGridShell.jsx', import.meta.url), 'utf8');
const ownerPublicationSource = readFileSync(new URL('../../public/useOwnerPublicationSync.js', import.meta.url), 'utf8');

test('Share previews the current draft without preparing a publication snapshot', () => {
  assert.match(panelSource, /onPreview\('draft'\)\}>Preview current draft/);
  assert.match(panelSource, /Prepare publication snapshot/);
  assert.doesNotMatch(panelSource, /disabled=\{!snapshot\} onClick=\{\(\) => onPreview\('snapshot'\)\}/);
  assert.match(ownerSource, /enterPreview\(source, source === 'draft' \? draftDocument : undefined\)/);
  assert.match(ownerSource, /draft=\{draftDocument\}/);
  assert.match(ownerSource, /<ProfileDocumentPreview[^>]*onMoveKeeper=\{residentHandoff\?\.moveToScreenPosition\}/);
  assert.match(ownerSource, /<ProfileDocumentPreview[^>]*onMoveKeeperHorizontally=\{residentHandoff\?\.moveHorizontallyToScreenPosition\}/);
});

test('owner autosave reports source failures and flushes again when the page exits', () => {
  assert.match(ownerPublicationSource, /const librarySaved = flushLibraryWorkspace\(\)/);
  assert.match(ownerPublicationSource, /const signalsSaved = flushSignalDocument\(\)/);
  assert.match(ownerPublicationSource, /saveRestoredPresentation\(window\.localStorage, workspace\.profileAddress/);
  assert.match(ownerPublicationSource, /setDraftSaveState\(\{ profileAddress: workspace\.profileAddress, status: saved \? 'saved' : 'error' \}\)/);
  assert.match(ownerPublicationSource, /window\.addEventListener\('pagehide', flush\)/);
  assert.match(ownerPublicationSource, /window\.addEventListener\('beforeunload', flush\)/);
  assert.match(panelSource, /'SAVE FAILED'/);
});

test('rack architecture and publication shortcuts are absent from the recovered workflow', () => {
  assert.doesNotMatch(ownerSource, /OwnerRackBoard|profileRackPresentation|saveProfileRackPresentation/);
  assert.match(panelSource, /disabled=\{!snapshot \|\| stale/);
  assert.match(panelSource, /publication\.verifyCid\(snapshot, cid, \{ stale \}\)/);
});
