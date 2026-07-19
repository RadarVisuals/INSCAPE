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
  const canvasCloseIndex = appSource.indexOf('/>', canvasIndex);
  const modeBranchIndex = appSource.indexOf('applicationMode === APPLICATION_MODES.ATELIER');

  assert.ok(canvasIndex >= 0);
  assert.ok(canvasCloseIndex > canvasIndex);
  assert.ok(modeBranchIndex > canvasCloseIndex);
  assert.equal(appSource.match(/import ArtCanvas from/g)?.length, 1);
  assert.equal(appSource.match(/<ArtCanvas\b/g)?.length, 1);
});

test('window state stays a UI-only document with no RenderConfig fields', () => {
  const stateSource = readFileSync(new URL('./windows/windowState.js', import.meta.url), 'utf8');

  assert.doesNotMatch(stateSource, /renderConfig/i);
  assert.match(stateSource, /openIds/);
  assert.match(stateSource, /activeId/);
});

test('framed artwork keeps form controls interactive and presentation layers independent', () => {
  const shellStyles = readFileSync(new URL('./moduleGrid.css', import.meta.url), 'utf8');
  const artworkSource = readFileSync(new URL('./FramedArtwork.jsx', import.meta.url), 'utf8');
  const artworkStyles = readFileSync(new URL('./canvasObjects.css', import.meta.url), 'utf8');
  const documentPreviewSource = readFileSync(new URL('../profileDocument/components/ProfileDocumentPreview.jsx', import.meta.url), 'utf8');

  assert.match(shellStyles, /\.public-shell input,[\s\S]*\.public-shell select,[\s\S]*pointer-events:\s*auto/);
  assert.match(artworkSource, /canvas-artwork__mat/);
  assert.match(artworkSource, /canvas-artwork__image-bed/);
  assert.match(artworkStyles, /data-mat="light"[^}]*\.canvas-artwork__mat/);
  assert.match(artworkStyles, /data-background="light"[^}]*\.canvas-artwork__image-bed/);
  assert.doesNotMatch(artworkStyles, /data-private[^}]*content:\s*["']PRIVATE/);
  assert.match(artworkSource, /arranging && selected/);
  assert.match(documentPreviewSource, /<FramedArtwork/);
});

test('Creations enters a world gallery that reuses the canonical framed artwork renderer', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const gallerySource = readFileSync(new URL('./GalleryWorld.jsx', import.meta.url), 'utf8');

  assert.match(shellSource, /id === 'creations'\) enterGallery\(\)/);
  assert.match(shellSource, /<GalleryWorld/);
  assert.match(gallerySource, /import FramedArtwork/);
  assert.match(gallerySource, /<FramedArtwork/);
  assert.match(gallerySource, /GalleryFloorGrid/);
  assert.match(gallerySource, /createPortal\(<>{backdrop}{gallery}<\/>/);
  assert.match(gallerySource, /onMoveKeeperHorizontally/);
  assert.doesNotMatch(gallerySource, /if \(direction\) onMoveKeeper\?\./);
});
