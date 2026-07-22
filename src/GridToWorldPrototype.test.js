import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./GridToWorldPrototype.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./gridToWorldPrototype.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('grid-to-world study is an isolated lazy prototype using the transparent mountain asset', () => {
  assert.match(entry, /\/prototype\/grid-to-world/);
  assert.match(entry, /React\.lazy\(\(\) => import\('\.\/GridToWorldPrototype\.jsx'\)\)/);
  assert.match(source, /\/assets\/prototype\/gridmountains\.webp/);
  assert.match(source, /extractSkyline/);
  assert.match(source, /pixels\[\(y\*size\+x\)\*4\+3\]/);
  assert.doesNotMatch(source, /useStore|useWalletStore|useLibraryStore|AssetResolver|profileDocument|residentHandoff/);
});

test('study exposes the transition variables while preserving one continuous dark field', () => {
  for (const token of ['ENTER WORLD','RETURN TO GRID','MOVE RIGHT','PAUSE TRAVEL','SNAP','DURATION','TRAVEL','GRID']) assert.match(source, new RegExp(token));
  assert.match(source, /LANDSCAPE_REPEATS=3/);
  assert.match(source, /const panelWidth=width/);
  assert.match(source, /const trackX=seam-modulo\(travel,trackWidth\)/);
  assert.match(source, /progressRef\.current>=\.999/);
  assert.match(source, /context\.scale\(-1,1\)/);
  assert.match(source, /requestAnimationFrame\(tick\)/);
  assert.doesNotMatch(source, /study__gate|GATE/);
  assert.doesNotMatch(styles, /study__gate|rotateY/);
  assert.match(styles, /background:#050606/);
  assert.doesNotMatch(styles, /background-image:url/);
  assert.doesNotMatch(source, /source-atop/);
});
