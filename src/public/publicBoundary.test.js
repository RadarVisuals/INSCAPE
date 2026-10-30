import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import useOwnerLatticeBrowser from './useOwnerLatticeBrowser.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
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
  const modulesSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerWorkbenchModules.jsx', import.meta.url), 'utf8');
  assert.match(runtimeSource, /<OwnerWorkbenchModules/u);
  assert.match(modulesSource, /<OwnerDisplayInstance/u);
  const displaySource = readFileSync(new URL('./ownerSystemWorkflow/DisplayModule.jsx', import.meta.url), 'utf8');
  assert.match(displaySource, /<OwnerSystemWorkflowCanvas/u);
  assert.doesNotMatch(displaySource, /GalleryWorld|CreationsBrowser|UpperWorldSurface|SpatialLevelNavigation/u);
  assert.doesNotMatch(runtimeSource, /GalleryWorld|CreationsBrowser|UpperWorldSurface|SpatialLevelNavigation/u);
  assert.doesNotMatch(modulesSource, /GalleryWorld|CreationsBrowser|UpperWorldSurface|SpatialLevelNavigation/u);
});

test('before effects run a different profile cannot observe the current private inventory or category commands', () => {
  const previous = useLibraryStore.getState();
  const owner = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const contract = '0x3333333333333333333333333333333333333333';
  useLibraryStore.setState({ profileAddress: owner, workspace: { ...previous.workspace, profileAddress: owner },
    assets: [{ id: `42:${contract}:contract`, chainId: 42, standard: 'LSP7', contractAddress: contract,
      tokenId: null, ownerAddress: owner, imageUrl: 'https://art.test/private.webp' }] });
  let result;
  function Probe() { result = useOwnerLatticeBrowser(other, false); return null; }
  try {
    renderToString(createElement(Probe));
    assert.deepEqual(result.records, []);
    assert.deepEqual(result.data.assets, []);
    assert.equal(result.commands, null);
    assert.equal(result.data.workspaceReady, false);
  } finally { useLibraryStore.setState(previous); }
});

test('owner folders remain direct categories in the selected Library presenter', () => {
  const shellSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowLibraryPresenter.jsx', import.meta.url), 'utf8');

  assert.match(shellSource, /const categories = data\.categories \|\| \[\]/u);
  assert.doesNotMatch(shellSource, /homeShortcut|pinnedLaunchers|onToggleHomeShortcut/u);
});

test('System Workflow routing contains no legacy Gallery destination controls', () => {
  const shellSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(shellSource, /GalleryNavigationCard|GalleryWorld|system-hud__destinations/u);
  assert.match(shellSource, /<OwnerSystemWorkflowSidebar/u);
});

test('published navigation follows ordered v9 Grids without a spatial-world handoff', () => {
  const visitorSource = readFileSync(new URL('../profileDocument/components/PublishedDisplayModule.jsx', import.meta.url), 'utf8');
  // Scene selection now lives in the headless presentation session. Behavioral
  // selection/lifetime coverage is in presentation/sceneSession.test.js and
  // browser-tests/scene-boundaries.browser.mjs, not a component state spelling.
  assert.match(visitorSource, /aria-label="Next Grid"/u);
  assert.doesNotMatch(visitorSource, /GalleryWorld|UpperWorldSurface|SpatialLevelNavigation/u);
});

test('selected owner and Visitor omit the retired upper-world topology', () => {
  const ownerSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
  const visitorSource = readFileSync(new URL('../profileDocument/components/ProfileDocumentV9Visitor.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(`${ownerSource}\n${visitorSource}`, /UpperWorldSurface|SpatialLevelNavigation|upper-world/u);
});

test('profile destinations mount the owner boundary only for an authorized Workbench', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /localOwnerRoute \? !ownerSourceReady \?[\s\S]*<OwnerRuntimeBoundary/);
  assert.match(appSource, /: <PublishedProfileBoundary/);
  assert.match(appSource, /ownerAuthoringEnabled = content\?\.kind === 'workbench'/);
  assert.doesNotMatch(appSource, /viewingConnectedWorkspace \? <OwnerRuntimeBoundary/);
});

test('profile restore uses the isolated System Workflow store', () => {
  const controllerSource = readFileSync(new URL('./ownerSystemWorkflow/useOwnerSystemWorkflowController.js', import.meta.url), 'utf8');
  assert.match(controllerSource, /createSystemWorkflowDraftStore\(\{ profileAddress: profile/u);
  // Error handling is exercised through the mounted controller in
  // browser-tests/controller-hardening.browser.mjs, not source formatting.
  assert.doesNotMatch(controllerSource, /restoreImportedPresentation|profileDocumentStorage|lattice-production-draft/u);
});
