import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('Task 3 adapter reuses real Browser content authorities without importing window or Rack composition', async () => {
  const source = await read('./Modul8rLibraryAdapter.jsx');
  assert.match(source, /useBrowserWorkspace/);
  assert.match(source, /Modul8rLibraryPanel/);
  assert.match(source, /BrowserFilterControls/);
  assert.match(source, /BrowserCategoryDialog/);
  assert.match(source, /RackMenu/);
  assert.match(source, /categoryMembershipState/);
  assert.doesNotMatch(source, /<BrowserWorkspace|from ['"][^'"]*\/BrowserWorkspace|LatticeRackShell|lattice-rack-/);
  assert.doesNotMatch(source, /prototypes\/modul8r|modul8rFixtures/);
});

test('Task 5 uses an independent creator store, pure union, honest viewer and existing placement callback', async () => {
  const [integration, panel, union, owner, authoring] = await Promise.all([
    read('./Modul8rOwnerLibraryDevelopment.jsx'), read('./Modul8rLibraryPanel.jsx'),
    read('../browser/libraryAssetUnion.js'), read('../../public/OwnerLatticeShell.jsx'),
    read('../../public/useOwnerLatticeAuthoring.js'),
  ]);
  assert.match(integration, /createCreationsStore\(\{ retainOnRetry: true \}\)/);
  assert.match(integration, /projectLibraryAssetUnion/);
  assert.match(integration, /LatticeFocusViewer/);
  assert.match(integration, /onRelatedAssetRecordsChange/);
  assert.match(panel, /All Assets[\s\S]*Owned[\s\S]*Created[\s\S]*Unsorted/);
  assert.doesNotMatch(panel, /Used on Canvas|BROWSER_VIEW_KINDS\.USED/);
  assert.match(panel, /NOT OWNED/);
  assert.match(panel, /onDoubleClick/);
  assert.match(panel, /CREATED SOURCE UNAVAILABLE[\s\S]*RETRY/);
  assert.match(union, /isStrongCreatedAsset/);
  assert.match(owner, /onAssetPointerDown=\{beginBrowserAssetDrag\}/);
  assert.match(authoring, /supplementalAssetRecords/);
  assert.doesNotMatch(integration, /\buseCreationsStore\(/);
});

test('Task 6 removes USED ON CANVAS only from MODUL-8R Library and keeps the old Browser authority', async () => {
  const [panel, oldPanel] = await Promise.all([
    read('./Modul8rLibraryPanel.jsx'), read('../browser/BrowserUnifiedPanel.jsx'),
  ]);
  assert.doesNotMatch(panel, /Used on Canvas|BROWSER_VIEW_KINDS\.USED/);
  assert.match(oldPanel, /Used on Canvas[\s\S]*BROWSER_VIEW_KINDS\.USED/);
});

test('closing retains accepted creator authority while profile change and unmount clear it without progressive gaps', async () => {
  const integration = await read('./Modul8rOwnerLibraryDevelopment.jsx');
  assert.match(integration, /if \(!open\) \{ cancelCreated\(\); return; \}/);
  assert.match(integration, /createdProfileAddress !== profileAddress \|\| createdStatus === 'idle'/);
  assert.match(integration, /onRelatedAssetRecordsChange\?\.\(acceptedRelatedRecords\)/);
  assert.doesNotMatch(integration, /open \? union\.records/);
  assert.match(integration, /useEffect\(\(\) => \(\) => relatedRecordsCallbackRef\.current\?\.\(\[\]\), \[profileAddress\]\)/);
  assert.doesNotMatch(integration, /relatedRecordsCallbackRef\.current\?\.\(\[\]\), \[onRelatedAssetRecordsChange/);
  assert.doesNotMatch(integration, /union\.records[\s\S]{0,180}return \(\) => onRelatedAssetRecordsChange/);
});

test('Task 3 adapter exposes real query, size, unavailable, progressive, selection and category interaction seams', async () => {
  const source = await read('./Modul8rLibraryAdapter.jsx');
  for (const contract of [
    'workspace.setQuery', 'workspace.setAssetSize', 'workspace.unavailableCount', 'data.progress',
    'workspace.selectForContext', 'workspace.clearSelection', 'workspace.areAssetsRenderable',
    'createCategory', 'renameCategory', 'deleteCategory', 'setCategoryAssets', 'setCategoryPublic',
    'onAssetPointerDown',
  ]) assert.equal(source.includes(contract), true, `missing ${contract}`);
  assert.match(source, /pointercancel/);
  assert.match(source, /requestAnimationFrame\(\(\) => trigger\?\.focus/);
  assert.match(source, /selectedIds\.length === 1\) onAssetPointerDown\?\.\(event, asset, workspace, \{ placementPreset: 'compact' \}\)/);
  assert.match(source, /if \(!categoryId\) \{[\s\S]*setOrganizationDrag\(null\)/);
});

test('live-owner integration stays DEV-only and delegates canvas placement to the existing owner callback', async () => {
  const [main, owner, integration] = await Promise.all([
    read('../../main.jsx'),
    read('../../public/OwnerLatticeShell.jsx'),
    read('./Modul8rOwnerLibraryDevelopment.jsx'),
  ]);
  assert.match(main, /modul8rLiveOwnerRoute/);
  assert.match(owner, /import\.meta\.env\.DEV[\s\S]*Modul8rOwnerLibraryDevelopment/);
  assert.match(owner, /onAssetPointerDown=\{beginBrowserAssetDrag\}/);
  assert.match(owner, /browserOpen \|\| developmentModul8rActive/);
  assert.match(integration, /Modul8rLibraryAdapter/);
  assert.match(integration, /aria-pressed=\{arrangeEnabled\}/);
  assert.match(owner, /onArrangeToggle=\{\(\) => activateWorkspaceTool\('arrange'\)\}/);
  assert.doesNotMatch(integration, /useLibraryStore|useOwnerLatticeAuthoring|BrowserWorkspace|LatticeRackShell/);
});

test('Library presentation stylesheet owns no old Rack selectors or Browser window geometry variables', async () => {
  const [css, source] = await Promise.all([read('./modul8rLibrary.css'), read('./Modul8rLibraryAdapter.jsx')]);
  assert.doesNotMatch(css, /lattice-rack-/);
  assert.doesNotMatch(css, /--lattice-browser-(window|rack)-(left|top|width|height)/);
  assert.match(css, /\.modul8r-library/);
  assert.match(css, /grid-template-columns: 140px 7px minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns: 112px 7px minmax\(0, 1fr\)/);
  assert.match(css, /--modul8r-library-field-inset: 6px/);
  assert.match(css, /\.modul8r-library \.lattice-browser-results \{[\s\S]*padding: var\(--modul8r-library-field-inset\) var\(--modul8r-library-field-inset\) 0 0;[\s\S]*border-bottom: var\(--modul8r-library-field-inset\) solid var\(--lattice-browser-results-tone\)/);
  assert.match(css, /\.modul8r-library__faceplate-controls \{[\s\S]*grid-template-rows: 38px 22px/);
  assert.match(css, /\.modul8r-library__filters \{[\s\S]*height: 22px/);
  assert.doesNotMatch(css, /\.modul8r-library__filters \{[^}]*border-top/s);
  assert.match(css, /grid-template-columns: 96px 58px 74px auto;[\s\S]*justify-content: end;[\s\S]*padding-right: 8px/);
  assert.match(css, /\.lattice-browser-toolbar-select::after \{ inset: 0 8px 0 auto;/);
  assert.match(css, /\.lattice-browser-label-toggle \{[^}]*justify-content: flex-end;[^}]*border-right: 0;/s);
  assert.match(css, /:is\(option, optgroup\) \{ background: Canvas; color: CanvasText; \}/);
  assert.match(css, /\.lattice-browser-clear-filters \{[^}]*border: 0;[^}]*font-size: 0;/s);
  assert.doesNotMatch(css, /\.lattice-browser-clear-filters \{[^}]*border-left/s);
  assert.match(css, /--modul8r-library-scrollbar: color-mix\(in srgb, var\(--lattice-menu-panel\) 82%, var\(--lattice-menu-ink\)\)/);
  assert.match(css, /scrollbar-color: var\(--modul8r-library-scrollbar\) transparent/);
  assert.match(css, /\.lattice-browser-results::-webkit-scrollbar-thumb \{[\s\S]*background: var\(--modul8r-library-scrollbar\)/);
  assert.match(css, /\.modul8r-library \.lattice-browser-assets \{[\s\S]*gap: var\(--modul8r-library-field-inset\)/);
  assert.match(css, /\.lattice-browser-assets:not\(\[data-size="list"\]\) \.lattice-browser-asset__media \{[\s\S]*aspect-ratio: 1 \/ 1 !important/);
  assert.match(css, /\.lattice-browser-assets:not\(\[data-size="list"\]\) \.lattice-browser-asset__decoded-image \{[\s\S]*object-fit: cover/);
  assert.match(css, /\.lattice-browser-sidebar__category-heading > \.lattice-browser-sidebar__create \{[\s\S]*justify-content: flex-start/);
  assert.match(css, /@container \(max-width: 118px\)[\s\S]*justify-content: center;[\s\S]*display: none;/);
  assert.match(css, /\.modul8r-library \.lattice-browser-sidebar-resize \{[\s\S]*border: 0;[\s\S]*background: transparent/);
  assert.match(css, /\.modul8r-library \.lattice-browser-sidebar-resize::after \{[\s\S]*inset: 0 auto 0 0;[\s\S]*width: 1px/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*grid-template-columns: minmax\(50px, 1fr\) 104px 22px/);
  assert.match(css, /grid-template-columns: 82px 54px 70px auto; padding-right: 4px/);
  assert.match(css, /\.modul8r-library__size \{ gap: 4px; \}/);
  assert.match(css, /\.modul8r-library__size input \{ min-width: 24px; width: auto; flex: 1 1 auto; \}/);
  assert.match(css, /\.modul8r-library__size > span \{ font: var\(--lattice-window-type-label\)/);
  assert.match(css, /\.modul8r-library__unavailable \{ flex: 0 0 22px;[\s\S]*justify-content: center/);
  assert.match(source, /aria-label=\{`\$\{workspace\.unavailableCount\} unavailable assets`\}/);
  assert.doesNotMatch(source, />\{workspace\.unavailableCount\} UNAVAILABLE</);
  assert.match(source, /labelsControlMode="show"/);
  assert.match(source, /<Modul8rLibraryPanel/);
  assert.match(source, /<output>\{workspace\.assetSize\}<\/output>/);
  assert.doesNotMatch(source, /\? 'LIST'/);
});
