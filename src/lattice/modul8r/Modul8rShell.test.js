import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');

test('component uses the Task 1 controller and exposes only real shell controls', async () => {
  const source = await read('./Modul8rShell.jsx');
  assert.match(source, /useLatticeFloatingWindow\(\{ initialSize: INITIAL_SHELL_SIZE \}\)/);
  assert.match(source, /MODUL8R_MODULE_ORDER\.map/);
  assert.match(source, /masterAccessory/);
  assert.match(source, /moduleFaceplateAccessoryRefs/);
  assert.match(source, /modul8r-module__faceplate-accessory/);
  assert.match(source, /aria-controls={`modul8r-\$\{id\}-content`}/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /inert=\{!expanded \? '' : undefined\}/);
  assert.match(source, /floatingWindow\.rackWidthResize\.keyDown/);
  assert.match(source, /floatingWindow\.move\.begin\(event, \{ allowInteractiveTarget: true \}\)/);
  assert.match(source, /floatingWindow\.move\.consumeClickSuppression\(\)/);
  assert.match(source, /onLostPointerCapture=\{\(event\) => \{[\s\S]*floatingWindow\.move\.cancel\(event\)/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /returnFocusRef\?\.current\?\.focus/);
  assert.match(source, /STRUCTURE ONLY \/ CONTENT IS NOT CONNECTED/);
  assert.doesNotMatch(source, /prototypes\/modul8r|modul8rFixtures|BrowserWorkspace|LatticeRackShell/);
});

test('fresh shell presentation owns exact faceplate geometry, containment and motion isolation', async () => {
  const styles = await read('./modul8rShell.css');
  assert.match(styles, /\.modul8r-master[\s\S]*height: 38px/);
  assert.match(styles, /\.modul8r-module__faceplate[\s\S]*min-height: 38px/);
  assert.match(styles, /data-module="library"\]\[data-expanded\][\s\S]*min-height: 60px;[\s\S]*flex-basis: 60px/);
  assert.match(styles, /faceplate-accessory::before \{[\s\S]*top: 38px;[\s\S]*left: -144px;[\s\S]*height: 1px/);
  assert.match(styles, /\.modul8r-module__toggle[\s\S]*inset: 0/);
  assert.match(styles, /\.modul8r-modules:has\(\.modul8r-module\[data-transitioning\]\) \{ overflow: hidden; \}/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /width: min\(var\(--modul8r-width\), calc\(100vw - 20px\)\)/);
  assert.match(styles, /\.modul8r-shell \{[\s\S]*pointer-events: auto;/);
  assert.match(styles, /\.modul8r-development-reopen \{[\s\S]*pointer-events: auto;/);
  assert.doesNotMatch(styles, /lattice-rack-|lattice-browser-|--lattice-browser-/);
  for (const className of [...styles.matchAll(/\.([a-z][\w-]*)/g)].map((match) => match[1])) {
    assert.match(className, /^modul8r-/, `unexpected non-MODUL-8R class: ${className}`);
  }
});

test('development owner entrance is a DEV-only lazy route with no prototype dependency', async () => {
  const [main, entrance] = await Promise.all([read('../../main.jsx'), read('./Modul8rDevelopmentEntrance.jsx')]);
  assert.match(main, /import\.meta\.env\.DEV\s*&& prototypePath === '\/development\/owner\/modul-8r'/);
  assert.match(main, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/lattice\/modul8r\/Modul8rDevelopmentEntrance\.jsx'\)\)\s*: null/);
  assert.match(entrance, /\['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper'\]/);
  assert.match(entrance, /data-reduced-motion/);
  assert.doesNotMatch(entrance, /modul8rFixtures|LIBRARY_ASSETS|ACTIVITY_EVENTS|PEOPLE/);
});
