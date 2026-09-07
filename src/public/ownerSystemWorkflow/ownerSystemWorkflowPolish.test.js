import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ownerSystemWorkflowActivityDetail } from './useOwnerSystemWorkflowActivity.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('activity prefers resolved profile names and keeps a bounded address fallback', () => {
  const entry = { counterparty: '0x1234567890abcdef1234567890abcdef12345678' };
  assert.equal(ownerSystemWorkflowActivityDetail(entry, { name: 'RADAR VISUALS' }), 'RADAR VISUALS');
  assert.equal(ownerSystemWorkflowActivityDetail(entry), '0x123456…45678');
});

test('Library remains mounted after first open without retaining an interactive hidden panel', () => {
  const source = read('./OwnerSystemWorkflowPanelLayer.jsx');
  assert.match(source, /const libraryMounted = useRef\(false\)/);
  assert.match(source, /hidden=\{retained && !state\.present\}/);
  assert.match(source, /inert=\{retained && !state\.present \? '' : undefined\}/);
  assert.match(source, /libraryMounted\.current && <PanelPresence id="library" panels=\{panels\} retained>/);
});

test('Grid navigation is explicitly Space-drag and both moving planes render their architectural grid', () => {
  const interaction = read('./useOwnerSystemWorkflowPlacementInteraction.js');
  const canvas = read('./OwnerSystemWorkflowCanvas.jsx');
  const pixelGrid = read('../../lattice/rendering/LatticePixelGrid.jsx');
  const styles = read('./ownerSystemWorkflow.css');
  assert.match(interaction, /event\.code !== 'Space'/);
  assert.match(interaction, /beginCanvasSelection\(event, \{ navigationOnly: true \}\)/);
  assert.match(interaction, /authoringDisabled && !navigationOnly/);
  assert.match(interaction, /navigationOnly && Math\.abs\(deltaX\)/);
  assert.doesNotMatch(interaction, /!event\.shiftKey && Math\.abs\(deltaX\)/);
  assert.match(canvas, /renderedGrids\.map\([\s\S]*key=\{scene\.id\}[\s\S]*<LatticePixelGrid/);
  assert.match(pixelGrid, /createLatticePixelGuideBounds\(field, spacing \/ 2\)/);
  assert.match(pixelGrid, /<clipPath[^>]*clipPathUnits="userSpaceOnUse"[\s\S]*<rect \{\.\.\.geometry\.bounds\}/);
  assert.equal((pixelGrid.match(/clipPath=\{geometry\.bounds/g) || []).length, 2);
  assert.doesNotMatch(styles, /grid-plane--adjacent::before/);
  assert.match(styles, /\[data-space-navigation\] \{ cursor: grab; \}/);
});

test('Library collection filters stay viewport-bounded and scroll their option list', () => {
  const controls = read('./OwnerSystemWorkflowWorkspaceControls.jsx');
  const styles = read('./ownerSystemWorkflow.css');
  assert.match(controls, /closest\('\.system-workflow__workspace-window'\)\?\.getBoundingClientRect\(\)\.top/);
  assert.match(controls, /maxHeight: Math\.max\(36, rect\.top - workspaceTop - 24\)/);
  assert.match(controls, /addEventListener\('resize', locate\)/);
  assert.match(controls, /scrollIntoView\(\{ block: 'nearest' \}\)/);
  assert.match(styles, /\.system-workflow__filter-popover \{[^}]*grid-template-rows: minmax\(0, 1fr\);[^}]*overflow: hidden;/s);
  assert.match(styles, /\.system-workflow__filter-options \{[^}]*min-height: 0;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/s);
});

test('detached and sidecar Metadata share one dossier layout while detached remains viewport-bounded', () => {
  const detachedWindow = read('./OwnerSystemWorkflowDetachedWindow.jsx');
  const source = read('./OwnerSystemWorkflowMetadataModule.jsx');
  const styles = read('./ownerSystemWorkflow.css');
  assert.match(source, /<small>CREATOR<\/small>/);
  assert.doesNotMatch(source, /CREATOR ATTRIBUTION/);
  assert.match(detachedWindow, /data-detached-window data-floating/);
  assert.match(detachedWindow, /system-workflow__detached-window-titlebar/);
  assert.match(detachedWindow, /system-workflow__detached-window-surface/);
  assert.match(detachedWindow, /system-workflow__detached-window-resize/);
  assert.match(styles, /\.system-workflow__detached-window \{[^}]*border-color: rgb\(255 255 255 \/ 20%\);/s);
  assert.match(styles, /\.system-workflow__detached-window-resize \{[^}]*right: 0;[^}]*bottom: 0;[^}]*left: 0;[^}]*height: 9px;[^}]*cursor: ns-resize;[^}]*touch-action: none;/s);
  assert.match(styles, /\.system-workflow__detached-window-surface \{[^}]*width: calc\(100% - \(2 \* var\(--detached-window-gutter\)\)\);[^}]*margin: 0 0 var\(--detached-window-gutter\);[^}]*padding: var\(--detached-window-content-padding\);[^}]*overflow-y: auto;[^}]*border-radius: var\(--detached-window-radius\);[^}]*scrollbar-width: none;/s);
  assert.match(styles, /:is\(\.system-workflow__detached-window-surface, \.system-workflow__metadata-projection \.system-workflow__metadata-module-content\)::before \{[^}]*inset: var\(--detached-window-shadow-inset, 5px\);[^}]*border-radius: var\(--detached-window-radius, 7px\);[^}]*url\("\/assets\/patterns\/detached-window-shadow-dither\.png"\) top center \/ 100% var\(--detached-window-shadow-height, 90px\) no-repeat;[^}]*pointer-events: none;/s);
  assert.match(styles, /opacity: var\(--workflow-window-inner-shadow-opacity, 1\);/);
  assert.match(styles, /:is\(\.system-workflow__detached-window-surface, \.system-workflow__metadata-projection \.system-workflow__metadata-module-content\) \{[^}]*box-shadow: inset 0 0 0 1px rgb\(0 0 0 \/ 8%\);/s);
  assert.match(styles, /\.system-workflow:is\(\[data-menu-surface="ash"\], \[data-menu-surface="mist"\], \[data-menu-surface="paper"\]\)[\s\S]*--detached-window-shadow-height: 45px;[\s\S]*--workflow-window-inner-shadow-opacity: 18%;/);
  assert.match(styles, /\.system-workflow__detached-window-surface \{[^}]*border-color: rgb\(255 255 255 \/ 15%\);/s);
  assert.match(styles, /:is\(\.system-workflow__detached-window, \.system-workflow__metadata-projection\.is-side\) \.system-workflow__metadata-module-traits \{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*gap: 0;/s);
  assert.match(styles, /:is\(\.system-workflow__detached-window, \.system-workflow__metadata-projection\.is-side\) \.system-workflow__metadata-module-traits > li > :is\(small, strong\) \{[^}]*font: 400 11px\/1\.4 "Inscape IBM Plex Sans Condensed", "Arial Narrow", sans-serif;[^}]*letter-spacing: \.065em;/s);
  assert.match(styles, /:is\(\.system-workflow__detached-window, \.system-workflow__metadata-projection\.is-side\) \.system-workflow__metadata-module-description p \{[^}]*font: 400 12px\/1\.55 "Inscape Sora", sans-serif;/s);
  assert.match(styles, /:is\(\.system-workflow__detached-window, \.system-workflow__metadata-projection\.is-side\) \.system-workflow__metadata-module-traits::before \{[^}]*font: 500 13px\/1\.3 "Inscape IBM Plex Sans Condensed", "Arial Narrow", sans-serif;[^}]*letter-spacing: \.09em;[^}]*content: "TRAITS";/s);
  assert.match(styles, /\.system-workflow__detached-window-titlebar \{[^}]*padding-inline: var\(--detached-window-titlebar-padding\);[^}]*border: 0;[^}]*background: transparent;/s);
  assert.match(styles, /\.system-workflow__detached-window-titlebar > strong \{[^}]*translate: 0 1px;/s);
});

test('Layers keeps placement tools with its content and shares window behavior with Metadata', () => {
  const source = read('./OwnerSystemWorkflowSelectionInspector.jsx');
  const instruments = read('./DisplayInstruments.jsx');
  const window = read('./DisplayInstrumentWindow.jsx');
  assert.match(source, /return renderPanel\(<>{toolbar}/);
  assert.doesNotMatch(source, /TOOLBAR_POSITION_KEY|beginToolbarDrag|beginPanelResize/);
  assert.match(instruments, /<DisplayInstrumentWindow/);
  assert.match(window, /<OwnerSystemWorkflowDetachedWindow/);
  assert.match(window, /onPointerCancel: finish/);
});

test('Metadata creator avatars fill their circular frame while the fallback icon retains inset spacing', () => {
  const styles = read('./ownerSystemWorkflow.css');
  assert.match(styles, /metadata-module-content section > :is\(a, div\) \{[^}]*grid-template-columns: 38px minmax\(0, 1fr\) 14px;/s);
  assert.match(styles, /metadata-module-content section > :is\(a, div\) > i \{[^}]*width: 38px;[^}]*height: 38px;[^}]*border-radius: 50%;/s);
  assert.match(styles, /metadata-module-content section > :is\(a, div\) > i img \{[^}]*width: 100%;[^}]*height: 100%;[^}]*display: block;[^}]*object-fit: cover;/s);
  assert.doesNotMatch(styles, /metadata-module-content section > :is\(a, div\) > i img \{[^}]*padding:/s);
  assert.match(styles, /metadata-module-content section > :is\(a, div\) > i svg \{[^}]*padding: 5px;/s);
  assert.match(styles, /:is\(\.system-workflow__detached-window, \.system-workflow__metadata-projection\.is-side\) \.system-workflow__metadata-module-content section > :is\(a, div\) > i \{[^}]*width: 42px;[^}]*height: 42px;/s);
});

test('Publish exposes one dock-attached control while preserving every canonical gate', () => {
  const source = read('./OwnerSystemWorkflowPublicationRack.jsx');
  const styles = read('../ownerLatticePublicationRack.css');
  assert.match(source, /PREPARE PUBLICATION/);
  assert.match(source, /MAKE PRESENTATION PUBLIC/);
  assert.match(source, /PUBLISH TO PROFILE/);
  assert.match(source, /uploadProfileDocument\(snapshot\)/);
  assert.match(source, /publication\.verifyCid\(snapshot, uploaded\.cid/);
  assert.match(source, /publication\.publish\(\)/);
  assert.match(source, /Only your <strong>Public Grids<\/strong>/);
  assert.doesNotMatch(source, /CID \/ MANUAL FALLBACK|PUBLISH VERSION 9/);
  assert.match(styles, /bottom: calc\(var\(--workflow-dock-height/);
  assert.match(styles, /left: var\(--workflow-window-inset/);
  assert.match(styles, /__rail \{[^}]*grid-template-columns: minmax\(0, 1fr\) 42px/s);
  assert.match(source, /<footer className="owner-lattice-publication-rack__rail">/);
  assert.match(source, /owner-lattice-publication-rack system-workflow__motion-panel system-workflow__token-scope/);
  assert.match(source, /data-panel-phase=\{phase\}/);
  assert.match(source, /event\.propertyName === 'opacity'\) onMotionComplete\?\.\(\)/);
  assert.doesNotMatch(source, /<header><div><span>PROFILE<\/span><strong>PUBLISH<\/strong>/);
  assert.match(styles, /font: var\(--workflow-type-panel-heading\)/);
  assert.match(styles, /font: var\(--workflow-type-panel-body\)/);
  assert.doesNotMatch(styles, /button \+ button \{[^}]*border-left/s);
  assert.match(styles, /__publish:not\(:disabled\):is\(:hover, :focus-visible\)/);
  assert.match(source, /<details><summary>HELP WITH THIS ERROR<\/summary>/);
});

test('Owner and Visitor inspection never carry the workspace Grid', () => {
  const runtime = read('./OwnerSystemWorkflowRuntime.jsx');
  const visitor = read('../../profileDocument/components/ProfileDocumentV9Visitor.jsx');
  const profile = read('./OwnerSystemWorkflowProfile.jsx');
  assert.match(runtime, /<DisplayModule/);
  assert.match(read('./DisplayModule.jsx'), /useOwnerSystemWorkflowFocusViewer/);
  assert.equal((visitor.match(/gridVisible=\{false\}/g) || []).length, 1);
  assert.doesNotMatch(visitor, /gridVisible=\{document\.appearance\.guideMode !== 'NONE'\}/);
  assert.match(profile, /onOpenIdentity/);
});

test('dock panels dismiss before canvas handlers and Publish remains a non-modal dock surface', () => {
  const runtime = read('./OwnerSystemWorkflowRuntime.jsx');
  const panelLayer = read('./OwnerSystemWorkflowPanelLayer.jsx');
  const panels = read('./useOwnerSystemWorkflowPanels.js');
  assert.match(panels, /addEventListener\?\.\('pointerdown', onPointerDown, true\)/);
  assert.match(runtime, /blocked: Boolean\(preview\)/);
  assert.match(runtime, /closest\?\.\('\[data-system-workflow-artboard\]'\)/);
  assert.doesNotMatch(runtime, /inert=\{preview \|\| publicationOpen/);
  assert.match(runtime, /onOpen=\{openDockPanel\}/);
  assert.match(panelLayer, /system-workflow__profile-layer[\s\S]*event\.target === event\.currentTarget\) onClose\(\)/);
});

test('Discover explains the real publication boundary instead of presenting an empty directory as a failed search', () => {
  const source = read('./OwnerSystemWorkflowDiscoverWorkspace.jsx');
  assert.match(source, /No published Inscape profiles yet\./);
  assert.match(source, /after they publish an Inscape presentation/);
});
