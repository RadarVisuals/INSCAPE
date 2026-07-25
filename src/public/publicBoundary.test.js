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
  assert.match(homeSource, /onCameraChange\(clampVerticalHomeWorldCamera/);
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
  const galleryStyles = readFileSync(new URL('./galleryWorld.css', import.meta.url), 'utf8');
  const documentPreviewSource = readFileSync(new URL('../profileDocument/components/PublishedHomeWorld.jsx', import.meta.url), 'utf8');

  assert.match(shellStyles, /\.public-shell input,[\s\S]*\.public-shell select,[\s\S]*pointer-events:\s*auto/);
  assert.match(artworkSource, /canvas-artwork__mat/);
  assert.match(artworkSource, /canvas-artwork__image-bed/);
  assert.match(artworkSource, /data-transparent/);
  assert.match(artworkSource, /asset\?\.thumbnailUrl \|\| asset\?\.imageUrl/);
  assert.match(artworkSource, /object\.presentation\.background === 'transparent'/);
  assert.match(artworkStyles, /data-mat="light"[^}]*\.canvas-artwork__mat/);
  assert.match(artworkStyles, /data-background="light"[^}]*\.canvas-artwork__image-bed/);
  assert.match(galleryStyles, /data-transparent[^}]*background:transparent/);
  assert.doesNotMatch(artworkStyles, /data-private[^}]*content:\s*["']PRIVATE/);
  assert.match(artworkSource, /arranging && selected/);
  assert.match(documentPreviewSource, /<GalleryWorld/);
});

test('Gallery remains spatial while Creations is an independent dock workspace', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const dockSource = readFileSync(new URL('./ProfileNavigationDock.jsx', import.meta.url), 'utf8');
  const gallerySource = readFileSync(new URL('./GalleryWorld.jsx', import.meta.url), 'utf8');

  assert.match(shellSource, /gallery=\{upperOpen \? null : \{/);
  assert.match(dockSource, /GalleryNavigationCard/);
  assert.match(dockSource, /CreationsBrowser/);
  assert.doesNotMatch(shellSource, /<CreationsWindow/);
  assert.match(shellSource, /<GalleryWorld/);
  assert.doesNotMatch(shellSource, /id === 'creations'\) enterGallery\(\)/);
  assert.doesNotMatch(shellSource, /setActiveModuleId\('creations'\);\s*\n\s*}, \[closeAllWindows\]\)/);
  assert.match(gallerySource, /import FramedArtwork/);
  assert.match(gallerySource, /<FramedArtwork/);
  assert.match(gallerySource, /GalleryFloorGrid/);
  assert.match(gallerySource, /createPortal\(<>{backdrop}{gallery}<\/>/);
  assert.match(gallerySource, /onMoveKeeperHorizontally/);
  assert.match(gallerySource, /addEventListener\('wheel', handleWheel, \{ passive: false \}\)/);
  assert.match(gallerySource, /onOpenArtwork\(object\.id, event\.currentTarget\)/);
  assert.doesNotMatch(gallerySource, /onWheel=\{handleWheel\}/);
  assert.doesNotMatch(gallerySource, /if \(direction\) onMoveKeeper\?\./);
});

test('owner inventory hydrates independently of opening Index or Categories', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  assert.match(shellSource, /if \(!ownerAuthoringEnabled \|\| libraryStatus !== 'idle'\) return;\s*void loadLibrary\(\);/);
  assert.match(shellSource, /galleryAssetsMissing[\s\S]*libraryStatus !== 'loading'\) void loadLibrary\(\);/);
});

test('owner folders are direct categories and Index assigns assets through contextual folder commands', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('./AssetIndex.jsx', import.meta.url), 'utf8');
  const categorySource = readFileSync(new URL('./CategoryNavigationCard.jsx', import.meta.url), 'utf8');
  const categoryStyles = readFileSync(new URL('./categoryNavigationCard.css', import.meta.url), 'utf8');

  assert.match(shellSource, /workspace\.folders\.map\(\(folder\) => \(\{/);
  assert.doesNotMatch(shellSource, /homeShortcut|pinnedLaunchers|onToggleHomeShortcut/);
  assert.match(indexSource, /onContextMenu=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); setAssetContext/);
  assert.match(indexSource, /folder\.assetIds\.includes\(assetContext\.asset\.id\) \? 'Remove from' : 'Add to'/);
  assert.match(indexSource, /setFolderAsset\(folder\.id, assetContext\.asset\.id, !folder\.assetIds\.includes\(assetContext\.asset\.id\)\)/);
  assert.doesNotMatch(indexSource, /ORGANIZE|ADD TO FOLDER/);
  assert.match(categorySource, /onContextMenu=\{onContext \?/);
  assert.match(categorySource, /data-empty=\{!items\.length \|\| undefined\}/);
  assert.match(categorySource, /style=\{!items\.length \? \{ overflowY: 'hidden' \} : undefined\}/);
  assert.doesNotMatch(categoryStyles, /\[data-empty\] nav/);
});

test('published visitors enter the same Gallery projection without owner authoring controls', () => {
  const worldSource = readFileSync(new URL('../profileDocument/components/PublishedHomeWorld.jsx', import.meta.url), 'utf8');
  assert.match(worldSource, /gallery=\{\{ open: galleryOpen/);
  assert.match(worldSource, /<GalleryWorld/);
  assert.match(worldSource, /objects=\{galleryObjects\}/);
  assert.doesNotMatch(worldSource, /ownerAuthoringEnabled=\{true\}/);
});

test('Gallery is routed through the profile dock without legacy destination controls', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const dockSource = readFileSync(new URL('./ProfileNavigationDock.jsx', import.meta.url), 'utf8');
  assert.match(shellSource, /gallery=\{upperOpen \? null : \{/);
  assert.match(dockSource, /<GalleryNavigationCard/);
  assert.doesNotMatch(shellSource, />\[ Gallery \]<\/button>/);
  assert.doesNotMatch(shellSource, /className="system-hud__destinations"/);
});

test('Gallery transition keeps both spatial worlds mounted through a reversible vertical handoff', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('./HomeWorldSurface.jsx', import.meta.url), 'utf8');
  const gallerySource = readFileSync(new URL('./GalleryWorld.jsx', import.meta.url), 'utf8');
  const homeStyles = readFileSync(new URL('./homeWorld.css', import.meta.url), 'utf8');
  const galleryStyles = readFileSync(new URL('./galleryWorld.css', import.meta.url), 'utf8');
  const dockSource = readFileSync(new URL('./ProfileNavigationDock.jsx', import.meta.url), 'utf8');

  assert.match(shellSource, /galleryTransitionPhase/);
  assert.match(shellSource, /\['preparing', 'entering', 'exiting'\]/);
  assert.match(shellSource, /setGalleryTransitionPhase\('exiting'\)/);
  assert.match(homeSource, /data-gallery-transition=\{transitionPhase\}/);
  assert.match(gallerySource, /cameraX - gridPhaseX/);
  assert.match(shellSource, /setHomeGridPhaseX\(inheritedPhase\)/);
  assert.match(dockSource, /collapseToAvatar=\{effectiveGalleryOpen \|\| spatialWorldActive\}/);
  assert.match(homeStyles, /@keyframes home-world-descend/);
  assert.match(galleryStyles, /@keyframes gallery-world-arrive/);
  assert.match(galleryStyles, /@keyframes gallery-floor-unfold/);
});

test('Upper world is connected above Home through spatial level navigation', () => {
  const shellSource = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  const upperSource = readFileSync(new URL('./UpperWorldSurface.jsx', import.meta.url), 'utf8');
  const upperStyles = readFileSync(new URL('./upperWorld.css', import.meta.url), 'utf8');
  const galleryStyles = readFileSync(new URL('./galleryWorld.css', import.meta.url), 'utf8');

  assert.match(upperSource, /className="upper-world"/);
  assert.match(upperStyles, /@keyframes upper-world-arrive/);
  assert.match(upperStyles, /@keyframes upper-ceiling-unfold/);
  assert.match(shellSource, /<UpperWorldSurface/);
  assert.match(shellSource, /<SpatialLevelNavigation/);
  assert.doesNotMatch(galleryStyles, /gallery-world__ceiling/);
});

test('all non-owner routes mount the published boundary instead of the local workspace shell', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /localOwnerRoute \? <OwnerRuntimeBoundary/);
  assert.match(appSource, /: <PublishedProfileBoundary/);
  assert.match(appSource, /selectPublicProfileRoute\(ownerAuthoringEnabled\)/);
  assert.doesNotMatch(appSource, /viewingConnectedWorkspace \? <OwnerRuntimeBoundary/);
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
