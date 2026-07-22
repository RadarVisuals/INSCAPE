import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const jsxUrl = new URL('./identity-disclosure-prototype.jsx', import.meta.url);
const cssUrl = new URL('./identity-disclosure-prototype.css', import.meta.url);

test('identity disclosure prototype remains fixture-only and accessible', async () => {
  const [jsx, css] = await Promise.all([
    readFile(jsxUrl, 'utf8'),
    readFile(cssUrl, 'utf8')
  ]);

  assert.match(jsx, /browser-test-only data/);
  assert.match(jsx, /aria-expanded=\{expanded\}/);
  assert.match(jsx, /aria-controls=\{contentId\}/);
  assert.match(jsx, /className="identity-prototype__bar"/);
  assert.match(jsx, /className="identity-prototype__official"/);
  assert.match(jsx, /className="identity-prototype__signal-control"/);
  assert.match(jsx, /startOpen: true/);
  assert.match(jsx, /event\.key !== 'Escape'/);
  assert.match(jsx, /referrerPolicy="no-referrer"/);
  assert.doesNotMatch(jsx, /useLibraryStore|useWalletStore|localStorage|sessionStorage/);
  assert.match(css, /\.identity-prototype-page \.published-home-world__header/);
  assert.match(css, /\.identity-prototype-page \.published-home-world__window \.collection-content__heading/);
  assert.match(css, /button:first-child::before/);
  assert.match(css, /--identity-prototype-control-width: 34px/);
  assert.match(css, /\.identity-prototype-page \.module-window__resize/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
