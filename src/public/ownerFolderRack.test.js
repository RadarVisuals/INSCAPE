import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('./OwnerFolderRack.jsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
const visitorRack = readFileSync(new URL('../profileDocument/components/PublishedInventoryRack.jsx', import.meta.url), 'utf8');
const visitorBoard = readFileSync(new URL('../profileDocument/components/PublishedRackBoard.jsx', import.meta.url), 'utf8');
const visitorWorld = readFileSync(new URL('../profileDocument/components/PublishedHomeWorld.jsx', import.meta.url), 'utf8');

test('folder authoring is an owner-only rack control backed by the Library workspace', () => {
  assert.match(shell, /ownerAuthoringEnabled && !ownerWorkspaceOpen/);
  assert.match(shell, /<OwnerFolderRack folders=\{ownerFolders\}/);
  assert.match(shell, /state\.setFolderVisitorVisibility/);
  assert.match(component, /Create private folder/);
  assert.match(component, /Make public/);
  assert.match(component, /Make private/);
  assert.doesNotMatch(component, /useLibraryStore|localStorage|sessionStorage|indexedDB|writeContract|fetch\(/);
});

test('private folder authoring is not imported into the detached visitor renderer', () => {
  assert.doesNotMatch(visitorRack + visitorBoard + visitorWorld, /OwnerFolderRack|OwnerInventoryRack|OwnerRackBoard|ownerFolders|setFolderVisitorVisibility|workspace\.folders/);
});
