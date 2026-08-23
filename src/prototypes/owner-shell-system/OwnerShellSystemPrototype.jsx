import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { LATTICE_PRODUCTION_SURFACE_IDS } from '../../lattice/domain/latticeProductionDraft.js';
import useBrowserWorkspace from '../../lattice/browser/useBrowserWorkspace.js';
import '../../lattice/rendering/latticeMenuSurface.css';
import OwnerShellSystemActivityDrawer from './OwnerShellSystemActivityDrawer.jsx';
import OwnerShellSystemActivityHistory from './OwnerShellSystemActivityHistory.jsx';
import OwnerShellSystemArtworkViewer from './OwnerShellSystemArtworkViewer.jsx';
import OwnerShellSystemCanvas from './OwnerShellSystemCanvas.jsx';
import OwnerShellSystemDiscoverWorkspace from './OwnerShellSystemDiscoverWorkspace.jsx';
import OwnerShellSystemGlobalBar from './OwnerShellSystemGlobalBar.jsx';
import OwnerShellSystemIdentityDossier from './OwnerShellSystemIdentityDossier.jsx';
import OwnerShellSystemLibraryWorkspace from './OwnerShellSystemLibraryWorkspace.jsx';
import OwnerShellSystemProfilePanel from './OwnerShellSystemProfilePanel.jsx';
import OwnerShellSystemSettingsPanel from './OwnerShellSystemSettingsPanel.jsx';
import OwnerShellSystemTableSwitcher from './OwnerShellSystemTableSwitcher.jsx';
import OwnerShellSystemSelectionInspector from './OwnerShellSystemSelectionInspector.jsx';
import useOwnerShellSystemAssetPlacement from './useOwnerShellSystemAssetPlacement.js';
import useOwnerShellSystemArtworkViewer from './useOwnerShellSystemArtworkViewer.js';
import useOwnerShellSystemCrop from './useOwnerShellSystemCrop.js';
import useOwnerShellSystemPlacementInteraction from './useOwnerShellSystemPlacementInteraction.js';
import useOwnerShellSystemPanels from './useOwnerShellSystemPanels.js';
import useOwnerShellSystemPresentation from './useOwnerShellSystemPresentation.js';
import useOwnerShellSystemSelectionCommands from './useOwnerShellSystemSelectionCommands.js';
import useOwnerShellSystemTables from './useOwnerShellSystemTables.js';
import './ownerShellSystemPrototype.css';

const ASSETS = Object.freeze([
  { stableAssetId: '42:0x1111111111111111111111111111111111111111:contract', title: 'Abyssal Study', collection: 'INSCAPE Studies', owned: true, created: true, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/actors/abyssal_eye/full.webp', previewSrc: '/assets/actors/abyssal_eye/full.webp', previewCandidates: ['/assets/actors/abyssal_eye/full.webp'] },
  { stableAssetId: '42:0x2222222222222222222222222222222222222222:contract', title: 'Skull Reaper', collection: 'INSCAPE Studies', owned: true, created: true, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/actors/skull_reaper/full.webp', previewSrc: '/assets/actors/skull_reaper/full.webp', previewCandidates: ['/assets/actors/skull_reaper/full.webp'] },
  { stableAssetId: '42:0x3333333333333333333333333333333333333333:contract', title: 'Mountain Signal I', collection: 'Field Signals', owned: true, created: false, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/stage/mountains/mountain_01.webp', previewSrc: '/assets/stage/mountains/mountain_01.webp', previewCandidates: ['/assets/stage/mountains/mountain_01.webp'] },
  { stableAssetId: '42:0x4444444444444444444444444444444444444444:contract', title: 'Mountain Signal II', collection: 'Field Signals', owned: true, created: false, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/stage/mountains/mountain_02.webp', previewSrc: '/assets/stage/mountains/mountain_02.webp', previewCandidates: ['/assets/stage/mountains/mountain_02.webp'] },
  { stableAssetId: '42:0x5555555555555555555555555555555555555555:contract', title: 'Digital Membrane', collection: 'Surface Archive', owned: false, created: true, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/stage/patterns/digitalblob_top.webp', previewSrc: '/assets/stage/patterns/digitalblob_top.webp', previewCandidates: ['/assets/stage/patterns/digitalblob_top.webp'] },
  { stableAssetId: '42:0x6666666666666666666666666666666666666666:contract', title: 'Zebra Field', collection: 'Surface Archive', owned: true, created: false, mediaType: 'image', placeable: true, width: 1024, height: 1024, src: '/assets/stage/patterns/zebra_top.webp', previewSrc: '/assets/stage/patterns/zebra_top.webp', previewCandidates: ['/assets/stage/patterns/zebra_top.webp'] },
  { stableAssetId: '42:0x7777777777777777777777777777777777777777:contract', title: 'Moon Purple', collection: 'Chromatic Fields', owned: true, created: true, mediaType: 'image', placeable: true, width: 4636, height: 2000, src: '/assets/stage/backdrops/backdrop_moonpurple.webp', previewSrc: '/assets/stage/backdrops/backdrop_moonpurple.webp', previewCandidates: ['/assets/stage/backdrops/backdrop_moonpurple.webp'] },
]);

const INITIAL_CATEGORIES = Object.freeze([
  { id: 'portfolio', name: 'PORTFOLIO', public: true, assetIds: [ASSETS[0].stableAssetId, ASSETS[1].stableAssetId, ASSETS[6].stableAssetId] },
  { id: 'field-notes', name: 'FIELD NOTES', public: false, assetIds: [ASSETS[2].stableAssetId, ASSETS[3].stableAssetId] },
]);

const INITIAL_TABLES = Object.freeze([
  { id: 'home', name: 'HOME', public: true },
]);

const INITIAL_PLACEMENTS = Object.freeze([
  { id: 'placement-1', assetId: ASSETS[0].stableAssetId, crop: null, left: 690, tableId: 'home', top: 176, width: 190, height: 190 },
  { id: 'placement-2', assetId: ASSETS[3].stableAssetId, crop: { x: 0.5, y: 0.5, zoom: 1 }, left: 920, tableId: 'home', top: 420, width: 240, height: 135 },
]);

const GRID_CELL = 40;

const PEOPLE = Object.freeze([
  { id: 'signal-archive', name: 'SIGNAL ARCHIVE', role: 'CURATOR', following: true, follower: false, groups: ['references'], asset: ASSETS[2] },
  { id: 'surface-unit', name: 'SURFACE UNIT', role: 'ARTIST', following: false, follower: true, groups: ['collaborators'], asset: ASSETS[4] },
  { id: 'chromatic-office', name: 'CHROMATIC OFFICE', role: 'PUBLISHER', following: true, follower: true, groups: ['references', 'collaborators'], asset: ASSETS[6] },
]);

const DISCOVER_GROUPS = Object.freeze([
  { id: 'references', name: 'REFERENCES' },
  { id: 'collaborators', name: 'COLLABORATORS' },
]);

const ACTIVITY = Object.freeze([
  { id: 'activity-1', type: 'ASSETS', date: 'TODAY', time: 'NOW', label: 'ASSET RECEIVED', detail: 'ABYSSAL STUDY · FROM 0x8A…92F1', unread: true },
  { id: 'activity-2', type: 'SOCIAL', date: 'TODAY', time: '12M', label: 'NEW FOLLOWER', detail: 'SIGNAL ARCHIVE', unread: true },
  { id: 'activity-3', type: 'LYX', date: 'TODAY', time: '2H', label: 'LYX RECEIVED', detail: '4.25 LYX · FROM 0x17…A340', unread: false },
  { id: 'activity-4', type: 'ASSETS', date: 'YESTERDAY', time: '1D', label: 'ASSET SENT', detail: 'MOUNTAIN SIGNAL I · TO 0x73…B112', unread: false },
  { id: 'activity-5', type: 'SOCIAL', date: '11 AUG', time: '2D', label: 'PROFILE FOLLOWED', detail: 'CHROMATIC OFFICE', unread: false },
  { id: 'activity-6', type: 'ASSETS', date: '09 AUG', time: '4D', label: 'ASSET PUBLISHED', detail: 'MOON PURPLE · HOME TABLE', unread: false },
  { id: 'activity-7', type: 'LYX', date: '06 AUG', time: '7D', label: 'LYX SENT', detail: '1.00 LYX · TO 0x91…44C2', unread: false },
  { id: 'activity-8', type: 'SOCIAL', date: '02 AUG', time: '11D', label: 'PROFILE UNFOLLOWED', detail: 'SURFACE UNIT', unread: false },
]);

const SIGNAL_OPTIONS = Object.freeze([
  ['notifications', 'KEEPER NOTIFICATIONS'],
  ['speech', 'SPEECH'],
  ['visualEffects', 'VISUAL SIGNAL EFFECTS'],
  ['audio', 'AUDIO NOTIFICATIONS'],
]);

const VISITOR_OPTIONS = Object.freeze([
  ['showCategories', 'SHOW CATEGORIES'],
  ['showCreations', 'SHOW CREATIONS'],
]);

const GRID_DISPLAY_OPTIONS = Object.freeze([
  { label: 'LINES', value: 'lines' },
  { label: 'DOTS', value: 'dots' },
  { label: 'NONE', value: 'none' },
]);

const IDENTITY_DOSSIER_FIXTURE = Object.freeze({
  key: '0x1111111111111111111111111111111111111111',
  address: '0x1111111111111111111111111111111111111111',
  profile: Object.freeze({
    displayName: 'RADAR VISUALS',
    nameProvenance: 'LSP3_NAME',
    avatarUrl: null,
    avatarProvenance: 'UNRESOLVED',
    avatarShape: 'round',
    profileImageTokenReference: null,
    backgroundUrl: null,
    backgroundProvenance: null,
    description: 'Identity RÄCK workflow fixture for the owner-shell study. Production profile metadata remains the source of truth in the real application.',
    descriptionProvenance: 'LSP3_DESCRIPTION',
    tags: Object.freeze(['ARTIST', 'CURATOR']),
    metadataIntegrity: 'VERIFIED',
  }),
  links: Object.freeze([
    Object.freeze({ id: 'inscape', label: 'INSCAPE PROFILE', url: 'https://enterinscape.netlify.app/', kind: 'SYSTEM' }),
  ]),
  technical: Object.freeze([
    Object.freeze({ id: 'address', label: 'UNIVERSAL PROFILE ADDRESS', value: '0x1111111111111111111111111111111111111111', provenance: 'CANONICAL_ADDRESS' }),
    Object.freeze({ id: 'metadata-integrity', label: 'LSP3 METADATA INTEGRITY', value: 'WORKFLOW FIXTURE', provenance: 'RESOLUTION_STATUS' }),
    Object.freeze({ id: 'network', label: 'NETWORK', value: 'LUKSO / CHAIN 42', provenance: 'DIRECT_RPC' }),
    Object.freeze({ id: 'type', label: 'PROFILE TYPE', value: 'LSP0 UNIVERSAL PROFILE', provenance: 'DIRECT_RPC' }),
  ]),
  status: Object.freeze({ metadata: 'RESOLVED' }),
});

const SIDEBAR_COLLAPSED_WIDTH = 48;
const SIDEBAR_EXPANDED_WIDTH = 174;
const SIDEBAR_MAX_WIDTH = 300;

function usePrototypeSidebarGeometry(initialWidth = SIDEBAR_EXPANDED_WIDTH) {
  const [width, setWidth] = useState(initialWidth);
  const gestureRef = useRef(null);
  const clamp = (value) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_COLLAPSED_WIDTH, value));
  const resize = {
    begin(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      gestureRef.current = { pointerId: event.pointerId, startWidth: width, startX: event.clientX };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    update(event) {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      setWidth(clamp(gesture.startWidth + event.clientX - gesture.startX));
    },
    finish(event) {
      if (gestureRef.current?.pointerId !== event.pointerId) return;
      gestureRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
  };
  return { collapsed: width === SIDEBAR_COLLAPSED_WIDTH, resize, setWidth: (value) => setWidth(clamp(value)), width };
}

const DISCOVER_SORT_OPTIONS = Object.freeze([
  { label: 'NAME / A–Z', value: 'name-asc' },
  { label: 'NAME / Z–A', value: 'name-desc' },
]);

export default function OwnerShellSystemPrototype() {
  const [preview, setPreview] = useState(false);
  const [discoverFilter, setDiscoverFilter] = useState('ALL');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverSort, setDiscoverSort] = useState('name-asc');
  const [discoverCardSize, setDiscoverCardSize] = useState(220);
  const [discoverLabelsVisible, setDiscoverLabelsVisible] = useState(true);
  const [discoverSection, setDiscoverSection] = useState('all');
  const [activityTab, setActivityTab] = useState('ALL');
  const [activityHistoryFilter, setActivityHistoryFilter] = useState('ALL');
  const [activityHistoryQuery, setActivityHistoryQuery] = useState('');
  const [activityReadIds, setActivityReadIds] = useState([]);
  const [gridSurface, setGridSurface] = useState('mist');
  const [gridDisplay, setGridDisplay] = useState('lines');
  const [gridDotSize, setGridDotSize] = useState(1.5);
  const [menuSurface, setMenuSurface] = useState('mist');
  const [signalSettings, setSignalSettings] = useState({ audio: false, notifications: true, speech: true, visualEffects: true });
  const [visitorPresentation, setVisitorPresentation] = useState({ showCategories: true, showCreations: true });
  const [categories, setCategories] = useState(() => INITIAL_CATEGORIES.map((category) => ({ ...category, assetIds: [...category.assetIds] })));
  const [placements, setPlacements] = useState(() => INITIAL_PLACEMENTS.map((placement) => ({ ...placement })));
  const [identityDossierSession, setIdentityDossierSession] = useState(null);
  const [notice, setNotice] = useState(null);
  const [viewport, setViewport] = useState(() => ({ height: globalThis.innerHeight || 1000, width: globalThis.innerWidth || 1440 }));
  const [dockAnchors, setDockAnchors] = useState({ activity: 182 });
  const canvasRef = useRef(null);
  const dockTriggerRefs = useRef(new Map());
  const profileIdentityRef = useRef(null);
  const profilePanelRef = useRef(null);
  const tableRowRefs = useRef(new Map());
  const tableActionRefs = useRef(new Map());
  const data = useMemo(() => ({
    assetError: null, assetLoadState: 'ready', assetProgress: { failures: 0, resolved: ASSETS.length, total: ASSETS.length },
    assets: ASSETS, categories, createdStatus: 'ready', ownerContext: '0xprototype', usedAssetIds: placements.map(({ assetId }) => assetId),
  }), [categories, placements]);
  const workspace = useBrowserWorkspace(data);
  const librarySidebar = usePrototypeSidebarGeometry(workspace.sidebarWidth);
  const discoverSidebar = usePrototypeSidebarGeometry();
  const prototypeWorkspace = { ...workspace, sidebarResize: librarySidebar.resize, sidebarWidth: librarySidebar.width };
  const {
    actionId: tableActionId,
    activeTable,
    activeTableId,
    addTable,
    beginRename: beginTableRename,
    cancelDelete: cancelTableDelete,
    cancelTransientAction: cancelTableAction,
    changeActionId: changeTableActionId,
    deleteId: tableDeleteId,
    finishRename: finishTableRename,
    removeTable: deleteTable,
    rename: tableRename,
    reorderTable,
    reorderTableByOffset,
    requestDelete: requestTableDelete,
    setRenameName: setTableRenameName,
    tables,
    updateActiveTable,
    visitTable,
  } = useOwnerShellSystemTables({
    actionRefs: tableActionRefs,
    initialTables: INITIAL_TABLES,
    onVisit: () => {
      clearSelection();
      finishCrop();
      cancelPresentation();
      cancelRemove();
    },
    setPlacements,
  });
  const {
    activityExpanded,
    close: closePanels,
    isOpen: isPanelOpen,
    open: openPanel,
    presence: {
      activity: activityPresence,
      activityHistory: activityHistoryPresence,
      discover: discoverPresence,
      library: libraryPresence,
      profile: profilePresence,
      settings: settingsPresence,
      tables: tablePresence,
    },
  } = useOwnerShellSystemPanels({
    blocked: Boolean(identityDossierSession),
    cancelBeforeClose: cancelTableAction,
  });
  const discoverOpen = isPanelOpen('discover');
  const libraryOpen = isPanelOpen('library');
  const profileOpen = isPanelOpen('profile');
  const settingsOpen = isPanelOpen('settings');
  const tableMapOpen = isPanelOpen('tables');

  const visibleDiscoverPeople = useMemo(() => PEOPLE.filter((person) => {
    if (discoverSection === 'following' && !person.following) return false;
    if (discoverSection === 'followers' && !person.follower) return false;
    if (!['all', 'following', 'followers'].includes(discoverSection) && !person.groups.includes(discoverSection)) return false;
    return (discoverFilter === 'ALL' || person.role === discoverFilter)
      && `${person.name} ${person.role}`.includes(discoverQuery.trim().toUpperCase());
  }).sort((left, right) => {
    const direction = discoverSort === 'name-desc' ? -1 : 1;
    return direction * left.name.localeCompare(right.name);
  }), [discoverFilter, discoverQuery, discoverSection, discoverSort]);

  useEffect(() => {
    const updateViewport = () => setViewport({ height: globalThis.innerHeight, width: globalThis.innerWidth });
    globalThis.addEventListener('resize', updateViewport);
    return () => globalThis.removeEventListener('resize', updateViewport);
  }, []);

  useLayoutEffect(() => {
    const next = {};
    dockTriggerRefs.current.forEach((node, key) => { next[key] = Math.round(node.getBoundingClientRect().left); });
    setDockAnchors((current) => Object.keys(next).every((key) => current[key] === next[key]) ? current : { ...current, ...next });
  }, [viewport.width]);

  const updateCategory = (id, update) => setCategories((current) => current.map((category) => category.id === id
    ? { ...category, ...update(category) } : category));
  const categoryCommands = {
    createCategory(name) {
      const id = `category-${Date.now()}`;
      setCategories((current) => [...current, { id, name, public: false, assetIds: [] }]);
      return id;
    },
    deleteCategory(id) { setCategories((current) => current.filter((category) => category.id !== id)); return true; },
    renameCategory(id, name) { updateCategory(id, () => ({ name })); return true; },
    setCategoryAssets(id, assetIds, value) {
      updateCategory(id, (category) => ({ assetIds: value
        ? [...new Set([...category.assetIds, ...assetIds])] : category.assetIds.filter((assetId) => !assetIds.includes(assetId)) }));
      return true;
    },
    setCategoryPublic(id, value) { updateCategory(id, () => ({ public: value })); return true; },
  };

  const activePlacements = placements.filter(({ tableId }) => tableId === activeTableId);
  const {
    applyCrop,
    beginCrop,
    beginCropDrag,
    cancelCrop,
    cropSession,
    finishCrop,
    restoreNativeFit,
    updateCropPlacementGeometry,
    updateCropZoom,
  } = useOwnerShellSystemCrop({
    assets: ASSETS,
    onNotice: (message) => showStudyNotice(message),
    setPlacements,
  });
  const {
    applyPresentation,
    beginPresentation,
    cancelPresentation,
    presentationSession,
    updatePresentation,
  } = useOwnerShellSystemPresentation({
    onNotice: (message) => showStudyNotice(message),
  });
  const {
    beginCanvasSelection,
    beginPlacementGesture,
    clearSelection,
    marquee,
    placementClickSuppressedRef,
    replaceSelection,
    selectedPlacement,
    selectedPlacementId,
    selectedPlacementIds,
    selectedPlacements,
    selectionBounds,
    selectPlacement,
  } = useOwnerShellSystemPlacementInteraction({
    activePlacements,
    assets: ASSETS,
    canvasRef,
    cell: GRID_CELL,
    cropSession,
    onClearCanvas: () => closeTransientPanels(),
    onPlacementGeometryChange: updateCropPlacementGeometry,
    presentationSession,
    preview,
    setPlacements,
  });
  const { beginAssetDrag, drag } = useOwnerShellSystemAssetPlacement({
    activeTableId,
    canvasRef,
    cell: GRID_CELL,
    preview,
    replaceSelection,
    setPlacements,
  });
  const {
    cancelRemove,
    duplicateSelected,
    layers: inspectorLayers,
    mirrorHorizontal,
    mirrorVertical,
    moveSelectedLayer,
    removePlacement,
    requestRemove,
    rotate,
    selectLayer,
    toggleLock,
  } = useOwnerShellSystemSelectionCommands({
    activePlacements,
    activeTableId,
    assets: ASSETS,
    onNotice: (message) => showStudyNotice(message),
    replaceSelection,
    selectedPlacementId,
    selectedPlacementIds,
    selectedPlacements,
    selectPlacement,
    setPlacements,
  });
  const inspectorHeight = cropSession ? 112 : presentationSession ? 184 : Math.min(480, 78 + activePlacements.length * 38);
  const inspectorTop = viewport.height - 64 - inspectorHeight;
  const inspectorOverlap = (left) => {
    if (!selectionBounds) return 0;
    const right = left + 402;
    const overlapWidth = Math.max(0, Math.min(selectionBounds.right + 8, right) - Math.max(selectionBounds.left - 8, left));
    const overlapHeight = Math.max(0, Math.min(selectionBounds.bottom + 8, viewport.height - 64) - Math.max(selectionBounds.top - 8, inspectorTop));
    return overlapWidth * overlapHeight;
  };
  const inspectorSide = inspectorOverlap(viewport.width - 414) > inspectorOverlap(12) ? 'left' : 'right';
  const canvasPlacementEntries = activePlacements.map((placement) => ({
    asset: ASSETS.find(({ stableAssetId }) => stableAssetId === placement.assetId),
    cropping: cropSession?.placementId === placement.id,
    placement,
    selected: selectedPlacementIds.includes(placement.id) && !placement.locked,
    visibleCrop: cropSession?.placementId === placement.id ? cropSession.previewCrop : placement.crop,
  }));

  useLayoutEffect(() => {
    if (!tableMapOpen) return undefined;
    const frame = requestAnimationFrame(() => tableRowRefs.current.get(activeTableId)?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [activeTableId, tableMapOpen, tables.length]);
  const closeTransientPanels = () => {
    finishCrop();
    cancelPresentation();
    cancelRemove();
    closePanels();
  };
  const toggleWorkspacePanel = (panelId) => {
    const shouldOpen = !isPanelOpen(panelId);
    closeTransientPanels();
    if (shouldOpen) openPanel(panelId);
  };
  const {
    close: closePlacementViewer,
    entry: viewerEntry,
    getReturnRectangle: getViewerReturnRectangle,
    navigate: navigateViewer,
    open: openPlacementViewer,
    originRectangle: viewerOriginRectangle,
    placementId: viewerPlacementId,
    position: viewerPosition,
    registerPlacement: handlePlacementRef,
    returnFocus: viewerReturnFocus,
    total: viewerTotal,
  } = useOwnerShellSystemArtworkViewer({
    activePlacements,
    assets: ASSETS,
    onOpen: closeTransientPanels,
    replaceSelection,
  });
  const openIdentityDossier = () => {
    const source = profilePanelRef.current;
    if (!source) return;
    const rectangle = source.getBoundingClientRect();
    setIdentityDossierSession({
      originRectangle: {
        bottom: rectangle.bottom,
        height: rectangle.height,
        left: rectangle.left,
        right: rectangle.right,
        top: rectangle.top,
        width: rectangle.width,
      },
      viewport: { height: globalThis.innerHeight, width: globalThis.innerWidth },
    });
  };
  const eventIsUnread = (event) => event.unread && !activityReadIds.includes(event.id);
  const unreadActivityCount = ACTIVITY.filter(eventIsUnread).length;
  const visibleActivityNotifications = ACTIVITY
    .filter(({ type }) => activityTab === 'ALL' || type === activityTab)
    .map((event) => ({ ...event, unread: eventIsUnread(event) }));
  const visibleActivityHistory = ACTIVITY.filter((event) => {
    const matchesFilter = activityHistoryFilter === 'ALL'
      || (activityHistoryFilter === 'UNREAD' ? eventIsUnread(event) : event.type === activityHistoryFilter);
    const query = activityHistoryQuery.trim().toUpperCase();
    return matchesFilter && (!query || `${event.label} ${event.detail} ${event.type} ${event.date}`.includes(query));
  });
  const showStudyNotice = (message) => {
    setNotice(message);
    globalThis.setTimeout(() => setNotice(null), 2400);
  };
  const handlePlacementClick = (event, placement) => {
    if (placementClickSuppressedRef.current) return;
    if (preview) openPlacementViewer(placement.id);
    else if (placement.locked) return;
    else if (!cropSession && !presentationSession) selectPlacement(placement.id, event.shiftKey);
  };
  const handlePlacementDoubleClick = (event, placement) => {
    if ((!preview && placement.locked) || cropSession || presentationSession) return;
    event.stopPropagation();
    openPlacementViewer(placement.id);
  };
  const handlePlacementKeyDown = (event, placement) => {
    if (event.key !== 'Enter' || (!preview && placement.locked) || cropSession || presentationSession) return;
    event.preventDefault();
    openPlacementViewer(placement.id);
  };
  const handlePlacementPointerDown = (event, placement, cropping) => {
    if (cropping) beginCropDrag(event, placement.id);
    else beginPlacementGesture(event, placement);
  };
  const canvasContext = drag
    ? 'placing'
    : libraryPresence.present || activityHistoryPresence.present || discoverPresence.present
        ? 'workspace'
        : 'canvas';

  return <main className="owner-shell-system" data-canvas-context={canvasContext} data-lattice-menu-surface data-menu-surface={menuSurface} data-preview={preview || undefined} data-surface={gridSurface}
    style={Object.fromEntries(Object.entries(dockAnchors).map(([key, left]) => [`--dock-${key}-left`, `${left}px`]))}>
    <OwnerShellSystemGlobalBar
      activeTableName={activeTable?.name}
      activityExpanded={activityExpanded}
      activityTriggerRef={(node) => { if (node) dockTriggerRefs.current.set('activity', node); }}
      discoverOpen={discoverOpen}
      discoverTriggerRef={(node) => { if (node) dockTriggerRefs.current.set('discover', node); }}
      libraryOpen={libraryOpen}
      libraryTriggerRef={(node) => { if (node) dockTriggerRefs.current.set('library', node); }}
      onActivityToggle={() => activityExpanded ? closeTransientPanels() : toggleWorkspacePanel('activity')}
      onDiscoverToggle={() => toggleWorkspacePanel('discover')}
      onLibraryToggle={() => toggleWorkspacePanel('library')}
      onPreviewToggle={() => { setPreview((value) => !value); closeTransientPanels(); }}
      onProfileToggle={() => toggleWorkspacePanel('profile')}
      onPublish={() => showStudyNotice('PUBLICATION IS NOT CONNECTED IN THIS STUDY')}
      onSettingsToggle={() => toggleWorkspacePanel('settings')}
      onTableToggle={() => toggleWorkspacePanel('tables')}
      preview={preview}
      profileOpen={profileOpen}
      settingsOpen={settingsOpen}
      tableOpen={tableMapOpen}
      unreadCount={unreadActivityCount}
    />

    <OwnerShellSystemCanvas
      canvasRef={canvasRef}
      cropPlacementId={cropSession?.placementId || null}
      drag={drag}
      entries={canvasPlacementEntries}
      gridDisplay={gridDisplay}
      gridDotSize={gridDotSize}
      marquee={marquee}
      onCanvasPointerDown={beginCanvasSelection}
      onPlacementClick={handlePlacementClick}
      onPlacementDoubleClick={handlePlacementDoubleClick}
      onPlacementKeyDown={handlePlacementKeyDown}
      onPlacementPointerDown={handlePlacementPointerDown}
      onPlacementRef={handlePlacementRef}
      onResizePointerDown={(event, placement, corner) => beginPlacementGesture(event, placement, 'resize', corner)}
      preview={preview}
      selectedPlacement={presentationSession ? null : selectedPlacement}
      selectedPlacementCount={selectedPlacements.length}
      selectionBounds={selectionBounds}
      viewerPlacementId={viewerPlacementId}
    />

    {!preview && libraryPresence.present && <OwnerShellSystemLibraryWorkspace
      categoryCommands={categoryCommands}
      data={data}
      menuSurface={menuSurface}
      onAssetPointerDown={beginAssetDrag}
      onClose={() => { closePanels(); requestAnimationFrame(() => dockTriggerRefs.current.get('library')?.focus()); }}
      phase={libraryPresence.phase}
      placing={Boolean(drag)}
      sidebarCollapsed={librarySidebar.collapsed}
      sidebarWidth={librarySidebar.width}
      workspace={prototypeWorkspace}
    />}

    {!preview && !viewerPlacementId && !libraryPresence.present && !settingsPresence.present && !profilePresence.present && !activityPresence.present && !activityHistoryPresence.present && !discoverPresence.present && (selectedPlacement || activePlacements.some(({ locked }) => locked)) && <OwnerShellSystemSelectionInspector
      activePlacementCount={activePlacements.length}
      cropSession={cropSession}
      layers={inspectorLayers}
      onApplyCrop={applyCrop}
      onApplyPresentation={applyPresentation}
      onBeginCrop={() => beginCrop(selectedPlacement)}
      onBeginPresentation={() => beginPresentation(selectedPlacement)}
      onCancelCrop={cancelCrop}
      onCancelPresentation={cancelPresentation}
      onDuplicate={duplicateSelected}
      onLayerMove={moveSelectedLayer}
      onLayerSelect={selectLayer}
      onMirrorHorizontal={mirrorHorizontal}
      onMirrorVertical={mirrorVertical}
      onRemoveCancel={cancelRemove}
      onRemoveConfirm={removePlacement}
      onRemoveRequest={requestRemove}
      onRestoreNativeFit={restoreNativeFit}
      onRotate={rotate}
      onToggleLock={toggleLock}
      onUpdateCropZoom={updateCropZoom}
      onUpdatePresentation={updatePresentation}
      presentationSession={presentationSession}
      selectedCount={selectedPlacements.length}
      side={inspectorSide}
    />}

    {profilePresence.present && !preview && <OwnerShellSystemProfilePanel
      dossierOpen={Boolean(identityDossierSession)}
      onOpenDossier={openIdentityDossier}
      panelRef={profilePanelRef}
      phase={profilePresence.phase}
      triggerRef={profileIdentityRef}
    />}

    {identityDossierSession && <OwnerShellSystemIdentityDossier
      getReturnRectangle={() => profilePanelRef.current?.getBoundingClientRect() || identityDossierSession.originRectangle}
      menuSurfaceId={menuSurface}
      model={IDENTITY_DOSSIER_FIXTURE}
      onClosed={() => setIdentityDossierSession(null)}
      originRectangle={identityDossierSession.originRectangle}
      returnFocus={profileIdentityRef.current}
      sourceIdentity={{ displayName: 'RADAR VISUALS', secondaryLabel: '0xPROTOTYPE · OWNER' }}
      viewport={identityDossierSession.viewport}
    />}

    {activityPresence.present && !preview && <OwnerShellSystemActivityDrawer
      activeTab={activityTab}
      events={visibleActivityNotifications}
      onOpenHistory={() => openPanel('activity-history')}
      onTabChange={setActivityTab}
      phase={activityPresence.phase}
    />}

    {activityHistoryPresence.present && !preview && <OwnerShellSystemActivityHistory
      events={visibleActivityHistory.map((event) => ({ ...event, unread: eventIsUnread(event) }))}
      filter={activityHistoryFilter}
      menuSurface={menuSurface}
      onClose={closePanels}
      onFilterChange={setActivityHistoryFilter}
      onMarkAllRead={() => setActivityReadIds(ACTIVITY.filter(({ unread }) => unread).map(({ id }) => id))}
      onOpenEvent={() => showStudyNotice('EVENT DETAIL NAVIGATION IS NOT CONNECTED IN THIS STUDY')}
      onQueryChange={setActivityHistoryQuery}
      phase={activityHistoryPresence.phase}
      query={activityHistoryQuery}
      unreadCount={unreadActivityCount}
    />}

    {discoverPresence.present && !preview && <OwnerShellSystemDiscoverWorkspace
      cardSize={discoverCardSize}
      filter={discoverFilter}
      groups={DISCOVER_GROUPS}
      labelsVisible={discoverLabelsVisible}
      menuSurface={menuSurface}
      onClose={() => { closePanels(); requestAnimationFrame(() => dockTriggerRefs.current.get('discover')?.focus()); }}
      onCreateGroup={() => showStudyNotice('PEOPLE GROUP CREATION WILL OPEN HERE')}
      onFilterChange={setDiscoverFilter}
      onLabelsVisibleChange={setDiscoverLabelsVisible}
      onOpenPerson={() => showStudyNotice('PUBLIC PROFILE NAVIGATION IS NOT CONNECTED IN THIS STUDY')}
      onQueryChange={setDiscoverQuery}
      onResetFilter={() => setDiscoverFilter('ALL')}
      onSectionChange={setDiscoverSection}
      onSizeChange={setDiscoverCardSize}
      onSortChange={setDiscoverSort}
      people={PEOPLE}
      phase={discoverPresence.phase}
      query={discoverQuery}
      resize={discoverSidebar.resize}
      section={discoverSection}
      sidebarCollapsed={discoverSidebar.collapsed}
      sidebarWidth={discoverSidebar.width}
      sort={discoverSort}
      sortOptions={DISCOVER_SORT_OPTIONS}
      visiblePeople={visibleDiscoverPeople}
    />}

    {settingsPresence.present && !preview && <OwnerShellSystemSettingsPanel
      gridDisplay={gridDisplay}
      gridDisplayOptions={GRID_DISPLAY_OPTIONS}
      gridDotSize={gridDotSize}
      gridSurface={gridSurface}
      menuSurface={menuSurface}
      onGridDisplayChange={setGridDisplay}
      onGridDotSizeChange={setGridDotSize}
      onGridSurfaceChange={setGridSurface}
      onMenuSurfaceChange={setMenuSurface}
      onSignalChange={(key, checked) => setSignalSettings((current) => ({ ...current, [key]: checked }))}
      onVisitorPresentationChange={(key, checked) => setVisitorPresentation((current) => ({ ...current, [key]: checked }))}
      phase={settingsPresence.phase}
      signalOptions={SIGNAL_OPTIONS}
      signalSettings={signalSettings}
      surfaceIds={LATTICE_PRODUCTION_SURFACE_IDS}
      visitorOptions={VISITOR_OPTIONS}
      visitorPresentation={visitorPresentation}
    />}

    {tablePresence.present && !preview && <OwnerShellSystemTableSwitcher
      activeTable={activeTable}
      activeTableId={activeTableId}
      actionId={tableActionId}
      actionRefs={tableActionRefs}
      deleteId={tableDeleteId}
      onActionIdChange={changeTableActionId}
      onAdd={addTable}
      onBeginRename={beginTableRename}
      onCancelDelete={cancelTableDelete}
      onConfirmDelete={deleteTable}
      onFinishRename={finishTableRename}
      onRenameChange={setTableRenameName}
      onReorder={reorderTable}
      onReorderByOffset={reorderTableByOffset}
      onRequestDelete={requestTableDelete}
      onToggleVisibility={() => updateActiveTable({ public: !activeTable?.public })}
      onVisit={visitTable}
      phase={tablePresence.phase}
      rename={tableRename}
      rowRefs={tableRowRefs}
      tables={tables}
    />}
    <OwnerShellSystemArtworkViewer
      entry={viewerEntry}
      getReturnRectangle={getViewerReturnRectangle}
      menuSurface={menuSurface}
      onClosed={closePlacementViewer}
      onNavigate={navigateViewer}
      originRectangle={viewerOriginRectangle}
      position={viewerPosition}
      returnFocus={viewerReturnFocus}
      total={viewerTotal}
    />
    {notice && <output className="owner-shell-system__notice">{notice}</output>}
    {preview && <div className="owner-shell-system__preview-label">VISITOR PREVIEW / EDITING HIDDEN</div>}
  </main>;
}
