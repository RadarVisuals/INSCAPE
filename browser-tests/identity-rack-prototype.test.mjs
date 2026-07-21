import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('identity rack remains fictional, fixture-only, and behaviorally complete', async () => {
  const [jsx, css] = await Promise.all([
    readFile(new URL('./identity-rack-prototype.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./identity-rack-prototype.css', import.meta.url), 'utf8')
  ]);

  assert.match(jsx, /fictional fixture-only identity/);
  assert.match(jsx, /<strong>IDENTITY<\/strong><small>PUBLIC PROFILE<\/small>/);
  assert.match(jsx, /\/assets\/logo\/underneath_os\.svg/);
  assert.doesNotMatch(jsx, /IDENTITY RACK|HUMAN UNDERNEATH/);
  assert.match(jsx, /PROFILE/);
  assert.match(jsx, /BIO/);
  assert.match(jsx, /LINKS \/ TAGS/);
  assert.match(jsx, /VERIFIED LINK — FIXTURE ONLY/);
  assert.match(jsx, /COLLAPSE ALL/);
  assert.match(jsx, /aria-keyshortcuts=\{arranging/);
  assert.match(jsx, /setPointerCapture/);
  assert.match(jsx, /aria-live="polite"/);
  assert.doesNotMatch(jsx, /useLibraryStore|useWalletStore|localStorage|sessionStorage|fetch\(|writeContract|https:\/\//);
  assert.match(css, /grid-template-columns: 128px minmax\(0, 1fr\)/);
  assert.match(css, /\.identity-rack__mark \{ width: 34px; height: 34px; border: 0; border-radius: 0/);
  assert.match(css, /\.identity-rack__mark img \{ width: 32px; height: 32px/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
