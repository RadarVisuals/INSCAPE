import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('owner shell system prototype has an isolated standalone entry using the real Library presentation', async () => {
  const [activityDrawer, activityHistory, artworkViewer, canvas, controls, discoverWorkspace, entry, focusArtwork, globalBar, html, libraryWorkspace, profilePanel, settingsPanel, source, tableSwitcher] = await Promise.all([
    read('./OwnerShellSystemActivityDrawer.jsx'),
    read('./OwnerShellSystemActivityHistory.jsx'),
    read('./OwnerShellSystemArtworkViewer.jsx'),
    read('./OwnerShellSystemCanvas.jsx'),
    read('./OwnerShellSystemControls.jsx'),
    read('./OwnerShellSystemDiscoverWorkspace.jsx'),
    read('./main.jsx'),
    read('./OwnerShellSystemFocusArtwork.jsx'),
    read('./OwnerShellSystemGlobalBar.jsx'),
    read('../../../owner-shell-system-prototype.html'),
    read('./OwnerShellSystemLibraryWorkspace.jsx'),
    read('./OwnerShellSystemProfilePanel.jsx'),
    read('./OwnerShellSystemSettingsPanel.jsx'),
    read('./OwnerShellSystemPrototype.jsx'),
    read('./OwnerShellSystemTableSwitcher.jsx'),
  ]);
  assert.match(html, /\/src\/prototypes\/owner-shell-system\/main\.jsx/);
  assert.match(entry, /OwnerShellSystemPrototype/);
  assert.match(source, /OwnerShellSystemLibraryWorkspace/);
  assert.match(libraryWorkspace, /Modul8rLibraryAdapter/);
  assert.match(source, /OwnerShellSystemArtworkViewer/);
  assert.match(artworkViewer, /LatticeFocusViewer/);
  assert.match(artworkViewer, /OwnerShellSystemFocusArtwork/);
  assert.match(artworkViewer, /gridVisible=\{false\}/);
  assert.match(source, /OwnerShellSystemCanvas/);
  assert.match(source, /OwnerShellSystemGlobalBar/);
  assert.match(source, /OwnerShellSystemProfilePanel/);
  assert.match(source, /OwnerShellSystemActivityDrawer/);
  assert.match(source, /OwnerShellSystemActivityHistory/);
  assert.match(source, /OwnerShellSystemDiscoverWorkspace/);
  assert.match(source, /OwnerShellSystemSettingsPanel/);
  assert.match(source, /OwnerShellSystemTableSwitcher/);
  assert.match(activityDrawer, /aria-label="Activity notifications"/);
  assert.match(activityHistory, /aria-label="Full activity history"/);
  assert.match(canvas, /aria-label="Central lattice"/);
  assert.match(canvas, /fitNativeMediaRectangle/);
  assert.match(canvas, /projectCroppedMediaRectangle/);
  assert.match(canvas, /data-cropping=\{cropPlacementId === renderedSelection\.placement\.id/);
  assert.match(discoverWorkspace, /aria-label="Discover directory"/);
  assert.match(globalBar, /aria-label="Owner workspace"/);
  assert.match(profilePanel, /data-identity-dossier-source="true"/);
  assert.match(settingsPanel, /aria-label="Settings"/);
  assert.match(tableSwitcher, /aria-label="Tables"/);
  assert.match(settingsPanel, /GRID DISPLAY/);
  assert.match(settingsPanel, /aria-label="Dot size"/);
  assert.match(settingsPanel, /DOT COLOR \/ MATCHES GRID LINES/);
  assert.match(canvas, /data-grid-display=\{gridDisplay\}/);
  assert.match(canvas, /--prototype-grid-dot-size/);
  assert.match(focusArtwork, /owner-shell-system__focus-artwork/);
  assert.match(artworkViewer, /getReturnRectangle=\{getReturnRectangle\}/);
  assert.match(artworkViewer, /returnFocus=\{returnFocus\}/);
  assert.match(source, /OwnerShellSystemIdentityDossier/);
  assert.match(source, /useBrowserWorkspace/);
  assert.doesNotMatch(source, /SEARCH · ORGANIZE · DRAG TO GRID/);
  assert.doesNotMatch(source, /<strong>LIBRARY<\/strong>|Close Library/);
  assert.match(libraryWorkspace, /<footer className="owner-shell-system__local-rail">/);
  assert.doesNotMatch(source, /faceplateTargetRef/);
  assert.match(libraryWorkspace, /OwnerShellSystemWorkspaceRail/);
  assert.match(controls, /export function OwnerShellSystemSelectMenu/);
  assert.match(controls, /export function OwnerShellSystemFilterMenu/);
  assert.match(controls, /export function OwnerShellSystemWorkspaceRail/);
  assert.match(controls, /aria-haspopup="listbox"/);
  assert.match(controls, /role="listbox"/);
  assert.match(controls, /role="option"/);
  assert.match(controls, /triggerLabel \|\| \(triggerPrefix/);
  assert.match(controls, /aria-label=\{`\$\{label\}: \$\{selectedLabel\}`\}/);
  assert.match(source, /title: 'Mountain Signal II'[^\n]+width: 2000, height: 2000/);
  assert.match(source, /title: 'Moon Purple'[^\n]+width: 4636, height: 2000/);
  assert.match(source, /id: 'placement-2'[^\n]+crop: \{ x: 0\.5, y: 0\.5, zoom: 1 \}/);
});

test('owner shell study remains session-only and excludes production authority and publication dependencies', async () => {
  const [prototypeSource, settingsPanel] = await Promise.all([
    read('./OwnerShellSystemPrototype.jsx'),
    read('./OwnerShellSystemSettingsPanel.jsx'),
  ]);
  const source = `${prototypeSource}\n${settingsPanel}`;
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
  assert.match(source, /\{ label: 'LINES', value: 'lines' \}/);
  assert.match(source, /\{ label: 'DOTS', value: 'dots' \}/);
  assert.match(source, /\{ label: 'NONE', value: 'none' \}/);
  assert.match(source, /gridDisplay=\{gridDisplay\}/);
  assert.match(source, /const \[gridDotSize, setGridDotSize\] = useState\(1\.5\)/);
});

test('remaining features have deliberate shell destinations instead of becoming master-rack modules', async () => {
  const [activityDrawer, activityHistory, artworkViewer, artworkViewerController, canvas, commands, controls, discoverWorkspace, focusArtwork, geometry, globalBar, inspector, interaction, libraryWorkspace, panelController, presentation, presentationController, profilePanel, prototypeSource, selectionCommands, settingsPanel, style, tableCommands, tableController, tableSwitcher] = await Promise.all([
    read('./OwnerShellSystemActivityDrawer.jsx'),
    read('./OwnerShellSystemActivityHistory.jsx'),
    read('./OwnerShellSystemArtworkViewer.jsx'),
    read('./useOwnerShellSystemArtworkViewer.js'),
    read('./OwnerShellSystemCanvas.jsx'),
    read('./ownerShellSystemSelectionCommands.js'),
    read('./OwnerShellSystemControls.jsx'),
    read('./OwnerShellSystemDiscoverWorkspace.jsx'),
    read('./OwnerShellSystemFocusArtwork.jsx'),
    read('./ownerShellSystemPlacementGeometry.js'),
    read('./OwnerShellSystemGlobalBar.jsx'),
    read('./OwnerShellSystemSelectionInspector.jsx'),
    read('./useOwnerShellSystemPlacementInteraction.js'),
    read('./OwnerShellSystemLibraryWorkspace.jsx'),
    read('./useOwnerShellSystemPanels.js'),
    read('./ownerShellSystemPresentation.js'),
    read('./useOwnerShellSystemPresentation.js'),
    read('./OwnerShellSystemProfilePanel.jsx'),
    read('./OwnerShellSystemPrototype.jsx'),
    read('./useOwnerShellSystemSelectionCommands.js'),
    read('./OwnerShellSystemSettingsPanel.jsx'),
    read('./ownerShellSystemPrototype.css'),
    read('./ownerShellSystemTables.js'),
    read('./useOwnerShellSystemTables.js'),
    read('./OwnerShellSystemTableSwitcher.jsx'),
  ]);
  const source = `${prototypeSource}\n${activityDrawer}\n${activityHistory}\n${artworkViewer}\n${artworkViewerController}\n${canvas}\n${commands}\n${controls}\n${discoverWorkspace}\n${focusArtwork}\n${geometry}\n${globalBar}\n${inspector}\n${interaction}\n${libraryWorkspace}\n${panelController}\n${presentation}\n${presentationController}\n${profilePanel}\n${selectionCommands}\n${settingsPanel}\n${tableCommands}\n${tableController}\n${tableSwitcher}`;
  assert.doesNotMatch(source, /IDENTITY ONLY \/ PROFILE ACTIONS CAN FOLLOW HERE/);
  assert.match(source, /data-identity-dossier-source="true"/);
  assert.match(source, /togglePlacementLock/);
  assert.match(source, /onToggleLock=\{toggleLock\}/);
  assert.match(source, /data-locked=\{placement\.locked \|\| undefined\}/);
  assert.match(source, /activePlacements\.filter\(\(\{ locked \}\) => !locked\)/);
  assert.match(style, /owner-shell-system:not\(\[data-preview\]\) \.owner-shell-system__placement\[data-locked\] \{ pointer-events: none; \}/);
  assert.match(prototypeSource, /dossierOpen=\{Boolean\(identityDossierSession\)\}/);
  assert.match(profilePanel, /data-viewing=\{dossierOpen \|\| undefined\}/);
  assert.match(style, /owner-shell-system__profile\[data-viewing\] \{ visibility: hidden; \}/);
  assert.match(style, /grid-template-columns: max-content 180px minmax\(410px, 1fr\)/);
  assert.match(style, /@media \(max-width: 1100px\)[^}]+grid-template-columns: max-content 52px minmax\(0, 1fr\)/s);
  assert.match(style, /owner-shell-system__identity > strong \{ display: none; \}/);
  assert.match(style, /owner-shell-system__global \.owner-shell-system__table \{ width: 52px; min-width: 52px;[^}]+display: flex;/);
  assert.match(source, /Grid3X3 className="owner-shell-system__table-icon"/);
  assert.match(style, /owner-shell-system__global button \{ width: 52px; min-width: 52px;[^}]+font-size: 0;/);
  assert.match(panelController, /function usePanelPresence\(open, exitMs = PANEL_EXIT_MS, entranceFrames = 1\)/);
  assert.match(panelController, /usePanelPresence\(isOpen\('discover'\), DISCOVER_EXIT_MS, 2\)/);
  assert.match(source, /libraryPresence\.present/);
  assert.match(prototypeSource, /close: closePanels/);
  assert.match(prototypeSource, /toggleWorkspacePanel\('discover'\)/);
  assert.doesNotMatch(prototypeSource, /setDiscoverOpen|setLibraryOpen|setProfileOpen/);
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
  assert.match(style, /grid-template-columns: minmax\(160px, 1fr\) 186px 104px 118px 82px 32px/);
  assert.match(style, /owner-shell-system__rail-select > span \{[^}]+text-overflow: ellipsis/);
  assert.match(style, /owner-shell-system__library \.lattice-browser-sidebar button \{ min-height: var\(--prototype-sidebar-row-height\); font: var\(--prototype-type-label\); letter-spacing: \.06em; \}/);
  assert.match(controls, /export function OwnerShellSystemWorkspaceRail/);
  assert.match(controls, /aria-label="Close workspace"/);
  assert.match(controls, /<span>FILTERS<\/span>/);
  assert.match(discoverWorkspace, /accessibleLabel: 'Profile filters'/);
  assert.match(libraryWorkspace, /accessibleLabel: 'NFT collection filters'/);
  assert.doesNotMatch(prototypeSource, /DISCOVER_ROLE_OPTIONS|label: 'DISCIPLINE'/);
  assert.match(style, /owner-shell-system__filter-popover/);
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
  assert.match(prototypeSource, /sidebarCollapsed=\{librarySidebar\.collapsed\}/);
  assert.match(libraryWorkspace, /data-sidebar-collapsed=\{sidebarCollapsed/);
  assert.match(prototypeSource, /sidebarCollapsed=\{discoverSidebar\.collapsed\}/);
  assert.match(discoverWorkspace, /data-sidebar-collapsed=\{sidebarCollapsed/);
  assert.match(style, /data-sidebar-collapsed[^}]+width: max-content/s);
  assert.match(discoverWorkspace, /new Set\(people\.map/);
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
  assert.match(prototypeSource, /const unreadActivityCount = ACTIVITY\.filter\(eventIsUnread\)\.length/);
  assert.match(globalBar, /unreadCount > 0/);
  assert.match(globalBar, /aria-label=\{`\$\{unreadCount\} unread`\}/);
  assert.doesNotMatch(globalBar, /aria-label="2 unread"/);
  assert.match(source, /aria-label="Tables"/);
  assert.match(source, /NEW TABLE/);
  assert.match(source, /\{ id: 'home', name: 'HOME', public: true \}/);
  assert.doesNotMatch(source, /Array\.from\(\{ length: 9 \}/);
  assert.match(canvas, /onDoubleClick=.*onPlacementDoubleClick/);
  assert.match(prototypeSource, /const handlePlacementDoubleClick[\s\S]+openPlacementViewer\(placement\.id\)/);
  assert.match(source, /const nativeImage = new Image\(\)/);
  assert.match(source, /await nativeImage\.decode\(\)/);
  assert.match(source, /if \(!source\.isConnected\) return false/);
  assert.match(artworkViewer, /inspectionVariant="rack"/);
  assert.match(artworkViewer, /inspectionFrameGridVisible=\{false\}/);
  assert.match(artworkViewer, /navigationViewportBottom=\{72\}/);
  assert.match(artworkViewer, /recenterArtworkWhenInspectionClosed/);
  assert.match(source, /crop: placement\.crop/);
  assert.match(artworkViewer, /renderArtwork=.*<OwnerShellSystemFocusArtwork/s);
  assert.match(focusArtwork, /parent\.getBoundingClientRect\(\)/);
  assert.match(source, /projectCroppedMediaRectangle/);
  assert.match(focusArtwork, /interpolateOwnerShellSystemFocusCrop\(authoredCrop, nativeCrop, cropProgress\)/);
  assert.match(focusArtwork, /phase === 'opening' \|\| phase === 'closing'/);
  assert.doesNotMatch(focusArtwork, /elapsed - 0\.35|elapsed \/ 0\.45/);
  assert.doesNotMatch(style, /owner-shell-system__focus-artwork img[^}]+drop-shadow/s);
  assert.match(artworkViewer, /dossier=\{entry\.dossier\}/);
  assert.doesNotMatch(source, /owner-shell-system__viewer-rack|owner-shell-system__viewer-modules/);
  assert.match(source, /selectedPlacementIds/);
  assert.match(source, /event\.shiftKey/);
  assert.match(interaction, /preview \|\| cropSession/);
  assert.match(interaction, /kind !== 'resize' \|\| cropSession\.placementId !== placement\.id/);
  assert.match(interaction, /onPlacementGeometryChange/);
  assert.match(source, /owner-shell-system__marquee/);
  assert.doesNotMatch(style, /owner-shell-system__placement\[aria-pressed="true"\][^}]+background/s);
  assert.match(source, /Resize selection from \$\{corner\}/);
  assert.match(canvas, /const renderedSelection = activeSelection \|\| retainedSelectionRef\.current/);
  assert.match(canvas, /aria-hidden=\{Boolean\(viewerPlacementId\) \|\| !activeSelection\}/);
  assert.match(canvas, /disabled=\{Boolean\(viewerPlacementId\) \|\| !activeSelection\}/);
  assert.match(prototypeSource, /selectedCount=\{selectedPlacements\.length\}/);
  assert.match(inspector, /selectedCount !== 1/);
  assert.match(source, /\['nw', 'ne', 'se', 'sw'\]/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /Math\.round\([^\n]+\/ cell\) \* cell/);
  assert.match(source, /crop: cropForPlacementFrame\(placement\.crop, asset, placementWidth, placementHeight\)/);
  assert.match(source, /FRAME & MAT CONTROLS \/ NOT CONNECTED/);
  assert.doesNotMatch(source, /data-frame=/);
  assert.doesNotMatch(style, /owner-shell-system__placement\[data-frame=/);
  assert.match(style, /\.owner-shell-system__placement \{[^}]*border: 0;/s);
  assert.match(style, /owner-shell-system__placement\[data-cropping\][^}]+outline: 1px solid color-mix/s);
  assert.doesNotMatch(style, /owner-shell-system__placement\[data-cropping\][^}]+outline-style: dashed/s);
  assert.doesNotMatch(style, /\.owner-shell-system__placement\[aria-pressed="true"\] \{[^}]*border-color:/s);
});

test('approved Phase 1 corrections share geometry, state, controls and table behavior', async () => {
  const [activityHistory, discoverWorkspace, profilePanel, prototypeSource, settingsPanel, style, tableCommands, tableController, tableSwitcher] = await Promise.all([
    read('./OwnerShellSystemActivityHistory.jsx'),
    read('./OwnerShellSystemDiscoverWorkspace.jsx'),
    read('./OwnerShellSystemProfilePanel.jsx'),
    read('./OwnerShellSystemPrototype.jsx'),
    read('./OwnerShellSystemSettingsPanel.jsx'),
    read('./ownerShellSystemPrototype.css'),
    read('./ownerShellSystemTables.js'),
    read('./useOwnerShellSystemTables.js'),
    read('./OwnerShellSystemTableSwitcher.jsx'),
  ]);
  const source = `${prototypeSource}\n${activityHistory}\n${discoverWorkspace}\n${settingsPanel}\n${tableCommands}\n${tableController}\n${tableSwitcher}`;
  assert.match(style, /owner-shell-system__profile \{ top: auto; right: auto; bottom: calc\(var\(--prototype-dock-height\) \+ var\(--prototype-window-inset\)\); left: var\(--prototype-window-inset\); \}/);
  assert.match(profilePanel, /ref=\{panelRef\}/);
  assert.match(source, /getReturnRectangle=\{\(\) => profilePanelRef\.current\?\.getBoundingClientRect/);
  assert.doesNotMatch(style, /li\[data-unread\]::before|li\[data-unread\] \{ background/);
  assert.match(source, /owner-shell-system__activity-state-indicator/g);
  assert.match(style, /owner-shell-system \[data-unread\] > \.owner-shell-system__activity-state-indicator/);
  assert.doesNotMatch(source, /owner-shell-system__activity-history-title|ACTIVITY RECORD \/ OWNER SESSION FIXTURE/);
  assert.match(source, /owner-shell-system__activity-history-rail owner-shell-system__local-rail/);
  assert.match(activityHistory, /OwnerShellSystemSearch onChange=\{onQueryChange\}/);
  assert.match(prototypeSource, /onQueryChange=\{setActivityHistoryQuery\}/);
  assert.match(style, /@container \(max-width: 112px\)/);
  assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*workspace-search > span \{ display: none; \}/);
  assert.match(style, /lattice-browser-panel \{ grid-template-columns: var\(--prototype-sidebar-width\) 7px minmax\(0, 1fr\) !important/);
  assert.doesNotMatch(source, /viewport\.width <= 760/);
  assert.doesNotMatch(style, /discover-sidebar-resize \{ pointer-events: none/);
  assert.match(source, /owner-shell-system__settings-theme[\s\S]+OwnerShellSystemSelectMenu/);
  assert.doesNotMatch(source, /<select onChange=\{\(event\) => setGridSurface|<select onChange=\{\(event\) => setMenuSurface/);
  assert.match(style, /label:has\(:focus-visible\)/);
  assert.doesNotMatch(style, /workspace-rail-controls > :is\(button, label\):focus-within/);
  assert.match(tableSwitcher, /className="owner-shell-system__table-list"[^>]+role="listbox"/);
  assert.match(source, /beginTableRename|finishTableRename|tableDeleteId/);
  assert.match(source, /tables\.length <= 1/);
  assert.match(source, /const fallback = survivors\[Math\.min\(index, survivors\.length - 1\)\]/);
  assert.match(style, /owner-shell-system__table-list \{ min-height: 54px; max-height:[^}]+overflow-y: auto; overflow-x: hidden; \}/);
  assert.doesNotMatch(style, /table-switcher > nav|overflow-x: auto; scrollbar-width: none/);
});

test('focused Activity spacing and Table correction pass removes layout and interaction artifacts', async () => {
  const [prototypeSource, style, tableController, tableSwitcher] = await Promise.all([
    read('./OwnerShellSystemPrototype.jsx'),
    read('./ownerShellSystemPrototype.css'),
    read('./useOwnerShellSystemTables.js'),
    read('./OwnerShellSystemTableSwitcher.jsx'),
  ]);
  const source = `${prototypeSource}\n${tableController}\n${tableSwitcher}`;
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
  assert.match(tableSwitcher, /onBeginRename\(table, event\.detail === 0\)/);
  assert.match(style, /owner-shell-system__table-delete-confirm \{ z-index: 4; inset: 0;[^}]+background: color-mix\([^}]+box-shadow: inset 3px 0 0 var\(--prototype-emphasis\)/);
  assert.match(tableController, /setActionId\(null\);\s*setDeleteId\(null\);\s*setRename/);
  assert.match(prototypeSource, /onActionIdChange=\{changeTableActionId\}/);
  assert.match(tableSwitcher, /onActionIdChange\(actionsOpen \? null : table\.id\)/);
  assert.match(tableSwitcher, /aria-label=\{`Reorder \$\{table\.name\}`\}/);
  assert.match(tableSwitcher, /event\.dataTransfer\.effectAllowed = 'move'/);
  assert.match(tableSwitcher, /onReorder\(draggedTableId, table\.id, edge\)/);
  assert.match(tableSwitcher, /event\.altKey/);
  assert.match(style, /owner-shell-system__table-row\[data-drop-position="before"\]/);
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
  assert.match(source, /height: Math\.max\(1, viewport\.height - SHELL_DOCK_HEIGHT\)/);
  assert.match(source, /identityDossierViewerLayout\(originRectangle, availableViewport\)/);
  assert.doesNotMatch(source, /SHELL_WINDOW_INSET|height: Math\.max\(280, viewport\.height/);
  assert.match(source, /rackRef\.current\?\.contains\(event\.target\)/);
  assert.match(source, /addEventListener\('pointerdown', handleOutsideInteraction, true\)/);
  assert.match(source, /addEventListener\('click', handleOutsideInteraction, true\)/);
  assert.match(source, /phase !== 'open' && phase !== 'closing'/);
  assert.match(source, /aria-label="Close profile" className="owner-shell-system-identity__close"/);
  assert.doesNotMatch(source, /CLOSE PROFILE|Close Identity Rack/);
  assert.match(style, /owner-shell-system-identity__veil \{[^}]+inset: 0 0 var\(--prototype-dock-height\)/);
  assert.match(style, /owner-shell-system-identity \{[^}]+pointer-events: none/);
  assert.match(style, /owner-shell-system-identity__close \{ position: absolute;[^}]+width: 38px; height: 38px/);
  assert.match(source, /const PROFILE_HEADER_HEIGHT = 92/);
  assert.doesNotMatch(style, /module\.is-profile:not\(\[data-active\]\) \.owner-shell-system-identity__close/);
  assert.doesNotMatch(source, /SYSTEM ROUTES|CANONICAL ROUTE/);
  assert.match(style, /module\.is-profile\[data-active\] \.owner-shell-system-identity__lead \{ background: var\(--prototype-selection\); \}/);
  assert.match(style, /module\.is-profile \.owner-shell-system-identity__lead::before \{[^}]+opacity: 0; transition: opacity 200ms linear/s);
  assert.match(style, /\[data-phase="opening"\].+\[data-phase="open"\].+module\.is-profile\[data-active\].+lead::before \{ opacity: 1; \}/s);
  assert.match(style, /\[data-phase="closing"\].+module\.is-profile.+lead::before \{ opacity: 0; \}/s);
  assert.match(style, /module\[data-active\] \.owner-shell-system-identity__module-header::before/);
  assert.match(style, /module:not\(\[data-active\]\) \{ color: var\(--prototype-muted\); \}/);
  assert.match(style, /module\[data-active\] \.owner-shell-system-identity__module-header strong \{ color: var\(--prototype-emphasis\); font-weight: 700; \}/);
  assert.doesNotMatch(source, /active \? '−' : '\+'|activeModule === 'profile' \? '' : '\+'/);
  assert.doesNotMatch(source, /owner-shell-system-identity__module-header[^\n]+<b/);
  assert.match(style, /owner-shell-system-identity__module-header \{[^}]+grid-template-columns: 8px 1fr;/);
  const prototypeStyle = await read('./ownerShellSystemPrototype.css');
  assert.match(prototypeStyle, /lattice-focus-viewer__rack-module > button \{ grid-template-columns: 8px minmax\(0, 1fr\); \}/);
  assert.match(prototypeStyle, /lattice-focus-viewer__rack-module > button > b \{ display: none; \}/);
  assert.match(prototypeStyle, /owner-shell-system__selection-chrome\[data-viewing\] \{ opacity: 0; pointer-events: none; \}/);
  assert.match(prototypeStyle, /owner-shell-system__selection-chrome\[data-selected\]:not\(\[data-viewing\]\) \{ opacity: 1; \}/);
  assert.match(prototypeStyle, /@starting-style \{ \.owner-shell-system__selection-chrome\[data-selected\]:not\(\[data-viewing\]\) \{ opacity: 0; \} \}/);
  assert.match(prototypeStyle, /owner-shell-system__selection-outline \{[^}]+outline: 1px solid color-mix/s);
  assert.doesNotMatch(prototypeStyle, /placement\[aria-pressed="true"\][^{]+\{[^}]+outline:/s);
  assert.match(style, /width: var\(--owner-shell-system-identity-expanded-width, 100%\)/);
  assert.match(style, /\[data-phase="closing"\] .owner-shell-system-identity__panel \{ opacity: 0; transition-duration: 70ms/);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+background-color: transparent/s);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+display: none/s);
  assert.doesNotMatch(style, /clip-path/);
});
