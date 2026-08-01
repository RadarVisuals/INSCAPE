import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LatticeWorkspaceToolbar.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeWorkspaceToolbar.css', import.meta.url), 'utf8');

test('workspace toolbar is an owner-only injected tool shell', () => {
  assert.match(source, /if \(!owner\) return null/);
  assert.match(source, /tools\.map/);
  assert.match(source, /Owner workspace tools/);
  for (const icon of ['Archive', 'Grid2X2', 'Eye', 'Palette', 'Upload', 'MoreHorizontal']) {
    assert.match(source, new RegExp(icon));
  }
  assert.doesNotMatch(source, /useLibraryStore|useWalletStore|profileDocument|localStorage|sessionStorage|indexedDB/);
});

test('selection, Arrange, compact mode, blocking and Escape stay caller-controlled', () => {
  assert.match(source, /activeToolIds = \[\]/);
  assert.match(source, /activeToolId === toolId \|\| activeToolIds\.includes\(toolId\)/);
  assert.match(source, /tool\.id === 'arrange' \? arrangeEnabled : isToolActive\(tool\.id\)/);
  assert.match(source, /aria-pressed=\{active\}/);
  assert.match(source, /onToolActivate\?\.\(tool\.id, event\.currentTarget, event\.currentTarget\)/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /onEscape\?\.\(\)/);
  assert.match(source, /toolButtonRefs\[tool\.id\]/);
  assert.match(source, /inert=\{blocked \? '' : undefined\}/);
  assert.match(source, /faceplate && tool\.id === 'arrange'/);
  assert.match(source, /disabled=\{tool\.disabled === true\}/);
});

test('toolbar uses the approved desktop proportions and compact icon-only treatment', () => {
  assert.match(styles, /\.lattice-workspace-toolbar\s*\{[^}]*position: fixed;[^}]*top: 18px;[^}]*right: 18px;[^}]*background: var\(--lattice-menu-panel\);/s);
  assert.match(styles, /min-width: 76px/);
  assert.match(styles, /font: 500 9px\/1 "Inscape IBM Plex Mono"/);
  assert.match(styles, /\.lattice-workspace-toolbar\[data-compact\][^{]*\{[^}]*height: 40px;/s);
  assert.match(styles, /width: 48px;[^}]*min-width: 48px;/s);
  assert.match(styles, /right: 0;[^}]*left: 0;/s);
  assert.match(styles, /color: var\(--lattice-menu-ink\)/);
  assert.match(styles, /\.lattice-workspace-toolbar\s*\{[^}]*transition: opacity 180ms linear;/s);
  assert.match(styles, /\.lattice-workspace-toolbar\[data-blocked\][^{]*\{[^}]*opacity: 0;[^}]*pointer-events: none;/s);
  assert.doesNotMatch(styles, /margin-right|padding-right: 244px|translateX\(-244px\)/);
  assert.match(styles, /tool:disabled/);
});

test('embedded toolbar reuses the same actions without fixed-window ownership', () => {
  assert.match(source, /embedded = false/);
  assert.match(source, /data-embedded=\{embedded \|\| undefined\}/);
  assert.match(styles, /\.lattice-workspace-toolbar\[data-embedded\][^{]*\{[^}]*position: static;[^}]*width: 100%;[^}]*box-shadow: none;/s);
  assert.match(styles, /\.lattice-workspace-toolbar\[data-embedded\] \.lattice-workspace-toolbar__tool[^}]*flex: 1 1 0;/s);
});

test('MORE exposes only the supported Settings action', () => {
  assert.match(source, /isToolActive\('more'\) && !blocked/);
  assert.match(source, />SETTINGS<\/button>/);
  assert.doesNotMatch(source, />INTERFACE<\/button>|Prototype-only affordance/);
  assert.match(source, /Settings/);
  assert.match(styles, /width: 150px/);
  assert.match(styles, /height: 32px/);
  assert.match(styles, /gap: 8px/);
});
