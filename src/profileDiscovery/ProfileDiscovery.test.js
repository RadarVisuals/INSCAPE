import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('standalone Profile Discovery delegates data state but retains every modal mechanic', async () => {
  const source = await read('./ProfileDiscovery.jsx');
  assert.match(source, /useProfileDiscoveryController/);
  assert.match(source, /inputRef\.current\?\.focus/);
  assert.match(source, /previousFocusRef/);
  assert.match(source, /requestAnimationFrame\(restoreFocus\)/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key === 'Tab'/);
  assert.match(source, /role="dialog" aria-modal="true"/);
  assert.match(source, /event\.target === event\.currentTarget/);
  assert.doesNotMatch(source, /new AbortController|cleanupRef/);
});

test('standalone Profile Discovery uses the current menu-surface visual system', async () => {
  const [source, styles] = await Promise.all([
    read('./ProfileDiscovery.jsx'), read('./inscapeDirectorySystemWorkflow.css'),
  ]);
  assert.match(source, /menuSurfaceId = 'mist'/);
  assert.match(source, /data-lattice-menu-surface data-menu-surface=\{menuSurfaceId\}/);
  assert.match(styles, /var\(--lattice-menu-panel/);
  assert.match(styles, /var\(--lattice-menu-line-strong/);
  assert.match(styles, /"Inscape Sora"/);
  assert.doesNotMatch(styles, /#e87945|rgba\(4, 5, 5/);
});

test('People controller files contain no modal, focus, DOM, presentation, or routing ownership', async () => {
  const [controller, hook] = await Promise.all([
    read('./profileDiscoveryController.js'), read('./useProfileDiscoveryController.js'),
  ]);
  for (const source of [controller, hook]) {
    assert.doesNotMatch(source, /createPortal|document\.|querySelector|requestAnimationFrame|\.focus\(|onVisitProfile|createViewedProfileUrl|role=|className=|<section|<div/);
  }
  assert.match(controller, /moveActive\(offset\)/);
  assert.match(controller, /resolveSelection/);
});
