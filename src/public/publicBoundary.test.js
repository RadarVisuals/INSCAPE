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

test('the lightweight grid resident remains outside the public/private mode branch', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const canvasIndex = appSource.indexOf('<GridWalkerCanvas');
  const canvasCloseIndex = appSource.indexOf('/>', canvasIndex);
  const modeBranchIndex = appSource.indexOf('{effectiveApplicationMode === APPLICATION_MODES.ATELIER ? (');

  assert.ok(canvasIndex >= 0);
  assert.ok(canvasCloseIndex > canvasIndex);
  assert.ok(modeBranchIndex > canvasCloseIndex);
  assert.equal(appSource.match(/import GridWalkerCanvas from/g)?.length, 1);
  assert.equal(appSource.match(/<GridWalkerCanvas\b/g)?.length, 1);
  assert.doesNotMatch(appSource, /ArtCanvas|PixiEngine|pixi\.js|AssetResolver/);
});

test('the retired Pixi stage remains outside the active application root', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /<GridWalkerCanvas/);
  assert.doesNotMatch(appSource, /<ArtCanvas|foregroundOnly=|stageVisible={effectiveApplicationMode/);
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
});

test('selected owner workflow does not restore the legacy Gallery workspace', () => {
  const runtimeSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  assert.match(runtimeSource, /<OwnerSystemWorkflowCanvas/u);
  assert.doesNotMatch(runtimeSource, /GalleryWorld|CreationsBrowser|UpperWorldSurface|SpatialLevelNavigation/u);
});

test('owner inventory is profile-scoped before the Library panel opens', () => {
  const runtimeSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  assert.match(runtimeSource, /useLibraryStore\(\(state\) => state\.profileAddress === profileAddress \? state\.assets : \[\]\)/u);
  assert.match(runtimeSource, /useOwnerLatticeBrowser\(profileAddress, panel === 'library' && browserEnabled\)/u);
});

test('owner folders are direct categories and Index assigns assets through contextual folder commands', () => {
  const shellSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowLibraryPresenter.jsx', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('./AssetIndex.jsx', import.meta.url), 'utf8');
  const categorySource = readFileSync(new URL('./CategoryNavigationCard.jsx', import.meta.url), 'utf8');
  const categoryStyles = readFileSync(new URL('./categoryNavigationCard.css', import.meta.url), 'utf8');

  assert.match(shellSource, /const categories = data\.categories \|\| \[\]/u);
  assert.doesNotMatch(shellSource, /homeShortcut|pinnedLaunchers|onToggleHomeShortcut/u);
  assert.match(indexSource, /onContextMenu=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); setAssetContext/);
  assert.match(indexSource, /folder\.assetIds\.includes\(assetContext\.asset\.id\) \? 'Remove from' : 'Add to'/);
  assert.match(indexSource, /setFolderAsset\(folder\.id, assetContext\.asset\.id, !folder\.assetIds\.includes\(assetContext\.asset\.id\)\)/);
  assert.doesNotMatch(indexSource, /ORGANIZE|ADD TO FOLDER/);
  assert.match(categorySource, /onContextMenu=\{onContext \?/);
  assert.match(categorySource, /data-empty=\{!items\.length \|\| undefined\}/);
  assert.match(categorySource, /style=\{!items\.length \? \{ overflowY: 'hidden' \} : undefined\}/);
  assert.doesNotMatch(categoryStyles, /\[data-empty\] nav/);
});

test('System Workflow routing contains no legacy Gallery destination controls', () => {
  const shellSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(shellSource, /GalleryNavigationCard|GalleryWorld|system-hud__destinations/u);
  assert.match(shellSource, /<OwnerSystemWorkflowGlobalBar/u);
});

test('published navigation follows ordered v9 Grids without a spatial-world handoff', () => {
  const visitorSource = readFileSync(new URL('../profileDocument/components/ProfileDocumentV9Visitor.jsx', import.meta.url), 'utf8');
  assert.match(visitorSource, /const \[activeIndex, setActiveIndex\] = useState\(0\)/u);
  assert.match(visitorSource, /document\.grids\[activeIndex\]/u);
  assert.match(visitorSource, /aria-label="Next Grid"/u);
  assert.doesNotMatch(visitorSource, /GalleryWorld|UpperWorldSurface|SpatialLevelNavigation/u);
});

test('selected owner and Visitor omit the retired upper-world topology', () => {
  const ownerSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  const visitorSource = readFileSync(new URL('../profileDocument/components/ProfileDocumentV9Visitor.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(`${ownerSource}\n${visitorSource}`, /UpperWorldSurface|SpatialLevelNavigation|upper-world/u);
});

test('all non-owner routes mount the published boundary instead of the local workspace shell', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /localOwnerRoute \? <OwnerRuntimeBoundary/);
  assert.match(appSource, /: <PublishedProfileBoundary/);
  assert.match(appSource, /selectPublicProfileRoute\(ownerAuthoringEnabled\)/);
  assert.doesNotMatch(appSource, /viewingConnectedWorkspace \? <OwnerRuntimeBoundary/);
});

test('profile restore uses the isolated System Workflow store and controlled errors', () => {
  const controllerSource = readFileSync(new URL('./ownerSystemWorkflow/useOwnerSystemWorkflowController.js', import.meta.url), 'utf8');
  assert.match(controllerSource, /createSystemWorkflowDraftStore\(\{ profileAddress: profile/u);
  assert.match(controllerSource, /catch \(cause\) \{ setError\(cause\?\.message \|\| 'The canonical operation failed'\)/u);
  assert.doesNotMatch(controllerSource, /restoreImportedPresentation|profileDocumentStorage|lattice-production-draft/u);
});
