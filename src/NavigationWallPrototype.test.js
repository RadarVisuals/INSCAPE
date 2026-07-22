import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./NavigationWallPrototype.jsx', import.meta.url), 'utf8');
const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('navigation wall prototype is an isolated lazy route with dummy navigation only', () => {
  assert.match(entry, /\/prototype\/navigation-wall/);
  assert.match(entry, /React\.lazy\(\(\) => import\('\.\/NavigationWallPrototype\.jsx'\)\)/);
  for (const label of ['FAVORITES','ART','KEEPERS','MUSIC','AUDIO','VIDEO','ANIMATION']) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /useStore|useWalletStore|useLibraryStore|AssetResolver|profileDocument|residentHandoff/);
});

test('prototype exposes live geometry controls, presets, modes, and collapsible states', () => {
  for (const token of ['WIDTH','ANGLE','DEPTH','SPEED','GRID','PUSH TEST','CONNECTED OVERLAY','MOBILE PREVIEW','DESKTOP PREVIEW','CONNECTED','FOLDED','DEEP']) assert.match(source, new RegExp(token));
  assert.match(source, /type="range"/);
  assert.match(source, /type="number"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-keyshortcuts="N"/);
  assert.match(source, /event\.key==='Escape'/);
  assert.match(source, /wall-prototype__rail/);
});
