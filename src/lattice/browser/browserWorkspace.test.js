import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspace = readFileSync(new URL('./BrowserWorkspace.jsx', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./BrowserFixtureHarness.jsx', import.meta.url), 'utf8');
const categoryDialog = readFileSync(new URL('./BrowserCategoryDialog.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./browserWorkspace.css', import.meta.url), 'utf8');

test('Browser keeps PLACE intact and exposes a separate narrow category command boundary', () => {
  assert.match(workspace, /categoryCommands = null,[\s\S]*onActiveTabChange,[\s\S]*tabRequest = null/);
  assert.match(workspace, /TABS\.some\(\(\{ id \}\) => id === tabRequest\?\.id\)/);
  assert.match(workspace, /workspace\.setActiveTab\(requestedTab\)/);
  assert.match(workspace, /onActiveTabChange\?\.\(workspace\.activeTab\)/);
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, /role="tab"/);
  assert.match(workspace, /role="tabpanel"/);
  assert.match(workspace, /PLACE PUBLIC/);
  assert.match(workspace, /disabled=\{!placementEnabled\}/);
  assert.match(workspace, /onPlaceAsset\?\.\(workspace\.selectedAsset\.stableAssetId\)/);
  assert.match(workspace, /categoryCommands\.createCategory/);
  assert.match(workspace, /categoryCommands\.setCategoryAsset/);
  assert.doesNotMatch(workspace, /requestPlacement|toggleFavorite|useLibraryStore/);
  assert.doesNotMatch(workspace, /useLibraryStore|localStorage|sessionStorage|wallet|IPFS|createPlacementAtAnchor|normalizedInsertionAnchor/iu);
});

test('fixture adapter remains session-only prototype evidence and is not imported by the Browser', () => {
  assert.match(fixture, /ISOLATED|fixture/i);
  assert.match(fixture, /requestPlacement/);
  assert.doesNotMatch(fixture, /RADAR|VXCTXR|RESIDENT ZERO|localStorage|sessionStorage|Date\.|Math\.random|useLibraryStore/iu);
  assert.doesNotMatch(workspace, /BrowserFixtureHarness|latticeEngineFixtures/);
});

test('Category dialogs reject empty input and confirm deletion while category results consume query-only assets', () => {
  assert.match(categoryDialog, /setName\(categoryDialogInitialName\(dialog\)\)/);
  assert.match(workspace, /BrowserCategoryDialog/);
  assert.match(categoryDialog, /if \(!deletion && !name\.trim\(\)\) return/);
  assert.match(categoryDialog, /ASSETS AND LATTICE PLACEMENTS ARE NOT AFFECTED/);
  assert.match(workspace, /assets: workspace\.categoryAssets/);
  assert.doesNotMatch(workspace, /BrowserCategoriesPanel[^\n]*workspace\.filteredAssets/);
  const categoriesPanel = readFileSync(new URL('./BrowserCategoriesPanel.jsx', import.meta.url), 'utf8');
  assert.match(categoriesPanel, /ASSIGNED ASSETS/);
  assert.doesNotMatch(categoriesPanel, /INDEX MEMBERSHIP|NOT ASSIGNED/);
});

test('category and NFT menus use shared RackMenu with pointer and keyboard activation plus focus restoration', () => {
  const assets = readFileSync(new URL('./BrowserAssetResults.jsx', import.meta.url), 'utf8');
  const categories = readFileSync(new URL('./BrowserCategoriesPanel.jsx', import.meta.url), 'utf8');
  assert.match(workspace, /import RackMenu/);
  assert.match(workspace, /<RackMenu/);
  assert.match(workspace, /createPortal\(<RackMenu/);
  assert.match(workspace, /document\.querySelector\('\.owner-lattice-shell'\) \|\| document\.body/);
  assert.match(workspace, /returnFocus=\{contextMenu\.trigger\}/);
  assert.match(workspace, /NO CATEGORIES YET/);
  assert.match(workspace, /label: 'ADD TO >'/);
  assert.match(workspace, /label: 'REMOVE FROM >'/);
  assert.match(workspace, /getSubmenuCommands/);
  assert.match(workspace, /commandId === 'membership:add'/);
  assert.match(workspace, /commandId === 'membership:remove'/);
  assert.match(workspace, /assetMenuGroups\.remove : \[\]/);
  for (const source of [assets, categories]) {
    assert.match(source, /onContextMenu/);
    assert.match(source, /event\.key !== 'ContextMenu'/);
    assert.match(source, /event\.shiftKey && event\.key === 'F10'/);
    assert.match(source, /event\.preventDefault\(\)/);
    assert.match(source, /event\.stopPropagation\(\)/);
  }
  assert.match(categories, /\+ NEW CATEGORY/);
});

test('Browser styling uses established lattice semantics and a centered nonmodal window', () => {
  assert.match(styles, /var\(--lattice-menu-panel\)/);
  assert.match(styles, /var\(--lattice-menu-ink\)/);
  assert.match(styles, /--lattice-browser-surface: var\(--lattice-menu-panel\)/);
  assert.match(styles, /--lattice-browser-ink: var\(--lattice-menu-ink\)/);
  assert.doesNotMatch(styles, /data-lattice-surface/);
  assert.match(styles, /position: fixed/);
  assert.match(styles, /translate: -50% -50%/);
  assert.doesNotMatch(styles, /backdrop-filter|orange|border-radius:\s*(?:[1-9]|0\.[1-9])/iu);
});
