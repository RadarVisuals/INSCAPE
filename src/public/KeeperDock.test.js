import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockSource = readFileSync(new URL('./KeeperDock.jsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./moduleGrid.css', import.meta.url), 'utf8');
const ownerStyles = readFileSync(new URL('./ownerLatticeShell.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

test('production Keeper Dock uses actor silhouettes and contains docked canvas movement', () => {
  assert.match(dockSource, /\/assets\/actors\/\$\{actorId\}\/mask\.webp/);
  assert.match(dockSource, /createPortal/);
  assert.match(appSource, /id="keeper-dock-underlay"/);
  assert.match(dockSource, /MoreHorizontal/);
  assert.match(dockSource, /onContextMenu/);
  assert.match(dockSource, /role="menuitemcheckbox"/);
  assert.match(dockSource, /Follow cursor/);
  assert.match(dockSource, /MOVEMENT SPEED/);
  assert.match(dockSource, /\['slow', 'normal', 'fast'\]/);
  assert.match(dockSource, /residentScale = 0\.72/);
  assert.match(dockSource, /residentScale,/);
  assert.doesNotMatch(dockSource, /\bLock\b|\bUnlock\b|keeper-dock__label|keeper-dock__empty|keeper-dock__resident|Voice \/ Audio|Speech Scale/);
  assert.match(shellSource, /if \(keeperDockActive\) return;/);
  assert.doesNotMatch(shellSource, /keeperDockRef\.current\.release/);
  assert.match(styles, /\.keeper-dock__ghost/);
  assert.match(dockSource, /keeper-dock__menu rack-menu-surface/);
  assert.match(dockSource, /className="rack-menu-faceplate"/);
  assert.match(dockSource, /data-rack-active=/);
  assert.match(ownerStyles, /\.owner-lattice-shell \.keeper-dock__menu \{[^}]*width: 210px;/s);
  assert.match(ownerStyles, /\.owner-lattice-shell \.keeper-dock__menu \{[^}]*position: absolute;/s);
  assert.match(ownerStyles, /\.rack-menu-faceplate::before \{[^}]*width: 3px;[^}]*height: 3px;/s);
  assert.match(ownerStyles, /\.rack-menu-faceplate\[data-rack-active\][^}]*box-shadow: inset 3px 0 var\(--rack-menu-ink\)/s);
  assert.match(ownerStyles, /\.rack-menu-segment \{[^}]*display: grid;[^}]*place-items: center;/s);
  assert.doesNotMatch(styles, /\.keeper-dock__label|\.keeper-dock__empty|\.keeper-dock__resident/);
});
