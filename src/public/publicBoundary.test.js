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

test('the retired Keeper and Grid Walker stay outside the active application root', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(appSource, /GridWalkerCanvas|KeeperDock|keeper-dock-underlay|residentHandoff|keeperReactions/u);
  assert.doesNotMatch(appSource, /ArtCanvas|PixiEngine|pixi\.js|AssetResolver|selectResidentActorVisible/u);
});

test('production entry recovers an open tab after hashed lazy chunks are replaced', () => {
  const mainSource = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8');
  assert.match(mainSource, /if \(import\.meta\.env\.PROD\)/u);
  assert.match(mainSource, /addEventListener\('vite:preloadError'/u);
  assert.match(mainSource, /event\.preventDefault\(\)/u);
  assert.match(mainSource, /window\.location\.reload\(\)/u);
  assert.match(mainSource, /\{ once: true \}/u);
});

test('the retired Pixi stage remains outside the active application root', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(appSource, /<GridWalkerCanvas|<ArtCanvas|foregroundOnly=|stageVisible={effectiveApplicationMode/);
});

test('selected owner workflow does not restore the legacy Gallery workspace', () => {
  const runtimeSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  assert.match(runtimeSource, /<OwnerSystemWorkflowCanvas/u);
  assert.doesNotMatch(runtimeSource, /GalleryWorld|CreationsBrowser|UpperWorldSurface|SpatialLevelNavigation/u);
});

test('owner inventory is profile-scoped before the Library panel opens', () => {
  const runtimeSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  const browserSource = readFileSync(new URL('./useOwnerLatticeBrowser.js', import.meta.url), 'utf8');
  assert.match(browserSource, /storeProfileAddress === profile/u);
  assert.match(browserSource, /createdProfileAddress === profile/u);
  assert.match(runtimeSource, /useOwnerLatticeBrowser\(profileAddress, panel === 'library' && browserEnabled, referencedAssetIds\)/u);
  assert.match(runtimeSource, /const records = reviewAssets \|\| browser\.records/);
  assert.doesNotMatch(runtimeSource, /const rawAssets = useLibraryStore/);
});

test('owner folders remain direct categories in the selected Library presenter', () => {
  const shellSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowLibraryPresenter.jsx', import.meta.url), 'utf8');

  assert.match(shellSource, /const categories = data\.categories \|\| \[\]/u);
  assert.doesNotMatch(shellSource, /homeShortcut|pinnedLaunchers|onToggleHomeShortcut/u);
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
  assert.match(appSource, /localOwnerRoute \? !ownerSourceReady \?[\s\S]*<OwnerRuntimeBoundary/);
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
