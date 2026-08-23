import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OWNER_SHELL_SYSTEM_PANEL_IDS } from './useOwnerShellSystemPanels.js';

test('panel coordinator owns the complete mutually exclusive workspace set', () => {
  assert.deepEqual(OWNER_SHELL_SYSTEM_PANEL_IDS, [
    'activity', 'activity-history', 'discover', 'library', 'profile', 'settings', 'tables',
  ]);
  assert.equal(new Set(OWNER_SHELL_SYSTEM_PANEL_IDS).size, OWNER_SHELL_SYSTEM_PANEL_IDS.length);
});

test('panel ownership and Escape coordination are removed from the shell parent', async () => {
  const [controller, parent] = await Promise.all([
    readFile(new URL('./useOwnerShellSystemPanels.js', import.meta.url), 'utf8'),
    readFile(new URL('./OwnerShellSystemPrototype.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(parent, /useOwnerShellSystemPanels/);
  assert.doesNotMatch(parent, /setLibraryOpen|setSettingsOpen|setProfileOpen|setDiscoverOpen|setActivityOpen|setActivityHistoryOpen|setTableMapOpen/);
  assert.doesNotMatch(parent, /function usePrototypePresence/);
  assert.match(controller, /setActivePanel\(\(current\) => current === panelId \? null : panelId\)/);
  assert.match(controller, /cancelBeforeClose\?\.\(\)/);
  assert.match(controller, /owner-shell-system__select-popover/);
  assert.match(controller, /usePanelPresence\(isOpen\('discover'\), DISCOVER_EXIT_MS, 2\)/);
});
