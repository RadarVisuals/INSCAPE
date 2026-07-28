import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  LATTICE_CHROME_REGIONS,
  activateLatticeChromeWindow,
  closeLatticeChromeWindow,
  createLatticeChromeWindowState,
  deepestLatticeChromeRegion,
} from './useLatticeChromeWindows.js';

const RAIL_IDS = ['categories', 'creations', 'activity', 'discover'];
const TOOLBAR_IDS = ['browser', 'theme', 'publish', 'settings', 'interface'];

test('every approved rail and toolbar surface opens through one region controller', () => {
  for (const id of RAIL_IDS) assert.equal(activateLatticeChromeWindow(createLatticeChromeWindowState(), LATTICE_CHROME_REGIONS.RAIL, id).railId, id);
  for (const id of TOOLBAR_IDS) assert.equal(activateLatticeChromeWindow(createLatticeChromeWindowState(), LATTICE_CHROME_REGIONS.TOOLBAR, id).toolbarId, id);
});

test('same-region activation replaces in one transition and never queues two windows', () => {
  const first = activateLatticeChromeWindow(createLatticeChromeWindowState(), 'rail', 'categories');
  const replaced = activateLatticeChromeWindow(first, 'rail', 'creations');
  assert.deepEqual(replaced, { deepestRegion: 'rail', railId: 'creations', toolbarId: null });
  assert.equal(activateLatticeChromeWindow(replaced, 'rail', 'creations').railId, null);
});

test('rail and toolbar ownership are independent and deepest close is deterministic', () => {
  const rail = activateLatticeChromeWindow(createLatticeChromeWindowState(), 'rail', 'activity');
  const both = activateLatticeChromeWindow(rail, 'toolbar', 'theme');
  assert.equal(deepestLatticeChromeRegion(both), 'toolbar');
  const afterToolbarClose = closeLatticeChromeWindow(both, 'toolbar');
  assert.equal(afterToolbarClose.railId, 'activity');
  assert.equal(deepestLatticeChromeRegion(afterToolbarClose), 'rail');
});

test('shared frame owns Escape, focus restoration and overflow; Discover has no backdrop', async () => {
  const [frame, controller, styles] = await Promise.all([
    readFile(new URL('./LatticeChromeWindow.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./useLatticeChromeWindows.js', import.meta.url), 'utf8'),
    readFile(new URL('./latticeChromeWindow.css', import.meta.url), 'utf8'),
  ]);
  assert.match(frame, /event\.key !== 'Escape'/);
  assert.match(controller, /trigger\?\.focus\?\./);
  assert.match(styles, /__body[^}]+overflow: auto/s);
  assert.doesNotMatch(styles, /backdrop-filter|filter:\s*blur/);
  assert.doesNotMatch(styles, /overflow:\s*scroll/);
});

test('public categories expose no management controls and fixture windows stay isolated', async () => {
  const [rail, fixture, toolbar] = await Promise.all([
    readFile(new URL('./LatticeRailWindowContent.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./LatticeChromeFixtureHost.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./LatticeToolbarWindowContent.jsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(rail, /createCategory|renameCategory|deleteCategory|setCategoryPublic|setCategoryAsset/);
  assert.match(rail, /filter\(\(category\) => category\.public\)/);
  assert.doesNotMatch(fixture, /wallet|pinata|ipfs|publication|ownerStore|visitorStore/i);
  assert.match(toolbar, /PUBLIC PRESENTATION/);
  assert.match(toolbar, /APPLICATION \/ PROFILE \/ KEEPER/);
  assert.match(toolbar, /PRIVATE EDITOR ERGONOMICS/);
});

test('shared chrome derives from menu semantics without duplicating a window palette', async () => {
  const [tokens, browser, windowStyles] = await Promise.all([
    readFile(new URL('../rendering/latticeChromePrimitives.css', import.meta.url), 'utf8'),
    readFile(new URL('../browser/browserWorkspace.css', import.meta.url), 'utf8'),
    readFile(new URL('./latticeChromeWindow.css', import.meta.url), 'utf8'),
  ]);
  for (const semantic of ['panel', 'ink', 'muted', 'faint', 'line', 'line-strong', 'selected']) {
    assert.match(tokens, new RegExp(`var\\(--lattice-menu-${semantic}\\)`));
  }
  assert.match(browser, /var\(--lattice-chrome-header-height\)/);
  assert.match(browser, /var\(--lattice-chrome-close-size\)/);
  assert.match(windowStyles, /var\(--lattice-chrome-surface\)/);
  assert.doesNotMatch(windowStyles, /#[\da-f]{3,8}|rgb\(/i);
});

test('rail-attached windows follow expanded and collapsed rail anchors', async () => {
  const [frame, host, fixtureHost, styles] = await Promise.all([
    readFile(new URL('./LatticeChromeWindow.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./LatticeChromeWindowHost.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./LatticeChromeFixtureHost.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./latticeChromeWindow.css', import.meta.url), 'utf8'),
  ]);
  assert.match(frame, /data-rail-collapsed/);
  assert.match(host, /railCollapsed=\{railCollapsed\}/);
  assert.match(fixtureHost, /railCollapsed=\{railCollapsed\}/);
  assert.match(styles, /data-position="rail"\]\[data-rail-collapsed\]\s*\{ left: 84px; \}/);
});

test('shared presence keeps closing chrome mounted until its CSS motion completes', async () => {
  const [presence, frame, browser, styles] = await Promise.all([
    readFile(new URL('./useLatticeChromePresence.js', import.meta.url), 'utf8'),
    readFile(new URL('./LatticeChromeWindow.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../browser/BrowserWorkspace.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./latticeChromeWindow.css', import.meta.url), 'utf8'),
  ]);
  assert.match(presence, /phase: 'exiting'/);
  assert.match(presence, /phase: 'closed', renderedValue: null/);
  assert.match(frame, /data-phase=\{phase\}/);
  assert.match(browser, /useLatticeChromePresence/);
  assert.match(styles, /lattice-chrome-rail-in/);
  assert.match(styles, /lattice-chrome-toolbar-in/);
  assert.match(styles, /lattice-chrome-center-in/);
  assert.doesNotMatch(presence, /setTimeout|setInterval/);
});

test('direct window switches animate content without remounting or moving the frame', async () => {
  const [frame, host, styles] = await Promise.all([
    readFile(new URL('./LatticeChromeWindow.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./LatticeChromeWindowHost.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./latticeChromeWindow.css', import.meta.url), 'utf8'),
  ]);
  assert.match(frame, /className="lattice-chrome-window__content-clip" key=\{contentKey\}/);
  assert.match(host, /contentKey=\{railPresence\.renderedValue\}/);
  assert.match(styles, /lattice-chrome-window__content-clip[^}]+overflow: clip/);
  assert.match(styles, /lattice-chrome-content-in/);
  assert.match(styles, /translateY\(5px\)/);
  assert.match(styles, /data-content-motion[^}]+__content[^}]+lattice-chrome-content-in/s);
  assert.match(host, /animateContent=\{railPresence\.contentMotion\}/);
  assert.doesNotMatch(styles, /resize:/);
});

test('Theme exposes one session-only overlay ink selector from the existing surface palette', async () => {
  const toolbar = await readFile(new URL('./LatticeToolbarWindowContent.jsx', import.meta.url), 'utf8');
  assert.match(toolbar, /OVERLAY INK/);
  assert.match(toolbar, /AUTO \/ MENU CONTRAST/);
  assert.match(toolbar, /commands\.setOverlayInkSurface/);
  assert.doesNotMatch(toolbar, /CHEVRON COLOR|MINIMAP COLOR|KEEPER COLOR/);
});
