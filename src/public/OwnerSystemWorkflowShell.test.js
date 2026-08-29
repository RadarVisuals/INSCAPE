import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('System Workflow production shell preserves the Phase 3 authority and isolation boundary', async () => {
  const [shell, runtime, main, selection, preview, styles, globalBar, loader, publicationRack, isolation, productionBuild] = await Promise.all([
    read('./OwnerSystemWorkflowShell.jsx'), read('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx'), read('../main.jsx'),
    read('./ownerRuntimeSelected.js'), read('./ownerSystemWorkflowPreviewDocument.js'), read('./ownerSystemWorkflow/ownerSystemWorkflow.css'),
    read('./ownerSystemWorkflow/OwnerSystemWorkflowGlobalBar.jsx'), read('./ownerRuntimeLoader.js'),
    read('./ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx'), read('../../scripts/ownerRuntimeIsolation.js'),
    read('../../scripts/productionBuild.js'),
  ]);
  const names = await readdir(new URL('./ownerSystemWorkflow/', import.meta.url));
  const productionNames = names.filter((name) => name !== 'OwnerSystemWorkflowDevelopmentEntrance.jsx');
  const productionSources = await Promise.all(productionNames.map((name) => read(`./ownerSystemWorkflow/${name}`)));
  assert.equal(selection.includes("OWNER_RUNTIME_SELECTION = 'SYSTEM_WORKFLOW'"), true);
  assert.match(selection, /import\('\.\/OwnerSystemWorkflowShell\.jsx'\)/);
  assert.match(loader, /SYSTEM_WORKFLOW: 'SYSTEM_WORKFLOW'/);
  assert.doesNotMatch(loader, /selectOwnerRuntimeImporter|MODUL8R|\bLATTICE\b|\bLEGACY\b/u);
  assert.match(isolation, /OwnerSystemWorkflowShell\.jsx/);
  assert.match(productionBuild, /src\/public\/OwnerSystemWorkflowShell\.jsx/);
  assert.match(main, /import\.meta\.env\.DEV[\s\S]*\/development\/owner\/system-workflow/);
  assert.match(shell, /OwnerSystemWorkflowReconciliationBoundary/);
  const reconciliationBoundary = productionSources.find((source) => source.includes('reconcileStoredOwnerDraftWithPublishedProfile'));
  assert.match(reconciliationBoundary, /lazy\(\(\) => import\('\.\/OwnerSystemWorkflowRuntime\.jsx'\)\)/);
  assert.match(runtime, /buildOwnerSystemWorkflowPreviewDocument/);
  assert.match(runtime, /ProfileDocumentV9Preview/);
  assert.match(runtime, /lazy\(\(\) => import\('\.\/OwnerSystemWorkflowPublicationRack\.jsx'\)\)/);
  assert.match(runtime, /onPublish=\{\(event\) => togglePublication\(event\.currentTarget\)\}/);
  assert.match(runtime, /getWalletPublicationContext=\{getWalletPublicationContext\}/);
  assert.match(runtime, /publishedResolution=\{publishedResolution\}/);
  assert.match(runtime, /onPublished=\{\(result\) => \{[\s\S]*recordOwnerPublicationBaseline[\s\S]*onPublicationConfirmed\?\.\(result\)/u);
  assert.match(runtime, /onSnapshotChange=\{\(\{ document \}\) => onPreviewDocumentChange\?\.\(document\)\}/);
  assert.match(globalBar, /aria-expanded=\{publicationOpen\} aria-label="Publish"/);
  assert.match(publicationRack, /uploadProfileDocument\(snapshot\)/);
  assert.match(publicationRack, /publication\.verifyCid\(snapshot, uploaded\.cid/);
  assert.match(publicationRack, /publication\.publish\(\)/);
  assert.match(publicationRack, /data-lattice-menu-surface data-menu-surface=\{menuSurface\}/);
  assert.match(runtime, /menuSurface=\{menuSurface\}/);
  assert.match(runtime, /globalThis\.setTimeout\(dismissNotice, 4_500\)/,
    'operation notices dismiss automatically instead of permanently covering the workspace');
  assert.match(runtime, /aria-label="Dismiss notification"[\s\S]*onClick=\{dismissNotice\}/,
    'operation notices clear both runtime and controller errors when clicked');
  assert.match(productionSources.find((source) => source.includes('useOwnerSystemWorkflowController')), /clearError/);
  assert.match(preview, /buildProfileDocumentV9/);
  assert.equal([shell, runtime, ...productionSources].some((source) => /src\/prototypes|\.\.\/prototypes|prototype\/owner-shell-system/iu.test(source)), false);
  assert.equal([runtime, ...productionSources].some((source) => /localStorage\.(setItem|removeItem)|sessionStorage\.(setItem|removeItem)/u.test(source)), false);
  assert.equal(productionSources.some((source) => /lattice\/modul8r|Modul8rLibrary/iu.test(source)), false);
  assert.equal(runtime.includes('reviewAssets') && runtime.includes('reviewStorage'), true);
  assert.match(styles, /\[data-panel-phase="closing"\] \.system-workflow__motion-panel/,
    'nested Profile panels receive the same bounded exit motion as sibling panels');
  assert.doesNotMatch(styles, /\[data-panel-phase="closing"\] > \.system-workflow__motion-panel/);
  assert.match(styles, /--workflow-border-strong: var\(--workflow-border\)/);
  assert.match(styles, /--workflow-type-display: 600 28px\/1\.08 "Inscape Sora", sans-serif/);
  assert.match(styles, /--workflow-type-title: 600 18px\/1\.15 "Inscape Sora", sans-serif/);
  assert.match(styles, /--workflow-type-section: 600 15px\/1\.2 "Inscape Sora", sans-serif/);
  assert.match(styles, /--workflow-type-body: 400 14px\/1\.5 "Inscape Sora", sans-serif/);
  assert.match(styles, /--workflow-type-control: 400 11px\/1\.2 "Inscape Sora", sans-serif/);
  assert.match(styles, /--workflow-type-label: 500 10px\/1\.25 "Inscape IBM Plex Sans Condensed", "Arial Narrow", sans-serif/);
  assert.match(styles, /--workflow-type-micro: 400 10px\/1\.35 "Inscape IBM Plex Sans Condensed", "Arial Narrow", sans-serif/);
  assert.match(styles, /--workflow-type-technical: 400 10px\/1\.35 "Inscape IBM Plex Sans Condensed", "Arial Narrow", sans-serif/);
  assert.match(styles, /\.system-workflow \{[\s\S]*font-family: "Inscape Sora", sans-serif;/);
  assert.match(styles, /\.system-workflow__select-popover, \.system-workflow__filter-popover \{[^}]*font-family: "Inscape Sora", sans-serif;/s);
  assert.match(styles, /\.system-workflow__select-popover :where\(code, output, \[data-technical\], \.technical-value\)[^}]*font-family: "Inscape IBM Plex Sans Condensed", "Arial Narrow", sans-serif;/s);
  assert.match(styles, /\.system-workflow__discover-avatar \{[^}]*font: 600 22px\/1 "Inscape Sora", sans-serif;/s);
  assert.doesNotMatch(styles, /Inscape Geist Sans|Inscape IBM Plex Mono/);
  assert.match(styles, /--workflow-type-sidebar: 450 11px\/1\.1 "Inscape Sora", sans-serif/);
  assert.match(styles, /\.system-workflow__browser-workspace \.lattice-browser-sidebar button \{[^}]*font: var\(--workflow-type-sidebar\)/s);
  assert.match(styles, /mask: url\('\/assets\/brand\/inscape-wordmark\.svg'\) center \/ contain no-repeat/);
  assert.match(styles, /stroke-width: 1\.75/);
  assert.match(globalBar, /aria-label="Inscape"/);
  assert.match(styles, /\.system-workflow__grid-rename button \{[^}]*border: 0;[^}]*border-left: 1px solid var\(--workflow-border\)/s);
  assert.match(styles, /\.system-workflow__presentation-controls > footer button \+ button \{ border-left: 0; \}/);
  assert.match(styles, /\.system-workflow__crop-controls footer button \+ button \{ border-left: 0; \}/);
  assert.match(styles, /\.system-workflow__canvas \{[^}]*box-shadow: none/s);
  assert.match(styles, /\.system-workflow__global-bar \{[^}]*border-top: 1px solid var\(--workflow-border\);[^}]*box-shadow: none/s);
});

test('System Workflow dock tools cannot expand into the INSCAPE wordmark', async () => {
  const [styles, globalBar, runtime] = await Promise.all([
    read('./ownerSystemWorkflow/ownerSystemWorkflow.css'),
    read('./ownerSystemWorkflow/OwnerSystemWorkflowGlobalBar.jsx'),
    read('./ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx'),
  ]);
  assert.match(styles, /\.system-workflow__global-bar \{[^}]*grid-template-columns: minmax\(0, 1fr\) 104px 132px;/s,
    'the wide dock reserves bounded columns for its compact tools and wordmark');
  assert.match(styles, /\.system-workflow__dock-tools \{[^}]*--workflow-dock-tool-size: 28px;[^}]*grid-template-columns: repeat\(3, 28px\);[^}]*justify-content: center;[^}]*gap: 3px;/s,
    'wide dock tools form one compact centered group before the wordmark');
  assert.match(styles, /\.system-workflow__global-bar \.system-workflow__dock-tools > button \{[^}]*width: var\(--workflow-dock-tool-size\);[^}]*min-width: var\(--workflow-dock-tool-size\);[^}]*padding: 0;[^}]*display: grid;/s,
    'dock tools retain their bounded footprint instead of inheriting the 104px navigation-button width');
  assert.match(styles, /\.system-workflow__dock-tools > button > svg \{[^}]*width: 17px;[^}]*height: 17px;/s);
  assert.match(styles, /\.system-workflow__global-bar \.system-workflow__dock-tools > button:is\(:hover, :focus-visible\) \{[^}]*color: var\(--workflow-muted\);[^}]*background: transparent;/s);
  assert.match(styles, /\.system-workflow__global-bar \.system-workflow__dock-tools > button\[aria-expanded="true"\] \{[^}]*color: var\(--workflow-ink\);[^}]*background: transparent;/s,
    'dock tools use color alone to communicate an open panel');
  assert.match(styles, /\.system-workflow__global-bar \.system-workflow__dock-tools > \.system-workflow__layers-trigger\[aria-expanded\] \{[^}]*color: var\(--workflow-muted\);/s,
    'the automatically visible Layers tool starts muted instead of looking permanently selected');
  assert.match(styles, /\.system-workflow__global-bar \.system-workflow__dock-tools > \.system-workflow__layers-trigger\[data-layers-activated\] \{[^}]*color: var\(--workflow-ink\);/s,
    'an explicitly opened Layers tool can ink without restoring the old selector');
  assert.match(styles, /\.system-workflow \.system-workflow__layers-trigger > svg \{[^}]*color: currentColor;[^}]*stroke: currentColor;/s,
    'the Layers glyph follows its muted trigger color instead of forcing ink directly');
  assert.doesNotMatch(styles, /\.system-workflow \.system-workflow__layers-trigger > svg \{[^}]*var\(--workflow-ink\)/s);
  assert.match(styles, /\.system-workflow__global-bar nav button:is\(\[aria-pressed="true"\], \[aria-expanded="true"\]\)::before/,
    'the horizontal navigation marker does not apply to dock tools');
  assert.match(styles, /\.system-workflow__select-popover button, \.system-workflow__filter-options > button \{[^}]*font: 400 10px\/1\.2 "Inscape Sora", sans-serif;[^}]*font-variation-settings: "wght" 400;[^}]*letter-spacing: 0;/s,
    'dropdown options reuse the Library asset-title typography');
  assert.doesNotMatch(styles, /\.system-workflow__select-popover (?:header|button)[^}]*Inscape Bahnschrift/s,
    'opening a dropdown does not switch back to Bahnschrift');
  assert.match(globalBar, /FileText[\s\S]*Settings2[\s\S]*Layers3/,
    'workspace tools keep documentation and settings before the persistent Layers control');
  assert.doesNotMatch(globalBar, /Layers2/,
    'the persistent Layers control retains the established three-layer glyph');
  assert.match(globalBar, /data-layers-activated=\{layersActivated \|\| undefined\}/);
  assert.match(runtime, /layersActivated=\{layersExplicitlyOpened && layersOpen && !panelOccupied\}/);
});
