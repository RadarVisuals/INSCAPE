import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const selected = readFileSync(new URL('./ownerRuntimeSelected.js', import.meta.url), 'utf8');
const entry = readFileSync(new URL('./OwnerModul8rShell.jsx', import.meta.url), 'utf8');
const owner = readFileSync(new URL('./OwnerLatticeShell.jsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../lattice/modul8r/Modul8rOwnerWorkspace.jsx', import.meta.url), 'utf8');
const productionPresentation = readFileSync(new URL('./ownerWorkspacePresentation.modul8r.js', import.meta.url), 'utf8');
const rollbackPresentation = readFileSync(new URL('./ownerWorkspacePresentation.lattice.js', import.meta.url), 'utf8');

test('Task 8 selects one complete production-named MODUL-8R owner entry', () => {
  assert.match(selected, /OWNER_RUNTIME_SELECTION = 'MODUL8R'/);
  assert.match(selected, /import\('\.\/OwnerModul8rShell\.jsx'\)/);
  assert.match(entry, /ownerWorkspacePresentation="modul8r"/);
  assert.match(owner, /from '#owner-workspace-presentation'/);
  assert.match(productionPresentation, /import\('\.\.\/lattice\/modul8r\/Modul8rOwnerWorkspace\.jsx'\)/);
  assert.doesNotMatch(owner, /import\('\.\.\/lattice\/modul8r\/Modul8rOwnerLibraryDevelopment\.jsx'\)/);
  assert.doesNotMatch(workspace, /development fixture|\/prototype\/modul-8r|Modul8rOwnerLibraryDevelopment/iu);
});

test('Task 8 keeps one bounded source-level rollback pairing', () => {
  assert.match(selected, /Rollback changes MODUL8R to[\s\S]*LATTICE/);
  assert.match(selected, /\.\/OwnerLatticeShell\.jsx/);
  assert.match(rollbackPresentation, /import\('\.\.\/lattice\/browser\/BrowserWorkspace\.jsx'\)\)/);
  assert.doesNotMatch(productionPresentation, /BrowserWorkspace\.jsx|ActivityBrowser\.jsx|CreationsBrowser\.jsx|SettingsBrowser\.jsx/);
});

test('production MODUL-8R delegates every compatibility launcher without mounting old presentations', () => {
  assert.match(owner, /requestModul8r\('library', trigger/);
  assert.match(owner, /requestModul8r\('activity', trigger/);
  assert.match(owner, /requestModul8r\('people', trigger/);
  assert.match(owner, /!modul8rActive && browserActivated/);
  assert.match(owner, /!modul8rActive && themeOpen/);
  assert.match(owner, /!modul8rActive && SettingsBrowser && CreationsBrowser && ActivityBrowser/);
  assert.match(owner, /!modul8rActive && ProfileDiscoveryBoundary && discoveryOpen/);
});
