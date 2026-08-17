import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('owner shell study is a DEV-only lazy route using the real Library presentation', async () => {
  const [entry, html, source] = await Promise.all([
    read('./main.jsx'),
    read('../../../owner-shell-wireframe.html'),
    read('./OwnerShellPrototype.jsx'),
  ]);
  assert.match(html, /\/src\/prototypes\/owner-shell\/main\.jsx/);
  assert.match(entry, /OwnerShellPrototype/);
  assert.match(source, /Modul8rLibraryAdapter/);
  assert.match(source, /LatticeFocusViewer/);
  assert.match(source, /OwnerShellFocusArtwork/);
  assert.match(source, /OwnerShellIdentityDossier/);
  assert.match(source, /useBrowserWorkspace/);
  assert.doesNotMatch(source, /SEARCH · ORGANIZE · DRAG TO GRID/);
  assert.doesNotMatch(source, /<strong>LIBRARY<\/strong>|Close Library/);
  assert.match(source, /<footer className="owner-shell-study__local-rail"><OwnerShellLibraryRail/);
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
  const source = await read('./OwnerShellPrototype.jsx');
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
    read('./OwnerShellPrototype.jsx'),
    read('./ownerShellPrototype.css'),
  ]);
  assert.doesNotMatch(source, /IDENTITY ONLY \/ PROFILE ACTIONS CAN FOLLOW HERE/);
  assert.match(source, /data-identity-dossier-source="true"/);
  assert.match(source, /data-viewing=\{Boolean\(identityDossierSession\)/);
  assert.match(style, /owner-shell-study__profile\[data-viewing\] \{ visibility: hidden; \}/);
  assert.match(style, /grid-template-columns: max-content 180px minmax\(410px, 1fr\)/);
  assert.match(style, /@media \(max-width: 1100px\)[^}]+grid-template-columns: max-content 52px minmax\(0, 1fr\)/s);
  assert.match(style, /owner-shell-study__identity > strong \{ display: none; \}/);
  assert.match(style, /owner-shell-study__global \.owner-shell-study__table \{ width: 52px; min-width: 52px;[^}]+display: flex;/);
  assert.match(source, /Grid3X3 className="owner-shell-study__table-icon"/);
  assert.match(style, /owner-shell-study__global button \{ width: 52px; min-width: 52px;[^}]+font-size: 0;/);
  assert.match(source, /function usePrototypePresence\(open, exitMs = PANEL_EXIT_MS, entranceFrames = 1\)/);
  assert.match(source, /discoverPresence = usePrototypePresence\(discoverOpen, DISCOVER_EXIT_MS, 2\)/);
  assert.match(source, /libraryPresence\.present/);
  assert.match(source, /discoverPresence\.present/);
  assert.match(source, /profilePresence\.present/);
  assert.match(style, /--prototype-motion-out: 140ms/);
  assert.match(style, /owner-shell-study__motion-panel\[data-panel-phase="closing"\] \{ transition-duration: var\(--prototype-motion-out\); \}/);
  assert.match(source, /owner-shell-study__discover owner-shell-study__motion-panel/);
  assert.match(source, /Identity RÄCK workflow fixture/);
  assert.match(source, /\['ALL', 'ASSETS', 'LYX', 'SOCIAL'\]/);
  assert.match(source, /aria-label="Full activity history"/);
  assert.match(source, /\['ALL', 'UNREAD', 'ASSETS', 'LYX', 'SOCIAL'\]/);
  assert.match(source, /EVENT, ASSET OR PROFILE/);
  assert.match(source, /data-canvas-context=\{canvasContext\}/);
  assert.match(source, /placementRectangleFromPointer/);
  assert.match(source, /owner-shell-study__placement-preview/);
  assert.match(style, /owner-shell-study\[data-canvas-context="workspace"\] \.owner-shell-study__canvas/);
  assert.match(style, /owner-shell-study__library\[data-placing\]/);
  assert.match(style, /owner-shell-study__workspace-rail-controls \{ height: 38px;[^}]+grid-template-columns:/);
  assert.match(style, /owner-shell-study__library \.lattice-browser-sidebar button \{ font: var\(--prototype-type-label\); letter-spacing: \.06em; \}/);
  assert.match(source, /function OwnerShellWorkspaceRail/);
  assert.match(style, /owner-shell-study__select-popover/);
  assert.match(style, /owner-shell-study__local-rail/);
  assert.match(style, /--prototype-type-control/);
  assert.match(style, /--prototype-selection/);
  assert.doesNotMatch(source, /KEEPER SIGNALS \/ COMPLETE RECORD/);
  assert.doesNotMatch(source, /owner-shell-study__activity-history-summary/);
  assert.doesNotMatch(source, /FULL HISTORY IS NOT CONNECTED IN THIS STUDY/);
  assert.match(style, /owner-shell-study__activity-history \{/);
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
  assert.match(source, /data-sidebar-collapsed=\{workspace\.sidebarWidth <= 76/);
  assert.match(style, /data-sidebar-collapsed[^}]+width: max-content/s);
  assert.match(source, /DISCOVER_ROLE_OPTIONS/);
  assert.match(source, /DISCOVER_SORT_OPTIONS/);
  assert.match(source, /libraryPresence\.present \|\| activityHistoryPresence\.present \|\| discoverPresence\.present/);
  assert.doesNotMatch(source, /aria-hidden=\{discoverPresence\.present \|\| undefined\} aria-label="Central lattice"/);
  assert.doesNotMatch(source, /Close Directory/);
  assert.match(source, /LAYERS \/ THIS TABLE/);
  assert.doesNotMatch(source, /owner-shell-study__inspector-art|<small>ARTWORK<\/small>/);
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
  assert.match(source, /aria-label="Table strip"/);
  assert.match(source, /aria-label="Add table to the right"/);
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
  assert.doesNotMatch(source, /owner-shell-study__viewer-rack|owner-shell-study__viewer-modules/);
  assert.match(source, /selectedPlacementIds/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /owner-shell-study__marquee/);
  assert.match(source, /Resize selection from \$\{corner\}/);
  assert.match(source, /selectedPlacements\.length !== 1/);
  assert.match(source, /\['nw', 'ne', 'se', 'sw'\]/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /Math\.round\([^\n]+\/ cell\) \* cell/);
  assert.match(source, /crop: cropForPlacementFrame\(start\.crop, asset, width, height\)/);
  assert.match(style, /\.owner-shell-study__placement \{[^}]*border: 0;/s);
  assert.doesNotMatch(style, /\.owner-shell-study__placement\[aria-pressed="true"\] \{[^}]*border-color:/s);
});

test('profile identity uses one prototype-local expanding card with complete collapsed borders', async () => {
  const [source, style] = await Promise.all([
    read('./OwnerShellIdentityDossier.jsx'),
    read('./ownerShellIdentityDossier.css'),
  ]);
  assert.match(source, /className="owner-shell-identity__lead"/);
  assert.match(source, /data-lattice-menu-surface/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{\s*settleFrameRef\.current = requestAnimationFrame/s);
  assert.doesNotMatch(source, /source-summary|clone/iu);
  assert.match(source, /active \? expandedHeight : MODULE_HEADER_HEIGHT/);
  assert.match(style, /border: 1px solid var\(--lattice-menu-line-strong\)/);
  assert.match(style, /lead code[^}]+font: var\(--prototype-type-micro\)/);
  assert.match(style, /background-color 420ms/);
  assert.match(style, /owner-shell-identity__rack \{[^}]+box-shadow: var\(--prototype-shadow-workspace\)/s);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+owner-shell-identity__rack \{ box-shadow: var\(--prototype-shadow-compact\)/s);
  assert.match(style, /border-color: var\(--lattice-menu-line-strong\); box-shadow: none/);
  assert.match(source, /--owner-shell-identity-expanded-width/);
  assert.match(source, /className="owner-shell-identity__rack-viewport"/);
  assert.match(style, /owner-shell-identity__rack-viewport \{[^}]+inset: 0 0 52px; overflow: hidden/s);
  assert.match(style, /width: var\(--owner-shell-identity-expanded-width, 100%\)/);
  assert.match(style, /\[data-phase="closing"\] .owner-shell-identity__panel \{ opacity: 0; transition-duration: 70ms/);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+background-color: transparent/s);
  assert.match(style, /\[data-phase="starting"\].+\[data-phase="closing"\].+display: none/s);
  assert.doesNotMatch(style, /clip-path/);
});
