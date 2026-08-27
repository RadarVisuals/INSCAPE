import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ownerSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
const creationsSource = readFileSync(new URL('./CreationsBrowser.jsx', import.meta.url), 'utf8');
const activitySource = readFileSync(new URL('./ActivityBrowser.jsx', import.meta.url), 'utf8');
const creationsStyles = readFileSync(new URL('./creationsBrowser.css', import.meta.url), 'utf8');
const activityStyles = readFileSync(new URL('./activityBrowser.css', import.meta.url), 'utf8');
const browserStyles = readFileSync(new URL('../lattice/browser/browserWorkspace.css', import.meta.url), 'utf8');
const rackStyles = readFileSync(new URL('../lattice/windows/latticeRackShell.css', import.meta.url), 'utf8');
const chromeStyles = readFileSync(new URL('../lattice/rendering/latticeChromePrimitives.css', import.meta.url), 'utf8');
const menuStyles = readFileSync(new URL('../lattice/rendering/latticeMenuSurface.css', import.meta.url), 'utf8');
const tokenStyles = readFileSync(new URL('../inscapeTokens.css', import.meta.url), 'utf8');

test('System Workflow owner surfaces receive the active canonical menu surface', () => {
  assert.match(ownerSource, /data-lattice-menu-surface data-menu-surface=\{menuSurface\}/);
  assert.match(ownerSource, /<OwnerSystemWorkflowPanelLayer[\s\S]*menuSurface=\{menuSurface\}/);
  assert.match(creationsSource, /data-lattice-menu-surface data-menu-surface=\{menuSurfaceId\}/);
  assert.match(activitySource, /data-lattice-menu-surface data-menu-surface=\{menuSurfaceId\}/);
  assert.match(menuStyles, /\[data-lattice-menu-surface\]/);
});

test('creations and activity use rack typography, tokens, and clean corner handles', () => {
  for (const styles of [creationsStyles, activityStyles]) {
    assert.match(styles, /font-family:\s*"Inscape IBM Plex Mono"/);
    assert.match(styles, /background:\s*var\(--lattice-menu-panel\)/);
    assert.match(styles, /color:\s*var\(--lattice-menu-ink\)/);
    assert.match(styles, /border-right:\s*1px solid currentColor/);
    assert.match(styles, /border-bottom:\s*1px solid currentColor/);
  }
  assert.match(browserStyles, /\.lattice-browser-resize::after[^}]*border-right:\s*1px solid currentColor[^}]*border-bottom:\s*1px solid currentColor/s);
  assert.doesNotMatch(browserStyles, /\.lattice-browser-resize\s*\{[^}]*linear-gradient/s);
  assert.match(rackStyles, /\.lattice-rack-module__content\s*\{[^}]*padding:\s*7px/s);
  assert.match(chromeStyles, /::-webkit-scrollbar-button\s*\{[^}]*display:\s*none[^}]*width:\s*0[^}]*height:\s*0/s);
});

test('production typography resolves bundled Geist and IBM Plex files instead of platform fonts', () => {
  assert.match(tokenStyles, /font-family:\s*"Inscape Geist Sans";[\s\S]*geist-sans-latin-500-normal\.woff2/);
  assert.match(tokenStyles, /font-family:\s*"Inscape IBM Plex Mono";[\s\S]*IBMPlexMono-Medium\.ttf/);
  assert.match(tokenStyles, /--font-interface:\s*"Inscape Geist Sans", sans-serif/);
  assert.match(tokenStyles, /--font-body:\s*"Inscape Geist Sans", sans-serif/);
  assert.match(tokenStyles, /--font-mono:\s*"Inscape IBM Plex Mono", monospace/);
  assert.doesNotMatch(`${tokenStyles}\n${menuStyles}\n${browserStyles}`, /"Geist"|"IBM Plex Mono"|Bahnschrift|Aptos Narrow|Courier New|SFMono-Regular|Consolas/);
});
