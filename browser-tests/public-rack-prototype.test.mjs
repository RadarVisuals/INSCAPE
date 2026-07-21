import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('public rack prototype remains fixture-only, accessible, and ephemeral', async () => {
  const [jsx, css] = await Promise.all([
    readFile(new URL('./public-rack-prototype.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./public-rack-prototype.css', import.meta.url), 'utf8')
  ]);

  assert.match(jsx, /invented, fixture-only content/);
  assert.match(jsx, /label="INVENTORY"/);
  assert.match(jsx, /label="GRID"/);
  assert.match(jsx, /PublishedIdentityRack/);
  assert.match(jsx, /NFT/);
  assert.match(jsx, /PHOTOGRAPHY/);
  assert.match(jsx, /1 \/ 1 ARTWORK/);
  assert.match(jsx, /data-fixture-mini-app/);
  assert.match(jsx, /underneath_os\.svg/);
  assert.match(jsx, /COLLAPSE ALL/);
  assert.match(jsx, /ARRANGE/);
  assert.match(jsx, /event\.altKey/);
  assert.match(jsx, /aria-keyshortcuts=\{arranging/);
  assert.match(jsx, /setPointerCapture/);
  assert.match(jsx, /aria-live="polite"/);
  assert.match(jsx, /aria-expanded=\{open\}/);
  assert.doesNotMatch(jsx, /useLibraryStore|useWalletStore|localStorage|sessionStorage|writeContract/);
  assert.match(css, /\.public-rack-board/);
  assert.match(css, /\.public-rack-column/);
  assert.match(css, /@media \(min-width: 1100px\)/);
  assert.match(css, /@media \(min-width: 1600px\)/);
  assert.match(css, /\.public-rack-slot>\.published-identity-rack/);
  assert.match(css, /--rack-bar: 40px/);
  assert.match(css, /--rack-control: 40px/);
  assert.match(css, /grid-template-rows: 64px/);
  assert.match(css, /font: 700 \.9375rem/);
  assert.match(css, /font: 700 \.859375rem/);
  assert.match(css, /grid-template-rows: 60px minmax\(0,\s?1fr\)/);
  assert.match(css, /public-rack-master-control__icon \{ display: block/);
  assert.match(jsx, /Collapse all \$\{label\.toLowerCase\(\)\} modules/);
  assert.match(css, /border-left-color: var\(--rack-border\)/);
  assert.match(css, /\.rack-module\[data-open\] \{ border-left-color: var\(--rack-accent\)/);
  assert.doesNotMatch(css, /transform:\s*scale/);
  assert.match(css, /touch-action: pan-y/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /rack-miniapp__display/);
  assert.match(css, /rack-trophies/);
});
