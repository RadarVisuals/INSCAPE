import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('owner shell system prototype has an isolated standalone entry using the real Library presentation', async () => {
  const [entry, html, source] = await Promise.all([
    read('./main.jsx'),
    read('../../../owner-shell-system-prototype.html'),
    read('./OwnerShellSystemPrototype.jsx'),
  ]);
  assert.match(html, /\/src\/prototypes\/owner-shell-system\/main\.jsx/);
  assert.match(entry, /OwnerShellSystemPrototype/);
  assert.match(source, /Modul8rLibraryAdapter/);
  assert.match(source, /LatticeFocusViewer/);
  assert.match(source, /OwnerShellFocusArtwork/);
  assert.match(source, /OwnerShellSystemIdentityDossier/);
  assert.match(source, /useBrowserWorkspace/);
  assert.doesNotMatch(source, /SEARCH · ORGANIZE · DRAG TO GRID/);
  assert.doesNotMatch(source, /<strong>LIBRARY<\/strong>|Close Library/);
  assert.match(source, /<footer className="owner-shell-system__local-rail"><OwnerShellLibraryRail/);
  assert.doesNotMatch(source, /faceplateTargetRef/);
  assert.match(source, /function PrototypeSelectMenu/);
  assert.match(source, /aria-haspopup="listbox"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /title: 'Mountain Signal II'[^\n]+width: 2000, height: 2000/);
  assert.match(source, /title: 'Moon Purple'[^\n]+width: 4636, height: 2000/);
  assert.match(source, /id: 'placement-2'[^\n]+crop: \{ x: 0\.5, y: 0\.5, zoom: 1 \}/);
});

test('owner shell study remains session-only and excludes production authority and publication dependencies', async () => {
  const source = await read('./OwnerShellSystemPrototype.jsx');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|fetch\s*\(|useWalletStore|useLibraryStore|profileDocument|publicationClient|setData/iu);
  assert.doesNotMatch(source, /ARRANGE/);
  assert.match(source, /PUBLICATION IS NOT CONNECTED IN THIS STUDY/);
  assert.match(source, /THEME EXISTS HERE ONCE/);
  assert.match(source, /WORKSPACE \/ GRID/);
  assert.match(source, /WINDOWS \/ INTERFACE/);
  assert.match(source, /LATTICE_PRODUCTION_SURFACE_IDS/);
  assert.match(source, /KEEPER NOTIFICATIONS/);
  assert.match(source, /VISITOR PRESENTATION/);
  assert.match(source, /data-menu-surface=\{menuSurface\}/);
  assert.match(source, /data-surface=\{gridSurface\}/);
});

test('remaining features have deliberate shell destinations instead of becoming master-rack modules', async () => {
  const [source, style] = await Promise.all([
    read('./OwnerShellSystemPrototype.jsx'),
    read('./ownerShellSystemPrototype.css'),
  ]);
  assert.doesNotMatch(source, /IDENTITY ONLY \/ PROFILE ACTIONS CAN FOLLOW HERE/);
  assert.match(source, /data-identity-dossier-source="true"/);
  assert.match(source, /data-viewing=\{Boolean\(identityDossierSession\)/);
  assert.match(style, /owner-shell-system__profile\[data-viewing\] \{ visibility: hidden; \}/);
  assert.match(style, /grid-template-columns: max-content 180px minmax\(410px, 1fr\)/);
  assert.match(style, /@media \(max-width: 1100px\)[^}]+grid-template-columns: max-content 52px minmax\(0, 1fr\)/s);
  assert.match(style, /owner-shell-system__identity > strong \{ display: none; \}/);
  assert.match(style, /owner-shell-system__global \.owner-shell-system__table \{ width: 52px; min-width: 52px;[^}]+display: flex;/);
  assert.match(source, /Grid3X3 className="owner-shell-system__table-icon"/);
  assert.match(style, /owner-shell-system__global button \{ width: 52px; min-width: 52px;[^}]+font-size: 0;/);
  assert.match(source, /function usePrototypePresence\(open, exitMs = PANEL_EXIT_MS, entranceFrames = 1\)/);
  assert.match(source, /discoverPresence = usePrototypePresence\(discoverOpen, DISCOVER_EXIT_MS, 2\)/);
  assert.match(source, /libraryPresence\.present/);
  assert.match(source, /discoverPresence\.present/);
  assert.match(source, /profilePresence\.present/);
  assert.match(style, /--prototype-motion-out: 140ms/);
  assert.match(style, /owner-shell-system__motion-panel\[data-panel-phase="closing"\] \{ transition-duration: var\(--prototype-motion-out\); \}/);
  assert.match(source, /owner-shell-system__discover owner-shell-system__motion-panel/);
  assert.match(source, /Identity RÄCK workflow fixture/);
  assert.match(source, /\['ALL', 'ASSETS', 'LYX', 'SOCIAL'\]/);
  assert.match(source, /aria-label="Full activity history"/);
  assert.match(source, /\['ALL', 'UNREAD', 'ASSETS', 'LYX', 'SOCIAL'\]/);
  assert.match(source, /EVENT, ASSET OR PROFILE/);
  assert.match(source, /data-canvas-context=\{canvasContext\}/);
  assert.match(source, /placementRectangleFromPointer/);
  assert.match(source, /owner-shell-system__placement-preview/);
  assert.match(style, /owner-shell-system\[data-canvas-context="workspace"\] \.owner-shell-system__canvas/);
  assert.match(style, /owner-shell-system__library\[data-placing\]/);
  assert.match(style, /owner-shell-system__workspace-rail-controls \{ height: var\(--prototype-rail-height\);[^}]+grid-template-columns:/);
  assert.match(style, /owner-shell-system__library \.lattice-browser-sidebar button \{ min-height: var\(--prototype-sidebar-row-height\); font: var\(--prototype-type-label\); letter-spacing: \.06em; \}/);
  assert.match(source, /function OwnerShellWorkspaceRail/);
  assert.match(style, /owner-shell-system__select-popover/);
  assert.match(style, /owner-shell-system__local-rail/);
  assert.match(style, /--prototype-type-control/);
  assert.match(style, /--prototype-selection/);
  assert.doesNotMatch(source, /KEEPER SIGNALS \/ COMPLETE RECORD/);
  assert.doesNotMatch(source, /owner-shell-system__activity-history-summary/);
  assert.doesNotMatch(source, /FULL HISTORY IS NOT CONNECTED IN THIS STUDY/);
  assert.match(style, /owner-shell-system__activity-history \{/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.doesNotMatch(source, /Close Activity|Close Profile|Close Settings|PanelHeading/);
  assert.doesNotMatch(source, /UNIVERSAL PROFILE DIRECTORY|DISCOVER PEOPLE|Discover filters/);
  assert.match(source, /aria-label="Discover sections"/);
  assert.match(source, /ALL PEOPLE/);
  assert.match(source, /FOLLOWING/);
  assert.match(source, /FOLLOWERS/);
  assert.match(source, /CREATE GROUP/);
  assert.match(source, /aria-label="Resize Discover sidebar"/);
  assert.doesNotMatch(source, /Collapse Discover sidebar|Expand Discover sidebar|PanelLeftClose|PanelLeftOpen/);
  assert.match(source, /function usePrototypeSidebarGeometry/);
  assert.match(source, /data-sidebar-collapsed=\{librarySidebar\.collapsed/);
  assert.match(source, /data-sidebar-collapsed=\{discoverSidebar\.collapsed/);
  assert.match(style, /data-sidebar-collapsed[^}]+width: max-content/s);
  assert.match(source, /DISCOVER_ROLE_OPTIONS/);
  assert.match(source, /DISCOVER_SORT_OPTIONS/);
  assert.match(source, /libraryPresence\.present \|\| activityHistoryPresence\.present \|\| discoverPresence\.present/);
  assert.doesNotMatch(source, /aria-hidden=\{discoverPresence\.present \|\| undefined\} aria-label="Central lattice"/);
  assert.doesNotMatch(source, /Close Directory/);
  assert.match(source, /LAYERS \/ THIS TABLE/);
  assert.doesNotMatch(source, /owner-shell-system__inspector-art|<small>ARTWORK<\/small>/);
  assert.doesNotMatch(source, /<strong>SELECTION<\/strong>|<small>TRANSFORM<\/small>|Close selection/);
  for (const label of ['Rotate', 'Mirror horizontal', 'Mirror vertical', 'Duplicate', 'Send to back', 'Move backward', 'Move forward', 'Bring to front']) {
    assert.match(source, new RegExp(`aria-label="${label}"`));
  }
  assert.match(source, /aria-label="Crop"/);
  assert.match(source, /CROP \/ DRAG IMAGE/);
  assert.match(source, /NATIVE FIT/);
  assert.match(source, /aria-label="Frame and mat"/);
  assert.match(source, /REMOVE FROM TABLE\?/);
  assert.match(source, /PLACEMENT REMOVED FROM THIS TABLE \/ ASSET RETAINED/);
  assert.match(source, /aria-label="Tables"/);
  assert.match(source, /NEW TABLE/);
  assert.match(source, /\{ id: 'home', name: 'HOME', public: true \}/);
  assert.doesNotMatch(source, /Array\.from\(\{ length: 9 \}/);
  assert.match(source, /onDoubleClick=.*openPlacementViewer/);
  assert.match(source, /const nativeImage = new Image\(\)/);
  assert.match(source, /await nativeImage\.decode\(\)/);
  assert.match(source, /if \(!source\.isConnected\) return/);
  assert.match(source, /inspectionVariant="rack"/);
  assert.match(source, /crop: viewerPlacement\.crop/);
  assert.match(source, /renderArtwork=.*<OwnerShellFocusArtwork/s);
  assert.match(source, /parent\.getBoundingClientRect\(\)/);
  assert.match(source, /projectCroppedMediaRectangle/);
  assert.match(source, /interpolateCrop\(authoredCrop, nativeCrop, cropProgress\)/);
  assert.match(source, /dossier=\{viewerEntry\.dossier\}/);
  assert.doesNotMatch(source, /owner-shell-system__viewer-rack|owner-shell-system__viewer-modules/);
  assert.match(source, /selectedPlacementIds/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /owner-shell-system__marquee/);
  assert.match(source, /Resize selection from \$\{corner\}/);
  assert.match(source, /selectedPlacements\.length !== 1/);
  assert.match(source, /\['nw', 'ne', 'se', 'sw'\]/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /Math\.round\([^\n]+\/ cell\) \* cell/);
  assert.match(source, /crop: cropForPlacementFrame\(start\.crop, asset, width, height\)/);
  assert.match(style, /\.owner-shell-system__placement \{[^}]*border: 0;/s);
  assert.doesNotMatch(style, /\.owner-shell-system__placement\[aria-pressed="true"\] \{[^}]*border-color:/s);
});

test('approved Phase 1 corrections share geometry, state, controls and table behavior', async () => {
  const [source, style] = await Promise.all([
    read('./OwnerShellSystemPrototype.jsx'),
    read('./ownerShellSystemPrototype.css'),
  ]);
  assert.match(style, /owner-shell-system__profile \{ top: auto; right: auto; bottom: calc\(var\(--prototype-dock-height\) \+ var\(--prototype-window-inset\)\); left: var\(--prototype-window-inset\); \}/);
  assert.match(source, /ref=\{profilePanelRef\}/);
  assert.match(source, /getReturnRectangle=\{\(\) => profilePanelRef\.current\?\.getBoundingClientRect/);
  assert.doesNotMatch(style, /li\[data-unread\]::before|li\[data-unread\] \{ background/);
  assert.match(source, /owner-shell-system__activity-state-indicator/g);
  assert.match(style, /owner-shell-system \[data-unread\] > \.owner-shell-system__activity-state-indicator/);
  assert.doesNotMatch(source, /owner-shell-system__activity-history-title|ACTIVITY RECORD \/ OWNER SESSION FIXTURE/);
  assert.match(source, /owner-shell-system__activity-history-rail owner-shell-system__local-rail/);
  assert.match(source, /PrototypeSearch onChange=\{setActivityHistoryQuery\}/);
  assert.match(style, /@container \(max-width: 112px\)/);
  assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*workspace-search > span \{ display: none; \}/);
  assert.match(style, /lattice-browser-panel \{ grid-template-columns: var\(--prototype-sidebar-width\) 7px minmax\(0, 1fr\) !important/);
  assert.doesNotMatch(source, /viewport\.width <= 760/);
  assert.doesNotMatch(style, /discover-sidebar-resize \{ pointer-events: none/);
  assert.match(source, /owner-shell-system__settings-theme[\s\S]+PrototypeSelectMenu/);
  assert.doesNotMatch(source, /<select onChange=\{\(event\) => setGridSurface|<select onChange=\{\(event\) => setMenuSurface/);
  assert.match(style, /label:has\(:focus-visible\)/);
  assert.doesNotMatch(style, /workspace-rail-controls > :is\(button, label\):focus-within/);
  assert.match(source, /className="owner-shell-system__table-list" role="listbox"/);
  assert.match(source, /beginTableRename|finishTableRename|tableDeleteId/);
  assert.match(source, /tables\.length <= 1/);
  assert.match(source, /const fallback = survivors\[Math\.min\(index, survivors\.length - 1\)\]/);
  assert.match(style, /owner-shell-system__table-list \{ min-height: 54px; max-height:[^}]+overflow-y: auto; overflow-x: hidden; \}/);
  assert.doesNotMatch(style, /table-switcher > nav|overflow-x: auto; scrollbar-width: none/);
});

test('focused Activity spacing and Table correction pass removes layout and interaction artifacts', async () => {
  const [source, style] = await Promise.all([
    read('./OwnerShellSystemPrototype.jsx'),
    read('./ownerShellSystemPrototype.css'),
  ]);
  assert.match(style, /owner-shell-system__activity-drawer \{[^}]+bottom: calc\(var\(--prototype-dock-height\) \+ var\(--prototype-window-inset\)\)/);
  assert.match(style, /grid-template-rows: minmax\(54px, max-content\) var\(--prototype-rail-height\)/);
  assert.match(style, /owner-shell-system__table-row:last-of-type \{ border-bottom: 0; \}/);
  assert.match(source, /className="owner-shell-system__table-new"[^>]+><Plus size=\{13\} \/><span>NEW TABLE<\/span>/);
  assert.match(style, /owner-shell-system__table-switcher > footer > button \{[^}]+justify-content: flex-start; gap: var\(--prototype-gap-small\)/);
  assert.doesNotMatch(style, /owner-shell-system__table-switcher > footer > button span \{ font-size: 0; \}/);
  assert.match(style, /@container table-panel \(max-width: 330px\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => tableRowRefs\.current\.get\(activeTableId\)\?\.scrollIntoView\(\{ block: 'nearest' \}\)\)/);
  assert.match(source, /\[activeTableId, tableMapOpen, tables\.length\]/);
  assert.doesNotMatch(source, /owner-shell-system__table-label|activeTableIndex/);
  assert.doesNotMatch(style, /owner-shell-system__table-label/);
  assert.match(source, /className="owner-shell-system__table-rename"/);
  assert.match(style, /owner-shell-system__table-rename input \{[^}]+outline: 0;[^}]+font: var\(--prototype-type-label\)/);
  assert.match(style, /owner-shell-system__table-rename\[data-keyboard-focus\] input:focus-visible \{ outline: var\(--prototype-focus-ring\)/);
  assert.match(source, /beginTableRename\(table, event\.detail === 0\)/);
  assert.match(style, /owner-shell-system__table-delete-confirm \{ z-index: 4; inset: 0;[^}]+background: color-mix\([^}]+box-shadow: inset 3px 0 0 var\(--prototype-emphasis\)/);
  assert.match(source, /setTableActionId\(null\);\s*setTableDeleteId\(null\);\s*setTableRename/);
  assert.match(source, /setTableDeleteId\(null\); setTableActionId\(actionsOpen \? null : table\.id\)/);
});

test('system prototype defines the shared semantic geometry and visual tokens locally', async () => {
  const style = await read('./ownerShellSystemPrototype.css');
  for (const token of [
    '--prototype-window-inset', '--prototype-dock-height', '--prototype-dock-to-panel-clearance',
    '--prototype-rail-height', '--prototype-sidebar-row-height', '--prototype-control-height',
    '--prototype-panel-padding', '--prototype-content-padding', '--prototype-gap-small',
    '--prototype-gap-medium', '--prototype-border', '--prototype-border-strong', '--prototype-muted',
    '--prototype-emphasis', '--prototype-recessed', '--prototype-focus-ring', '--prototype-selection', '--prototype-hover',
    '--prototype-shadow-compact', '--prototype-shadow-workspace', '--prototype-motion-in',
    '--prototype-motion-out', '--prototype-ease',
  ]) assert.match(style, new RegExp(token));
  for (const token of style.match(/--prototype-[a-z0-9-]+(?=:)/gu) || []) {
    assert.ok((style.match(new RegExp(token, 'gu')) || []).length > 1, `${token} must be consumed`);
  }
  assert.match(style, /bottom: calc\(var\(--prototype-dock-height\) \+ var\(--prototype-window-inset\)\)/);
  assert.match(style, /@media \(max-width: 760px\)[\s\S]+owner-shell-system__workspace-size \{ padding-inline: 5px; grid-template-columns: auto minmax\(38px, 1fr\) 3ch; gap: 4px; \}/);
});

test('profile identity uses one prototype-local expanding card with complete collapsed borders', async () => {
  const [source, style] = await Promise.all([
    read('./OwnerShellSystemIdentityDossier.jsx'),
    read('./ownerShellSystemIdentityDossier.css'),
  ]);
  assert.match(source, /className="owner-shell-system-identity__lead"/);
  assert.match(source, /data-lattice-menu-surface/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{\s*settleFrameRef\.current = requestAnimationFrame/s);
  assert.doesNotMatch(source, /source-summary|clone/iu);
  assert.match(source, /active \? expandedHeight : MODULE_COLLAPSED_HEIGHTS\[id\]/);
  assert.match(style, /border: 1px solid var\(--prototype-border-strong\)/);
  assert.match(style, /lead code[^}]+font: var\(--prototype-type-micro\)/);
  assert.match(style, /transition: background-color 120ms linear/);
  assert.match(style, /owner-shell-system-identity__rack \{[^}]+box-shadow: var\(--prototype-shadow-workspace\)/s);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+owner-shell-system-identity__rack \{ box-shadow: var\(--prototype-shadow-compact\)/s);
  assert.match(style, /border-color: var\(--prototype-border-strong\); box-shadow: none/);
  assert.match(source, /--owner-shell-system-identity-expanded-width/);
  assert.match(source, /className="owner-shell-system-identity__rack-viewport"/);
  assert.match(style, /owner-shell-system-identity__rack-viewport \{[^}]+inset: 0 0 var\(--prototype-dock-height\); overflow: hidden/s);
  assert.match(source, /SHELL_DOCK_HEIGHT = 52/);
  assert.match(source, /SHELL_WINDOW_INSET = 18/);
  assert.match(source, /height: Math\.max\(280, viewport\.height - SHELL_DOCK_HEIGHT - \(SHELL_WINDOW_INSET \* 2\)\)/);
  assert.match(source, /top: SHELL_WINDOW_INSET/);
  assert.match(source, /aria-label="Close profile" className="owner-shell-system-identity__close"/);
  assert.doesNotMatch(source, /CLOSE PROFILE|Close Identity Rack/);
  assert.match(style, /owner-shell-system-identity__veil \{[^}]+inset: 0 0 var\(--prototype-dock-height\)/);
  assert.match(style, /owner-shell-system-identity \{[^}]+pointer-events: none/);
  assert.match(style, /owner-shell-system-identity__close \{ position: absolute;[^}]+width: 38px; height: 38px/);
  assert.match(source, /const PROFILE_HEADER_HEIGHT = 92/);
  assert.doesNotMatch(style, /module\.is-profile:not\(\[data-active\]\) \.owner-shell-system-identity__close/);
  assert.doesNotMatch(source, /SYSTEM ROUTES|CANONICAL ROUTE/);
  assert.match(style, /module\.is-profile\[data-active\] \.owner-shell-system-identity__lead \{ background: var\(--prototype-selection\); \}/);
  assert.match(style, /module\[data-active\] \.owner-shell-system-identity__module-header::before/);
  assert.doesNotMatch(source, /active \? '−' : '\+'|activeModule === 'profile' \? '' : '\+'/);
  assert.doesNotMatch(source, /owner-shell-system-identity__module-header[^\n]+<b/);
  assert.match(style, /owner-shell-system-identity__module-header \{[^}]+grid-template-columns: 8px 1fr;/);
  const prototypeStyle = await read('./ownerShellSystemPrototype.css');
  assert.match(prototypeStyle, /lattice-focus-viewer__rack-module > button \{ grid-template-columns: 8px minmax\(0, 1fr\); \}/);
  assert.match(prototypeStyle, /lattice-focus-viewer__rack-module > button > b \{ display: none; \}/);
  assert.match(style, /width: var\(--owner-shell-system-identity-expanded-width, 100%\)/);
  assert.match(style, /\[data-phase="closing"\] .owner-shell-system-identity__panel \{ opacity: 0; transition-duration: 70ms/);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+background-color: transparent/s);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+display: none/s);
  assert.doesNotMatch(style, /clip-path/);
});
