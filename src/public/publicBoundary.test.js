import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const publicDirectory = new URL('./', import.meta.url);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) return sourceFiles(url);
    return /\.(js|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.js') ? [url] : [];
  });
}

test('public modules do not depend on private editor state or compatibility aliases', () => {
  const forbiddenDependencies = [
    /components\/UI/i,
    /store\/useStore/i,
    /useWalletStore/i,
    /normalizeRenderConfig/i,
    /renderConfig/i
  ];

  for (const file of sourceFiles(publicDirectory)) {
    const source = readFileSync(file, 'utf8');
    for (const forbidden of forbiddenDependencies) {
      assert.doesNotMatch(source, forbidden, `${file.pathname} crossed the public/private boundary`);
    }
  }
});

test('the shared canvas remains outside the public/private mode branch', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const canvasIndex = appSource.indexOf('<ArtCanvas');
  const modeBranchIndex = appSource.indexOf('applicationMode === APPLICATION_MODES.ATELIER');

  assert.ok(canvasIndex >= 0);
  assert.ok(modeBranchIndex > canvasIndex);
  assert.equal(appSource.match(/<ArtCanvas(?:\s[^>]*)?\s*\/>/g)?.length, 1);
});

test('window state stays a UI-only document with no RenderConfig fields', () => {
  const stateSource = readFileSync(new URL('./windows/windowState.js', import.meta.url), 'utf8');

  assert.doesNotMatch(stateSource, /renderConfig/i);
  assert.match(stateSource, /openIds/);
  assert.match(stateSource, /activeId/);
});
