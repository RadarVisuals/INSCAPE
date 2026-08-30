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
  assert.match(interaction, /navigationOnly && Math\.abs\(deltaX\)/);
  assert.doesNotMatch(interaction, /!event\.shiftKey && Math\.abs\(deltaX\)/);
  assert.equal((canvas.match(/<LatticePixelGrid/g) || []).length, 2);
  assert.match(canvas, /grid-plane--current[\s\S]*<LatticePixelGrid/);
  assert.match(canvas, /grid-plane--adjacent[\s\S]*<GridSwipePreview/);
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

test('undocked Metadata stays within half the viewport and scrolls its content', () => {
  const styles = read('./ownerSystemWorkflow.css');
  assert.match(styles, /\.system-workflow__metadata-module\[data-floating\] \{[^}]*max-height: 50dvh;[^}]*grid-template-rows: 32px minmax\(0, 1fr\);/s);
  assert.match(styles, /\.system-workflow__metadata-module\[data-floating\] > \.system-workflow__metadata-module-content \{[^}]*min-height: 0;[^}]*grid-auto-rows: max-content;[^}]*align-content: start;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;[^}]*scrollbar-width: none;/s);
  assert.match(styles, /\.system-workflow__metadata-module\[data-floating\] > \.system-workflow__metadata-module-content::\-webkit-scrollbar \{[^}]*display: none;/s);
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
  assert.match(runtime, /OwnerSystemWorkflowFocusViewer|useOwnerSystemWorkflowFocusViewer/);
  assert.match(profile, /gridVisible=\{false\}/);
  assert.equal((visitor.match(/gridVisible=\{false\}/g) || []).length, 2);
  assert.doesNotMatch(visitor, /gridVisible=\{document\.appearance\.guideMode !== 'NONE'\}/);
  assert.match(visitor, /dismissOnBackdrop/);
  assert.match(visitor, /onDismiss=\{closeProfile\}/);
  assert.match(visitor, /originRectangle=\{identitySession\.originRectangle\} inlineCloseControl persistent/);
  assert.match(profile, /const dismissDossier = \(\) => \{[\s\S]*setSession\(null\)/);
  assert.match(profile, /onDismiss=\{dismissDossier\}/);
  assert.match(profile, /dismissOnBackdrop/);
});

test('dock panels dismiss before canvas handlers and Publish remains a non-modal dock surface', () => {
  const runtime = read('./OwnerSystemWorkflowRuntime.jsx');
  const panelLayer = read('./OwnerSystemWorkflowPanelLayer.jsx');
  const panels = read('./useOwnerSystemWorkflowPanels.js');
  assert.match(panels, /addEventListener\?\.\('pointerdown', onPointerDown, true\)/);
  assert.match(runtime, /blocked: Boolean\(preview \|\| dossierOpen\)/);
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
