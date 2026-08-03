import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');

test('Task 6 Settings uses the master overflow and shared production Settings controller', async () => {
  const [shell, integration, surface, settings, owner] = await Promise.all([
    read('./Modul8rShell.jsx'), read('./Modul8rOwnerWorkspace.jsx'),
    read('./Modul8rSettingsSurface.jsx'), read('../../public/SettingsBrowser.jsx'),
    read('../../public/OwnerLatticeShell.jsx'),
  ]);
  assert.match(shell, /aria-label="Modulator options"/);
  assert.match(shell, /role="menu"[\s\S]*SETTINGS/);
  assert.match(integration, /onSettingsRequest[\s\S]*setSettingsOpen\(true\)/);
  assert.match(integration, /requestAnimationFrame[\s\S]*settingsReturnFocusRef\.current\.focus/);
  assert.match(integration, /onEscape=\{\(\) => \{[\s\S]*closeSettings\(\)/);
  assert.match(surface, /useSignalStore/);
  assert.match(settings, /useSignalStore[\s\S]*updateSetting/);
  assert.match(owner, /<SettingsBrowser/);
  assert.match(owner, /<ThemeSurface/);
});

test('both Theme selectors expose all six canonical themes and stay on owner session state', async () => {
  const [surface, settings, owner, domain] = await Promise.all([
    read('./Modul8rSettingsSurface.jsx'), read('../../public/SettingsBrowser.jsx'),
    read('../../public/OwnerLatticeShell.jsx'), read('../domain/latticeProductionDraft.js'),
  ]);
  assert.match(surface, /WORKSPACE \/ SURFACE[\s\S]*MENU \/ INTERFACE/);
  assert.match(surface, /LATTICE_PRODUCTION_SURFACE_IDS/);
  for (const id of ['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper']) assert.match(domain, new RegExp(id));
  assert.match(surface, /SESSION ONLY \/ NOT PERSISTED/);
  assert.match(owner, /useState\('mist'\)[\s\S]*useState\('mist'\)/);
  assert.match(owner, /onMenuSurfaceChange=\{setMenuSurfaceId\}/);
  assert.match(owner, /onSurfaceChange=\{setSurfaceId\}/);
  assert.doesNotMatch(surface, /localStorage|sessionStorage|metadata|assetRecord/);
});
