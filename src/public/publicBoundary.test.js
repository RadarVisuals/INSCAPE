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
  const modeBranchIndex = appSource.indexOf('{effectiveApplicationMode === APPLICATION_MODES.ATELIER ? (');

  assert.ok(canvasIndex >= 0);
  assert.ok(canvasCloseIndex > canvasIndex);
  assert.ok(modeBranchIndex > canvasCloseIndex);
  assert.equal(appSource.match(/import ArtCanvas from/g)?.length, 1);
  assert.equal(appSource.match(/<ArtCanvas\b/g)?.length, 1);
});

test('public home is resident-only while Atelier retains stage authoring', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('./HomeWorldSurface.jsx', import.meta.url), 'utf8');

  assert.match(appSource, /stageVisible={effectiveApplicationMode === APPLICATION_MODES\.ATELIER && stageUserVisible}/);
  assert.match(appSource, /foregroundOnly={effectiveApplicationMode === APPLICATION_MODES\.PUBLIC}/);
  assert.match(shellSource, /<HomeWorldSurface/);
  assert.match(homeSource, /onCameraChange\(clampCamera/);
  assert.match(homeSource, /createPortal\(surface, root\)/);
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

test('Gallery remains spatial while Creations is an independent system window', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const gallerySource = readFileSync(new URL('./GalleryWorld.jsx', import.meta.url), 'utf8');

  assert.match(shellSource, /moduleRefs\.current\.set\('gallery'/);
  assert.match(shellSource, /moduleRefs\.current\.set\('creations'/);
  assert.match(shellSource, /<CreationsWindow/);
  assert.match(shellSource, /<GalleryWorld/);
  assert.doesNotMatch(shellSource, /id === 'creations'\) enterGallery\(\)/);
  assert.doesNotMatch(shellSource, /setActiveModuleId\('creations'\);\s*\n\s*}, \[closeAllWindows\]\)/);
  assert.match(gallerySource, /import FramedArtwork/);
  assert.match(gallerySource, /<FramedArtwork/);
  assert.match(gallerySource, /GalleryFloorGrid/);
  assert.match(gallerySource, /createPortal\(<>{backdrop}{gallery}<\/>/);
  assert.match(gallerySource, /onMoveKeeperHorizontally/);
  assert.doesNotMatch(gallerySource, /if \(direction\) onMoveKeeper\?\./);
});

test('system destination order is Activity, Gallery, Creations, Library', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const activity = shellSource.indexOf('>[ Activity ]</button>');
  const gallery = shellSource.indexOf('>[ Gallery ]</button>');
  const creations = shellSource.indexOf('>[ Creations ]</button>');
  const library = shellSource.indexOf('>[ Library ]</button>');
  assert.ok(activity >= 0 && activity < gallery && gallery < creations && creations < library);
});

test('viewing another profile mounts the unavailable surface instead of the local workspace shell', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /viewingConnectedWorkspace \? <ModuleGridShell/);
  assert.match(appSource, /: <UnavailableProfileSurface/);
  assert.match(appSource, /actorVisible=.*viewingConnectedWorkspace/);
});

test('profile restore guards presentation storage reads and reports controlled document errors', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const restoreStart = shellSource.indexOf('const restoreImportedPresentation');
  const restoreEnd = shellSource.indexOf('\n  useEffect(() => {', restoreStart);
  const restoreSource = shellSource.slice(restoreStart, restoreEnd);
  const tryIndex = restoreSource.indexOf('try {');
  const readIndex = restoreSource.indexOf('window.localStorage.getItem(key)');

  assert.ok(tryIndex >= 0 && readIndex > tryIndex, 'the prior presentation read is inside the guarded restore path');
  assert.match(restoreSource, /if \(restoreStarted\)/);
  assert.match(restoreSource, /setDocumentError\(error instanceof Error \? error\.message : String\(error\)\)/);
});
