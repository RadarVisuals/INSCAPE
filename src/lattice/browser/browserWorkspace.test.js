import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspace = readFileSync(new URL('./BrowserWorkspace.jsx', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./BrowserFixtureHarness.jsx', import.meta.url), 'utf8');
const categoryDialog = readFileSync(new URL('./BrowserCategoryDialog.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./browserWorkspace.css', import.meta.url), 'utf8');

test('Browser keeps organization read-only and exposes only the bounded owner PLACE callback', () => {
  assert.match(workspace, /function BrowserWorkspace\(\{ data, onPlaceAsset, onRequestClose, open = false \}\)/);
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, /role="tab"/);
  assert.match(workspace, /role="tabpanel"/);
  assert.match(workspace, /PLACE PUBLIC/);
  assert.match(workspace, /disabled=\{!placementEnabled\}/);
  assert.match(workspace, /onPlaceAsset\?\.\(workspace\.selectedAsset\.stableAssetId\)/);
  assert.doesNotMatch(workspace, /commands\.|requestPlacement|toggleFavorite|createCategory|setCategory/);
  assert.doesNotMatch(workspace, /useLibraryStore|localStorage|sessionStorage|wallet|IPFS|createPlacementAtAnchor|normalizedInsertionAnchor/iu);
});

test('fixture adapter remains session-only prototype evidence and is not imported by the Browser', () => {
  assert.match(fixture, /ISOLATED|fixture/i);
  assert.match(fixture, /requestPlacement/);
  assert.doesNotMatch(fixture, /RADAR|VXCTXR|RESIDENT ZERO|localStorage|sessionStorage|Date\.|Math\.random|useLibraryStore/iu);
  assert.doesNotMatch(workspace, /BrowserFixtureHarness|latticeEngineFixtures/);
});

test('Category dialogs remain isolated while the read-only Browser consumes query-only assets', () => {
  assert.match(categoryDialog, /setName\(categoryDialogInitialName\(dialog\)\)/);
  assert.doesNotMatch(workspace, /BrowserCategoryDialog|createCategory|renameCategory|deleteCategory|setCategory/);
  assert.match(workspace, /assets: workspace\.categoryAssets/);
  assert.doesNotMatch(workspace, /BrowserCategoriesPanel[^\n]*workspace\.filteredAssets/);
});

test('Browser styling uses established lattice semantics and a centered nonmodal window', () => {
  assert.match(styles, /var\(--lattice-menu-panel\)/);
  assert.match(styles, /var\(--lattice-menu-ink\)/);
  assert.match(styles, /position: fixed/);
  assert.match(styles, /translate: -50% -50%/);
  assert.doesNotMatch(styles, /backdrop-filter|orange|border-radius:\s*(?:[1-9]|0\.[1-9])/iu);
});
