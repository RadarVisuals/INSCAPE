import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('public rack prototype remains fixture-only, accessible, and ephemeral', async () => {
  const [jsx, css] = await Promise.all([
    readFile(new URL('./public-rack-prototype.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./public-rack-prototype.css', import.meta.url), 'utf8')
  ]);

  assert.match(jsx, /invented, fixture-only content/);
  assert.match(jsx, /COLLAPSE ALL/);
  assert.match(jsx, /ARRANGE/);
  assert.match(jsx, /event\.altKey/);
  assert.match(jsx, /aria-keyshortcuts=\{arranging/);
  assert.match(jsx, /setPointerCapture/);
  assert.match(jsx, /aria-live="polite"/);
  assert.match(jsx, /aria-expanded=\{open\}/);
  assert.doesNotMatch(jsx, /useLibraryStore|useWalletStore|localStorage|sessionStorage|writeContract/);
  assert.match(css, /width: clamp\(480px, 31vw, 720px\)/);
  assert.match(css, /--rack-bar: 40px/);
  assert.match(css, /--rack-control: 40px/);
  assert.match(css, /grid-template-rows: 64px/);
  assert.match(css, /font: 700 \.9375rem/);
  assert.match(css, /font: 700 \.859375rem/);
  assert.match(css, /grid-template-rows: 78px minmax\(0, 1fr\)/);
  assert.match(css, /border-left-color: var\(--rack-border\)/);
  assert.match(css, /\.rack-module\[data-open\] \{ border-left-color: var\(--rack-accent\)/);
  assert.doesNotMatch(css, /transform:\s*scale/);
  assert.match(css, /touch-action: pan-y/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
