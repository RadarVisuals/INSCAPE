import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./RackMenu.jsx', import.meta.url), 'utf8');
const desktopMenu = readFileSync(new URL('./DesktopMenu.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./rackMenu.css', import.meta.url), 'utf8');
const productionMovement = readFileSync(new URL('../../lattice/authoring/LatticeProductionMovementLayer.jsx', import.meta.url), 'utf8');
const productionBrowser = readFileSync(new URL('../../lattice/browser/BrowserWorkspace.jsx', import.meta.url), 'utf8');

test('RackMenu retains DesktopMenu interaction ownership behind one shared visual primitive', () => {
  assert.match(source, /import DesktopMenu from '.\/DesktopMenu\.jsx'/);
  assert.match(source, /<DesktopMenu/);
  assert.match(source, /rack-menu-surface/);
  assert.match(source, /rack-menu-command-surface/);
  assert.match(source, /panelClassName="rack-menu-surface rack-menu-command-surface"/);
  assert.match(source, /import '.\/rackMenu\.css'/);
});

test('explicit checked and mixed commands preserve their complete visible labels', () => {
  assert.match(desktopMenu, /const legacySelected = command\.label\.startsWith\('✓ '\)/);
  assert.match(desktopMenu, /legacySelected \? command\.label\.slice\(2\) : command\.label/);
  assert.doesNotMatch(desktopMenu, /selected \? command\.label\.slice\(2\)/);
  assert.match(desktopMenu, /aria-checked=\{command\.checkable \? mixed \? 'mixed' : selected : undefined\}/);
});

test('active production context-menu callers use RackMenu instead of styling DesktopMenu directly', () => {
  for (const caller of [productionMovement, productionBrowser]) {
    assert.match(caller, /import RackMenu/);
    assert.match(caller, /<RackMenu/);
    assert.doesNotMatch(caller, /import DesktopMenu/);
    assert.doesNotMatch(caller, /<DesktopMenu/);
  }
});

test('shared RÄCK faceplates are opaque, contiguous, theme-token inherited, and visibly active', () => {
  assert.match(styles, /\.rack-menu-surface \{[^}]*display: grid;[^}]*border: 1px solid var\(--rack-menu-line-strong\)/s);
  assert.match(styles, /background: var\(--rack-menu-panel\)/);
  assert.match(styles, /--rack-menu-panel: var\(--lattice-menu-panel, var\(--color-surface-overlay\)\)/);
  assert.match(styles, /grid-template-columns: 12px minmax\(0, 1fr\) 10px/);
  assert.match(styles, /\.rack-menu-command-surface\.desktop-menu \{[^}]*pointer-events: auto;/s);
  assert.match(styles, /\.rack-menu-command-surface\.desktop-menu button i \{[^}]*width: 3px;[^}]*height: 3px;/s);
  assert.match(styles, /box-shadow: inset 3px 0 var\(--rack-menu-ink\)/);
  assert.doesNotMatch(styles, /rack-menu-command-flyout/);
  assert.doesNotMatch(styles, /color-destructive|height:\s*0/);
});
