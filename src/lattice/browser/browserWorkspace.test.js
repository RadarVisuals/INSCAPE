import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspace = readFileSync(new URL('./BrowserWorkspace.jsx', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./BrowserFixtureHarness.jsx', import.meta.url), 'utf8');
const categoryDialog = readFileSync(new URL('./BrowserCategoryDialog.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./browserWorkspace.css', import.meta.url), 'utf8');
const unifiedPanel = readFileSync(new URL('./BrowserUnifiedPanel.jsx', import.meta.url), 'utf8');
import { BROWSER_VIEW_KINDS, browserViewAssets, categoryMembershipState, filterAndSortBrowserAssets, updateBrowserSelection } from './browserWorkspaceModel.js';

test('Browser is one unified navigation, toolbar, results, and footer surface', () => {
  assert.match(workspace, /categoryCommands = null,[\s\S]*onActiveTabChange,[\s\S]*tabRequest = null/);
  assert.match(workspace, /BrowserUnifiedPanel/);
  assert.doesNotMatch(workspace, /role="tablist"|BrowserIndexPanel|BrowserCategoriesPanel/);
  assert.match(unifiedPanel, /All Assets/);
  assert.match(unifiedPanel, /Unsorted/);
  assert.match(unifiedPanel, /Used on Canvas/);
  assert.doesNotMatch(unifiedPanel, /Favorites/);
  assert.doesNotMatch(unifiedPanel, /MEDIA_ICONS|<small>MEDIA<\/small>|Filter media type|AudioLines|Video|Box/);
  assert.match(unifiedPanel, /HIDE LABELS/);
  assert.match(unifiedPanel, /aria-label="Asset preview size"/);
  assert.doesNotMatch(unifiedPanel, /aria-label="Grid view"|aria-label="List view"|lattice-browser-view-controls/);
  assert.match(workspace, /PLACE PUBLIC/);
  assert.match(workspace, /disabled=\{!placementEnabled\}/);
  assert.match(workspace, /onPlaceAsset\?\.\(workspace\.selectedAsset\.stableAssetId\)/);
  assert.match(workspace, /categoryCommands\.createCategory/);
  assert.match(workspace, /categoryCommands\.setCategoryAssets/);
  assert.doesNotMatch(workspace, /requestPlacement|toggleFavorite|useLibraryStore/);
  assert.doesNotMatch(workspace, /useLibraryStore|localStorage|sessionStorage|wallet|IPFS|createPlacementAtAnchor|normalizedInsertionAnchor/iu);
});

test('fixture adapter remains session-only prototype evidence and is not imported by the Browser', () => {
  assert.match(fixture, /ISOLATED|fixture/i);
  assert.match(fixture, /requestPlacement/);
  assert.doesNotMatch(fixture, /RADAR|VXCTXR|RESIDENT ZERO|localStorage|sessionStorage|Date\.|Math\.random|useLibraryStore/iu);
  assert.doesNotMatch(workspace, /BrowserFixtureHarness|latticeEngineFixtures/);
});

test('Category dialogs reject empty input and categories use the shared result surface', () => {
  assert.match(categoryDialog, /setName\(categoryDialogInitialName\(dialog\)\)/);
  assert.match(workspace, /BrowserCategoryDialog/);
  assert.match(categoryDialog, /if \(!deletion && !name\.trim\(\)\) return/);
  assert.match(categoryDialog, /ASSETS AND LATTICE PLACEMENTS ARE NOT AFFECTED/);
  assert.match(unifiedPanel, /workspace\.filteredAssets/);
  assert.match(unifiedPanel, /NO ASSETS IN THIS VIEW/);
  assert.match(unifiedPanel, /NONE MATCH THE ACTIVE SEARCH OR FILTERS/);
  assert.match(unifiedPanel, /CLEAR SEARCH \/ FILTERS/);
});

test('category and multi-asset menus use shared RackMenu with mixed membership and focus restoration', () => {
  const assets = readFileSync(new URL('./BrowserAssetResults.jsx', import.meta.url), 'utf8');
  assert.match(workspace, /import RackMenu/);
  assert.match(workspace, /<RackMenu/);
  assert.match(workspace, /createPortal\(<RackMenu/);
  assert.match(workspace, /document\.querySelector\('\.owner-lattice-shell'\) \|\| document\.body/);
  assert.match(workspace, /returnFocus=\{contextMenu\.trigger\}/);
  assert.match(workspace, /NO CATEGORIES YET/);
  assert.match(workspace, /categoryMembershipState/);
  assert.match(workspace, /mixed: state === 'mixed'/);
  assert.match(workspace, /REMOVE FROM \$\{currentMembershipCategory\.name\}/);
  assert.match(workspace, /setCategoryAssets\(commandId\.slice\('remove-current:'\.length\), contextMenu\.assetIds, false\)/);
  assert.match(unifiedPanel, /data-browser-category-id/);
  assert.match(workspace, /organizationDrag/);
  assert.match(workspace, /setCategoryAssets\(categoryId, assetIds, true\)/);
  for (const source of [assets]) {
    assert.match(source, /onContextMenu/);
    assert.match(source, /event\.key !== 'ContextMenu'/);
    assert.match(source, /event\.shiftKey && event\.key === 'F10'/);
    assert.match(source, /event\.preventDefault\(\)/);
    assert.match(source, /event\.stopPropagation\(\)/);
  }
  assert.match(unifiedPanel, /aria-label="Create category"/);
});

test('category creation stays outside the scrolling category rows and internal status copy is absent', () => {
  assert.match(unifiedPanel, /lattice-browser-sidebar__category-heading/);
  assert.match(unifiedPanel, /lattice-browser-category-list/);
  assert.doesNotMatch(unifiedPanel, /lattice-browser-sidebar__rule/);
  assert.match(styles, /\.lattice-browser-category-list \{[^}]*flex: 1;[^}]*overflow: auto;/s);
  assert.match(styles, /\.lattice-browser-sidebar > small \{[^}]*border-bottom: 1px solid var\(--lattice-browser-line-strong\)/s);
  assert.doesNotMatch(workspace, /OWNER TOOL \/ 01|ORGANIZATION WRITABLE \/ PROFILE SCOPED/);
  assert.match(styles, /button\[data-active\]::before \{ background: var\(--lattice-browser-ink\); \}/);
});

test('derived views, deterministic sorting, and session selection are pure and progressive-safe', () => {
  const assets = [{ id: 'a', title: 'Zulu', mediaType: 'image', collection: 'B' }, { id: 'b', title: 'Alpha', mediaType: 'video', collection: 'A' }, { id: 'c', title: 'Beta', mediaType: 'image', collection: 'A' }];
  const categories = [{ id: 'folder', assetIds: ['a'] }];
  assert.deepEqual(browserViewAssets(assets, categories, { kind: BROWSER_VIEW_KINDS.UNSORTED }).map(({ id }) => id), ['b', 'c']);
  assert.deepEqual(browserViewAssets(assets, categories, { kind: BROWSER_VIEW_KINDS.USED }, ['c']).map(({ id }) => id), ['c']);
  assert.deepEqual(filterAndSortBrowserAssets(assets).map(({ id }) => id), ['b', 'c', 'a']);
  let selection = updateBrowserSelection([], assets, 'a');
  selection = updateBrowserSelection(selection.selectedIds, assets, 'c', { anchorId: selection.anchorId, range: true });
  assert.deepEqual(selection.selectedIds, ['a', 'b', 'c']);
  assert.deepEqual(updateBrowserSelection(selection.selectedIds, assets, 'b', { additive: true, anchorId: selection.anchorId }).selectedIds, ['a', 'c']);
  assert.equal(categoryMembershipState({ assetIds: ['a'] }, ['a', 'c']), 'mixed');
});

test('Browser styling uses established lattice semantics and a centered nonmodal window', () => {
  assert.match(styles, /var\(--lattice-menu-panel\)/);
  assert.match(styles, /var\(--lattice-menu-ink\)/);
  assert.match(styles, /--lattice-browser-frame: rgb\(from var\(--lattice-menu-panel\) r g b\)/);
  assert.match(styles, /--lattice-browser-ink: var\(--lattice-menu-ink\)/);
  assert.match(styles, /--lattice-browser-recessed-tone: color-mix/);
  assert.match(styles, /--lattice-browser-faceplate-tone: color-mix/);
  assert.match(styles, /--lattice-browser-results-tone: color-mix/);
  assert.match(styles, /--lattice-browser-card-tone: color-mix/);
  assert.match(styles, /--lattice-browser-selected-tone: color-mix/);
  assert.match(styles, /box-shadow: inset 3px 0 var\(--lattice-browser-ink\)/);
  assert.match(styles, /\.lattice-browser-asset\[data-multi-selected\]/);
  assert.match(styles, /\.lattice-browser-asset:focus-visible/);
  assert.match(styles, /\.lattice-browser-footer button \{[^}]*background: var\(--lattice-browser-ink\);[^}]*color: var\(--lattice-browser-frame\)/s);
  assert.doesNotMatch(styles, /data-lattice-surface/);
  assert.match(styles, /position: fixed/);
  assert.match(styles, /translate: -50% -50%/);
  assert.doesNotMatch(styles, /backdrop-filter|orange|border-radius:\s*(?:[1-9]|0\.[1-9])/iu);
});

test('Browser assets expose a distinct multi-selection surface hook', () => {
  const assets = readFileSync(new URL('./BrowserAssetResults.jsx', import.meta.url), 'utf8');
  assert.match(assets, /selectedAssetIds = \[\]/);
  assert.match(assets, /selectedIds\.size > 1/);
  assert.match(assets, /data-multi-selected=\{multiSelected \|\| undefined\}/);
});

test('Browser preview sizing and optional labels share one session-only visual control', () => {
  const assets = readFileSync(new URL('./BrowserAssetResults.jsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('./useBrowserWorkspace.js', import.meta.url), 'utf8');
  assert.match(hook, /useState\(BROWSER_ASSET_SIZE\.DEFAULT\)/);
  assert.match(hook, /assetSizeBounds: BROWSER_ASSET_SIZE, setAssetSize/);
  assert.match(hook, /sidebarWidth, sidebarResize:/);
  assert.match(hook, /hideLabels, setHideLabels/);
  assert.match(assets, /data-size=\{resolvedAssetSize\}/);
  assert.match(assets, /--lattice-browser-asset-min/);
  assert.match(assets, /data-labels=\{hideLabels \? 'hidden' : 'visible'\}/);
  assert.match(assets, /\{!hideLabels && <span className="lattice-browser-asset__record">/);
  assert.match(assets, /aria-label=\{\[asset\.title \|\| asset\.stableAssetId, asset\.collection\]/);
  assert.match(styles, /data-size="list"/);
  assert.match(styles, /grid-template-columns: var\(--lattice-browser-sidebar-width, 174px\) 7px/);
  assert.match(styles, /@container \(max-width: 76px\)/);
  for (const obsoleteSize of ['small', 'big', 'bigger']) assert.doesNotMatch(styles, new RegExp(`data-size="${obsoleteSize}"`));
  assert.match(styles, /--lattice-browser-section-tone: color-mix\(in srgb, var\(--lattice-browser-frame\) 82%/);
  assert.match(styles, /button\[data-active\] \{ background: var\(--lattice-browser-selected-tone\)/);
});

test('Browser reveals decoded backgrounds only and never renders placeholder or broken-image surfaces', () => {
  const assets = readFileSync(new URL('./BrowserAssetResults.jsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('./useBrowserWorkspace.js', import.meta.url), 'utf8');
  assert.match(assets, /lattice-browser-asset__decoded-image/);
  assert.match(assets, /loading="lazy"/);
  assert.match(assets, /decoding="async"/);
  assert.match(assets, /onMediaUnavailable/);
  assert.doesNotMatch(assets, /MEDIA UNRESOLVED|TYPE UNRESOLVED|UNRESOLVED ASSET/);
  assert.match(hook, /resolveBrowserPreview/);
  assert.match(hook, /status: 'pending'/);
  assert.match(hook, /status: 'unavailable'/);
  assert.match(hook, /isAssetRenderable/);
  assert.match(workspace, /workspace\.areAssetsRenderable\(contextMenu\.assetIds\)/);
  assert.match(workspace, /workspace\.isAssetRenderable\(workspace\.selectedAsset\?\.stableAssetId\)/);
  assert.match(unifiedPanel, /UNAVAILABLE/);
  assert.match(unifiedPanel, /UNRESOLVED/);
});

const browserThemes = {
  Carbon: [[216, 215, 210], [16, 17, 17]],
  Graphite: [[232, 231, 226], [48, 50, 50]],
  Slate: [[243, 242, 237], [103, 104, 104]],
  Ash: [[17, 19, 19], [221, 220, 214]],
  Mist: [[17, 19, 19], [215, 211, 202]],
  Paper: [[17, 19, 19], [239, 237, 230]],
};
const mix = (first, second, firstWeight) => first.map((channel, index) => (
  channel * firstWeight + second[index] * (1 - firstWeight)));
const relativeLuminance = (rgb) => rgb.map((channel) => channel / 255)
  .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrastRatio = (first, second) => {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test('Browser owner-token hierarchy keeps essential small text AA-readable in every owner theme', () => {
  for (const [theme, [ink, panel]] of Object.entries(browserThemes)) {
    const labelInk = mix(ink, panel, 0.98);
    for (const [surface, panelWeight] of Object.entries({ results: 0.98, recessed: 0.97, faceplate: 0.97, card: 0.97 })) {
      assert.ok(contrastRatio(labelInk, mix(panel, ink, panelWeight)) >= 4.5,
        `${theme} ${surface} small-label contrast must be at least 4.5:1`);
    }
    assert.ok(contrastRatio(ink, mix(panel, ink, 0.95)) >= 4.5,
      `${theme} selected navigation text must remain at least 4.5:1`);
    assert.ok(contrastRatio(ink, panel) >= 4.5,
      `${theme} PLACE action must retain maximum owner-theme contrast`);
  }
});
