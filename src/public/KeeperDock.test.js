import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockSource = readFileSync(new URL('./KeeperDock.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./moduleGrid.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

test('retained Keeper Dock study is unreachable from the active application root', () => {
  assert.match(dockSource, /GRID_WALKER_RANGES, GRID_WALKER_TUNING/);
  assert.match(dockSource, /actorLabel = 'grid walker'/);
  assert.match(dockSource, /keeper-dock__shell/);
  assert.match(dockSource, /residentHandoff\?\.setTuning/);
  assert.doesNotMatch(dockSource, /\/assets\/actors\/\$\{actorId\}\/mask\.webp|createPortal/);
  assert.doesNotMatch(appSource, /KeeperDock|GridWalkerCanvas|keeper-dock-underlay|residentHandoff|keeperReactions/u);
  assert.match(dockSource, /MoreHorizontal/);
  assert.match(dockSource, /onContextMenu/);
  assert.match(dockSource, /role="menuitemcheckbox"/);
  assert.match(dockSource, /Follow cursor/);
  assert.match(dockSource, /MOVEMENT SPEED/);
  assert.match(dockSource, /\['slow', 'normal', 'fast'\]/);
  assert.match(dockSource, /residentScale = 0\.72/);
  assert.match(dockSource, /residentScale,/);
  assert.doesNotMatch(dockSource, /\bLock\b|\bUnlock\b|keeper-dock__label|keeper-dock__empty|keeper-dock__resident|Voice \/ Audio|Speech Scale/);
  assert.match(styles, /\.keeper-dock__ghost/);
  assert.match(dockSource, /keeper-dock__menu rack-menu-surface/);
  assert.match(dockSource, /className="rack-menu-faceplate"/);
  assert.match(dockSource, /data-rack-active=/);
  assert.doesNotMatch(styles, /\.keeper-dock__label|\.keeper-dock__empty|\.keeper-dock__resident/);
});
