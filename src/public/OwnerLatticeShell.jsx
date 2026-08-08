import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeProfileAddress } from '../library/config.js';
import { useProfileContractFacts, useProfileIdentity } from '../profileIdentity/index.js';
import {
  LATTICE_PRODUCTION_COORDINATES,
  LATTICE_PRODUCTION_SURFACE_IDS,
  createEmptyLatticeProductionDraft,
  latticeProductionTableId,
} from '../lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../lattice/domain/latticeProductionAdapter.js';
import { assertValidLatticeProductionPublication } from '../lattice/domain/latticeProductionPublication.js';
import LatticeProductionMovementLayer from '../lattice/authoring/LatticeProductionMovementLayer.jsx';
import { createLatticeProductionCropCandidate } from '../lattice/authoring/latticeProductionCrop.js';
import { createLatticeProductionPresentationCandidate } from '../lattice/authoring/latticeProductionPresentation.js';
import {
  createLatticeProductionGroupMovementCandidate,
  createLatticeProductionMovementCandidate,
} from '../lattice/authoring/latticeProductionMovement.js';
import {
  createLatticeProductionGroupResizeCandidate,
  createLatticeProductionResizeCandidate,
} from '../lattice/authoring/latticeProductionResize.js';
import { createLatticeProductionDropGeometry } from '../lattice/authoring/latticeProductionPlacement.js';
import { LATTICE_PRODUCTION_TRANSFORM_OPERATIONS } from '../lattice/authoring/latticeProductionTransform.js';
import {
  DEFAULT_LATTICE_INTERACTION_CONFIG,
  addWheelDelta,
  createPointerGesture,
  entryLatticeCoordinate,
  finishPointerGesture,
  keyboardDirection,
  latticeDestination,
  resolveWheelDestination,
  updatePointerGesture,
} from '../lattice/controller/latticeNavigation.js';
import {
  clampLatticeOwnerCameraY,
  createWidthFitLatticeOwnerViewport,
  updateLatticeOwnerCameraY,
} from '../lattice/controller/latticeOwnerViewport.js';
import LatticeProductionTableRenderer from '../lattice/rendering/LatticeProductionTableRenderer.jsx';
import LatticeFocusViewer from '../lattice/rendering/LatticeFocusViewer.jsx';
import LatticeProductionFocusArtwork from '../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { createLatticeProductionFocusViewModel } from '../lattice/rendering/latticeProductionFocusViewModel.js';
import LatticeNavigationOverlay from '../lattice/rendering/LatticeNavigationOverlay.jsx';
import LatticeProfileRail from '../lattice/rendering/LatticeProfileRail.jsx';
import LatticeProductionIdentityDossier from '../lattice/rendering/LatticeProductionIdentityDossier.jsx';
import LatticeWorkspaceToolbar from '../lattice/rendering/LatticeWorkspaceToolbar.jsx';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';
import { createProductionIdentityDossierViewModel } from './identity/productionIdentityDossierViewModel.js';
import { preloadIdentityProfileImage } from './identity/preloadIdentityProfileImage.js';
import {
  createKeeperPointerFollowScheduler,
  keeperClickToMoveAllowed,
  keeperClickToMoveTargetAllowed,
  keeperPointerFollowAllowed,
  keeperPointerFollowSpeedMultiplier,
  keeperPointerTarget,
} from './keeperPointerFollow.js';
import { prepareOwnerLatticeRuntimeDraft } from './ownerLatticeRuntimeProjection.js';
import KeeperDock from './KeeperDock.jsx';
import KeeperSignalsLayer from '../signals/components/KeeperSignalsLayer.jsx';
import RackMenu from './menus/RackMenu.jsx';
import useOwnerLatticeBrowser from './useOwnerLatticeBrowser.js';
import useOwnerLatticeAuthoring, {
  OWNER_LATTICE_AUTHORING_STATUS,
  ownerLatticePlacementUnavailableReason,
} from './useOwnerLatticeAuthoring.js';
import {
  ActivityBrowser,
  BrowserWorkspace,
  CreationsBrowser,
  Modul8rOwnerWorkspace,
  ProfileDiscoveryBoundary,
  SettingsBrowser,
  productionModul8rSelected,
} from '#owner-workspace-presentation';
import '../lattice/rendering/latticeMenuSurface.css';
import './ownerLatticeShell.css';

const ProfileDocumentPreview = lazy(() => import('../profileDocument/components/ProfileDocumentPreview.jsx'));
const OwnerLatticePublicationRack = lazy(() => import('./OwnerLatticePublicationRack.jsx'));
const ArtworkChooser = lazy(() => import('./LatticeArtworkPlacementChooser.jsx'));

const RUNTIME_PROJECTION_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const CENTER_TABLE_ID = 'table-05';
const PROFILE_RAIL_ENTRIES = Object.freeze([
  { id: 'categories', label: 'CATEGORIES', note: 'ORGANIZE / PROFILE SCOPED' },
  { id: 'creations', label: 'CREATIONS', note: 'CREATOR-ATTRIBUTED WORKS' },
  { id: 'activity', label: 'ACTIVITY', note: 'INDEXED EVENT HISTORY' },
  { id: 'discover', label: 'DISCOVER', note: 'PUBLIC INSCAPE DIRECTORY' },
]);
const WORKSPACE_TOOLS = Object.freeze([
  { id: 'browser', label: 'BROWSER' },
  { id: 'arrange', label: 'ARRANGE' },
  { id: 'preview', label: 'PREVIEW' },
  { id: 'theme', label: 'THEME' },
  { id: 'publish', label: 'PUBLISH' },
  { id: 'more', label: 'MORE' },
]);
const RACK_AUTHORING_TOOLS = Object.freeze(
  [
    WORKSPACE_TOOLS.find(({ id }) => id === 'arrange'),
    { id: 'rotate', label: 'ROTATE' },
    { id: 'mirrorHorizontal', label: 'MIRROR H' },
    { id: 'mirrorVertical', label: 'MIRROR V' },
    { id: 'duplicate', label: 'DUPLICATE' },
  ],
);
const RACK_SYSTEM_TOOLS = Object.freeze(
  ['preview', 'publish', 'theme'].map((id) => WORKSPACE_TOOLS.find((tool) => tool.id === id)),
);
const SURFACE_LABELS = Object.freeze({
  carbon: 'CARBON', graphite: 'GRAPHITE', slate: 'SLATE', ash: 'ASH', mist: 'MIST', paper: 'PAPER',
});
const PUBLICATION_ENVIRONMENT = Object.freeze({ type: 'illustrated', shaderId: 'neural-field' });
const PUBLICATION_SIGNALS = Object.freeze({ notifications: true, speech: true, visualEffects: true, audio: false });
const PUBLICATION_VISITOR_NAVIGATION = Object.freeze({ showCategories: false, showCreations: false });

const sameCoordinate = (left, right) => left.x === right.x && left.y === right.y;
const tableIdentity = (table) => table.title?.trim() || table.id.replace('-', ' ').toUpperCase();
const frozenRectangle = (rectangle) => Object.freeze({
  left: rectangle.left, top: rectangle.top, width: rectangle.width, height: rectangle.height,
});

function UnresolvedRuntimePlacements({ placements }) {
  return placements.map((placement) => <div
    aria-label="Artwork resolving"
    className="owner-lattice-runtime-placeholder"
    data-placement-id={placement.id}
    key={placement.id}
    role="status"
    style={{
      left: `${placement.column / 32 * 100}%`, top: `${placement.row / 18 * 100}%`,
      width: `${placement.columnSpan / 32 * 100}%`, height: `${placement.rowSpan / 18 * 100}%`,
      zIndex: placement.layer + 1,
    }}
  ><span>ASSET RESOLVING</span></div>);
}

export function createEmptyOwnerLatticeRuntimeValue(profileAddress, {
  menuSurfaceId = 'mist',
  surfaceId = 'mist',
} = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid owner lattice profile is required');
  const draft = createEmptyLatticeProductionDraft(profile);
  draft.appearance.surfaceId = surfaceId;
  draft.appearance.menuSurfaceId = menuSurfaceId;
  const publication = projectLatticeProductionPublication(draft, [], {
    lastPublished: RUNTIME_PROJECTION_TIMESTAMP,
  });
  return assertValidLatticeProductionPublication(publication);
}

function ThemeSurface({ anchor, menuSurfaceId, onClose, onMenuSurfaceChange, onSurfaceChange, surfaceId }) {
  const width = 244;
  const anchoredStyle = anchor ? {
    left: Math.max(8, Math.min(anchor.left + anchor.width - width, globalThis.innerWidth - width - 8)),
    right: 'auto',
    top: Math.max(8, Math.min(anchor.top + anchor.height + 1, globalThis.innerHeight - 150)),
  } : undefined;
  return <section className="owner-lattice-theme" data-lattice-chrome aria-label="Phase 4 session Theme" style={anchoredStyle}>
    <header><strong>THEME</strong><button type="button" onClick={onClose} aria-label="Close Theme">×</button></header>
    <label><span>SURFACE</span><select value={surfaceId} onChange={(event) => onSurfaceChange(event.target.value)}>
      {LATTICE_PRODUCTION_SURFACE_IDS.map((id) => <option key={id} value={id}>{SURFACE_LABELS[id]}</option>)}
    </select></label>
    <label><span>MENU SURFACE</span><select value={menuSurfaceId} onChange={(event) => onMenuSurfaceChange(event.target.value)}>
      {LATTICE_PRODUCTION_SURFACE_IDS.map((id) => <option key={id} value={id}>{SURFACE_LABELS[id]}</option>)}
    </select></label>
    <footer>SESSION ONLY / NOT PERSISTED</footer>
  </section>;
}

function OwnerLatticeRuntime({
  activeActorId,
  getWalletPublicationContext,
  interfaceVisible = true,
  keeperVisible = true,
  onPublicationConfirmed,
  onVisitProfile,
  ownerWorkspacePresentation = 'rack',
  publishedResolution,
  residentHandoff,
  keeperReactions,
  revealPresentation = { reducedMotion: false },
  stageId = 'moonpurple',
  visitorWalletConnected = false,
  workspaceProfileAddress,
}) {
  const developmentModul8rActive = import.meta.env.DEV
    && window.location.pathname.replace(/\/+$/, '') === '/development/owner/modul-8r'
    && new URLSearchParams(window.location.search).get('live') === '1';
  const modul8rActive = ownerWorkspacePresentation === 'modul8r' || developmentModul8rActive;
  const profileAddress = workspaceProfileAddress;

  const viewportRef = useRef(null);
  const activeRef = useRef(entryLatticeCoordinate());
  const gestureRef = useRef(null);
  const cameraGestureRef = useRef(null);
  const cameraOffsetsRef = useRef({});
  const spacePressedRef = useRef(false);
  const settlingRef = useRef(false);
  const snapTimerRef = useRef(null);
  const wheelResetTimerRef = useRef(null);
  const wheelAccumulatorRef = useRef({ x: 0, y: 0 });
  const wheelBlockedUntilRef = useRef(0);
  const browserToolRef = useRef(null);
  const previewToolRef = useRef(null);
  const publishToolRef = useRef(null);
  const moreToolRef = useRef(null);
  const previewReturnFocusRef = useRef(null);
  const previewRequestRef = useRef(0);
  const browserReturnFocusRef = useRef(null);
  const modul8rReturnFocusRef = useRef(null);
  const activeWorkspaceWindowRef = useRef('browser');
  const identityControlRef = useRef(null);
  const activityTriggerRef = useRef(null);
  const creationsTriggerRef = useRef(null);
  const discoveryTriggerRef = useRef(null);
  const identityOpenRequestRef = useRef(0);
  const keeperPointerFollowRef = useRef(null);
  const keeperPointerTargetRef = useRef(null);
  const browserDragGestureRef = useRef(null);
  const tableElementsRef = useRef(new Map());
  const [spatialRoot, setSpatialRoot] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState(() => entryLatticeCoordinate());
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapping, setSnapping] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [cameraGestureActive, setCameraGestureActive] = useState(false);
  const [cameraOffsets, setCameraOffsets] = useState({});
  const [spacePanReady, setSpacePanReady] = useState(false);
  const [surfaceId, setSurfaceId] = useState('mist');
  const [menuSurfaceId, setMenuSurfaceId] = useState('mist');
  const [gridStyle, setGridStyle] = useState('lines');
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeAnchor, setThemeAnchor] = useState(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserActivated, setBrowserActivated] = useState(false);
  const [browserActiveTab, setBrowserActiveTab] = useState('index');
  const [browserTabRequest, setBrowserTabRequest] = useState(null);
  const [browserAssetDrag, setBrowserAssetDrag] = useState(null);
  const [canvasPlacementFlow, setCanvasPlacementFlow] = useState(null);
  const [compositionPreview, setCompositionPreview] = useState(null);
  const [cropModeActive, setCropModeActive] = useState(false);
  const [arrangeEnabled, setArrangeEnabled] = useState(false);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState([]);
  const selectedPlacementId = selectedPlacementIds.at(-1) || null;
  const setSelectedPlacementId = useCallback((placementId, options = {}) => {
    setSelectedPlacementIds((current) => {
      if (!placementId) return [];
      if (options.additive) return current.includes(placementId)
        ? current.filter((id) => id !== placementId) : [...current, placementId];
      return [placementId];
    });
  }, []);
  const [placementMedia, setPlacementMedia] = useState({});
  const [viewerSession, setViewerSession] = useState(null);
  const [identityDossierSession, setIdentityDossierSession] = useState(null);
  const [identityDossierOpening, setIdentityDossierOpening] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [keeperDockActive, setKeeperDockActive] = useState(false);
  const [keeperFollowCursor, setKeeperFollowCursor] = useState(true);
  const [keeperMovementSpeed, setKeeperMovementSpeed] = useState('normal');
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [creationsOpen, setCreationsOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [[modul8rRelatedAssetProfile, retainedModul8rRelatedAssetRecords],
    setModul8rRelatedAssetState] = useState([profileAddress, []]);
  const modul8rRelatedAssetRecords = modul8rRelatedAssetProfile === profileAddress
    ? retainedModul8rRelatedAssetRecords : [];
  const [modul8rOpenRequestId, setModul8rOpenRequestId] = useState(0);
  const [modul8rCloseRequestId, setModul8rCloseRequestId] = useState(0);
  const [modul8rModuleRequest, setModul8rModuleRequest] = useState(null);
  const [modul8rPresentationState, setModul8rPresentationState] = useState({
    masterExpanded: true, open: false, openModule: 'library', settingsOpen: false,
  });
  useEffect(() => {
    if (modul8rActive && interfaceVisible && !modul8rReturnFocusRef.current) {
      modul8rReturnFocusRef.current = browserToolRef.current;
    }
  }, [interfaceVisible, modul8rActive]);
  useEffect(() => setRailCollapsed(true), [profileAddress]);
  useEffect(() => setPublicationOpen(false), [profileAddress]);
  const profileIdentity = useProfileIdentity(profileAddress);
  const profileContractFacts = useProfileContractFacts(profileAddress, { enabled: Boolean(identityDossierOpening || identityDossierSession) });
  const libraryInventoryRequested = modul8rActive
    ? modul8rPresentationState.open && modul8rPresentationState.openModule === 'library'
    : browserActivated;
  const { commands: browserCategoryCommands, data: browserData } = useOwnerLatticeBrowser(
    profileAddress, libraryInventoryRequested);
  const authoring = useOwnerLatticeAuthoring(profileAddress, {
    supplementalAssetRecords: modul8rActive ? modul8rRelatedAssetRecords : [],
  });
  const profile = useMemo(
    () => getIdentityProfileViewModel(profileIdentity, { walletConnected: visitorWalletConnected }),
    [profileIdentity, visitorWalletConnected],
  );
  const officialIdentity = useMemo(() => ({
    avatarUrl: profile.avatarUrl || null,
    displayName: profile.name || 'UNRESOLVED PROFILE',
    secondaryLabel: profile.displayAddress || 'UNIVERSAL PROFILE',
  }), [profile]);
  const latticeProjection = useMemo(() => {
    if (!authoring.draft) return { lattice: null, error: null, unresolvedPlacements: [] };
    try {
      const previewDraft = compositionPreview?.kind === 'move'
        ? createLatticeProductionMovementCandidate(authoring.draft, compositionPreview.request)
        : compositionPreview?.kind === 'group-move'
          ? createLatticeProductionGroupMovementCandidate(authoring.draft, compositionPreview.request)
          : compositionPreview?.kind === 'resize'
            ? createLatticeProductionResizeCandidate(authoring.draft, compositionPreview.request)
            : compositionPreview?.kind === 'group-resize'
              ? createLatticeProductionGroupResizeCandidate(authoring.draft, compositionPreview.request)
            : compositionPreview?.kind === 'crop'
              ? createLatticeProductionCropCandidate(authoring.draft, compositionPreview.request)
              : compositionPreview?.kind === 'presentation'
                ? createLatticeProductionPresentationCandidate(authoring.draft, compositionPreview.request)
              : null;
      const renderDraft = structuredClone(previewDraft || authoring.draft);
      renderDraft.appearance.surfaceId = surfaceId;
      renderDraft.appearance.menuSurfaceId = menuSurfaceId;
      const runtime = prepareOwnerLatticeRuntimeDraft(renderDraft, authoring.assetRecords);
      return {
        lattice: assertValidLatticeProductionPublication(projectLatticeProductionPublication(
          runtime.draft,
          authoring.assetRecords,
          { lastPublished: RUNTIME_PROJECTION_TIMESTAMP },
        )),
        error: null,
        unresolvedPlacements: runtime.unresolvedPlacements,
      };
    } catch (error) {
      return { lattice: null, error: error?.message || 'Canonical assets are unresolved', unresolvedPlacements: [] };
    }
  }, [authoring.assetRecords, authoring.draft, compositionPreview, menuSurfaceId, surfaceId]);
  const lattice = latticeProjection.lattice;
  const unresolvedPlacementsByTable = useMemo(() => {
    const grouped = new Map();
    for (const placement of latticeProjection.unresolvedPlacements || []) {
      grouped.set(placement.tableId, [...(grouped.get(placement.tableId) || []), placement]);
    }
    return grouped;
  }, [latticeProjection.unresolvedPlacements]);
  const assetRecordsById = useMemo(() => {
    const records = authoring.assetRecords instanceof Map
      ? [...authoring.assetRecords.values()]
      : Array.isArray(authoring.assetRecords) ? authoring.assetRecords : [];
    return new Map(records.map((asset) => [asset.id, asset]));
  }, [authoring.assetRecords]);
  const publicationAssetRecords = useMemo(() => [...assetRecordsById.values()], [assetRecordsById]);
  const canvasPlacementAssets = useMemo(() => browserData.assets.filter(({ placeable }) => placeable), [browserData.assets]);
  const publicationProfile = useMemo(() => profileIdentity?.status === 'RESOLVED'
    ? { name: profileIdentity.name, avatarUrl: profileIdentity.avatarUrl }
    : {}, [profileIdentity?.avatarUrl, profileIdentity?.name, profileIdentity?.status]);
  const identityDossier = useMemo(() => createProductionIdentityDossierViewModel({
    identity: profileIdentity,
    contractFacts: profileContractFacts,
    identityPresentation: authoring.draft?.identityPresentation,
    assetRecords: assetRecordsById,
    publishedResolution,
  }), [assetRecordsById, authoring.draft?.identityPresentation, profileContractFacts, profileIdentity, publishedResolution]);

  useEffect(() => {
    setSpatialRoot(document.querySelector('.application-root'));
  }, []);

  useEffect(() => {
    const scheduler = createKeeperPointerFollowScheduler((clientX, clientY) => {
      residentHandoff?.moveToScreenPosition?.(clientX, clientY, {
        continuous: true,
        reducedMotion: revealPresentation.reducedMotion === true,
        speedMultiplier: keeperPointerFollowSpeedMultiplier(keeperMovementSpeed),
      });
    });
    keeperPointerFollowRef.current = scheduler;
    return () => {
      scheduler.cancel();
      if (keeperPointerFollowRef.current === scheduler) keeperPointerFollowRef.current = null;
    };
  }, [keeperMovementSpeed, residentHandoff, revealPresentation.reducedMotion]);

  useEffect(() => {
    identityOpenRequestRef.current += 1;
    setIdentityDossierOpening(false);
    setIdentityDossierSession(null);
  }, [profileAddress]);

  useEffect(() => {
    const resize = () => setDimensions({
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
    });
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(snapTimerRef.current);
    window.clearTimeout(wheelResetTimerRef.current);
  }, []);

  useEffect(() => {
    const releaseSpace = (event) => {
      if (event?.code && event.code !== 'Space') return;
      spacePressedRef.current = false;
      setSpacePanReady(false);
    };
    window.addEventListener('keyup', releaseSpace);
    window.addEventListener('blur', releaseSpace);
    return () => {
      window.removeEventListener('keyup', releaseSpace);
      window.removeEventListener('blur', releaseSpace);
    };
  }, []);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const reducedMotion = revealPresentation.reducedMotion === true;
  const plane = createWidthFitLatticeOwnerViewport(dimensions);
  const cellSize = plane.cellSize;
  const activeTableId = latticeProductionTableId(active);
  useEffect(() => setSelectedPlacementIds([]), [activeTableId, profileAddress]);
  const activeCameraY = clampLatticeOwnerCameraY(cameraOffsets[activeTableId] || 0, plane);
  const keeperPointerFollowEnabled = keeperPointerFollowAllowed({
    arrangeEnabled,
    browserOpen,
    cameraGestureActive,
    compositionPreview,
    cropModeActive,
    gestureActive,
    identityActive: Boolean(identityDossierOpening || identityDossierSession),
    interfaceVisible,
    keeperDockActive,
    followCursor: keeperFollowCursor,
    settling: snapping,
    themeOpen: themeOpen || publicationOpen,
    viewerActive: Boolean(viewerSession),
  });
  const keeperClickToMoveEnabled = keeperClickToMoveAllowed({
    arrangeEnabled,
    browserOpen,
    cameraGestureActive,
    compositionPreview,
    cropModeActive,
    followCursor: keeperFollowCursor,
    identityActive: Boolean(identityDossierOpening || identityDossierSession),
    interfaceVisible,
    keeperDockActive,
    settling: snapping,
    themeOpen: themeOpen || publicationOpen,
    viewerActive: Boolean(viewerSession),
  });

  useEffect(() => {
    if (keeperPointerFollowEnabled) return;
    keeperPointerTargetRef.current = null;
    keeperPointerFollowRef.current?.cancel();
  }, [keeperPointerFollowEnabled]);

  useEffect(() => {
    if (!keeperPointerFollowEnabled || !keeperPointerTargetRef.current) return;
    keeperPointerFollowRef.current?.push(keeperPointerTargetRef.current);
  }, [dimensions.height, dimensions.width, keeperPointerFollowEnabled]);

  const settle = useCallback((destination, offset = { x: 0, y: 0 }) => {
    if (settlingRef.current) return;
    setCompositionPreview(null);
    settlingRef.current = true;
    setDragOffset(offset);
    requestAnimationFrame(() => {
      activeRef.current = destination;
      setActive(destination);
      setSnapping(true);
      setDragOffset({ x: 0, y: 0 });
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = window.setTimeout(() => {
        settlingRef.current = false;
        setSnapping(false);
      }, reducedMotion ? 0 : DEFAULT_LATTICE_INTERACTION_CONFIG.snapDuration);
    });
  }, [reducedMotion]);

  const finishGesture = useCallback((cancelled = false) => {
    const activeGesture = gestureRef.current;
    if (!activeGesture || settlingRef.current) return;
    gestureRef.current = null;
    setGestureActive(false);
    if (!activeGesture.gesture.activated) {
      setDragOffset({ x: 0, y: 0 });
      return;
    }
    const destination = cancelled
      ? { ...activeRef.current }
      : finishPointerGesture(activeGesture.gesture, activeRef.current);
    settle(destination, activeGesture.gesture.offset);
  }, [settle]);

  const setTableCameraY = useCallback((tableId, cameraY) => {
    cameraOffsetsRef.current = { ...cameraOffsetsRef.current, [tableId]: cameraY };
    setCameraOffsets(cameraOffsetsRef.current);
  }, []);

  const finishCameraGesture = useCallback((cancelled = false) => {
    const activeCameraGesture = cameraGestureRef.current;
    if (!activeCameraGesture) return false;
    cameraGestureRef.current = null;
    if (cancelled) setTableCameraY(activeCameraGesture.tableId, activeCameraGesture.startCameraY);
    setCameraGestureActive(false);
    return true;
  }, [setTableCameraY]);

  const handlePointerDownCapture = (event) => {
    if (!spacePressedRef.current || plane.maximumCameraY <= 0 || settlingRef.current || event.button !== 0
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest?.('[data-lattice-placement-action]')) return;
    const placementControl = event.target.closest?.('[data-lattice-placement-control]');
    const excludedControl = event.target.closest?.('[data-lattice-chrome],a,input,select,textarea,button');
    if (excludedControl && excludedControl !== placementControl) return;
    event.preventDefault();
    event.stopPropagation();
    cameraGestureRef.current = {
      pointerId: event.pointerId,
      tableId: activeTableId,
      originY: event.clientY,
      startCameraY: activeCameraY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCameraGestureActive(true);
    viewportRef.current?.focus({ preventScroll: true });
  };

  const handlePointerDown = (event) => {
    if (cropModeActive || spacePressedRef.current || settlingRef.current || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || !keeperClickToMoveTargetAllowed(event.target)) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      gesture: createPointerGesture({ x: event.clientX, y: event.clientY }),
    };
    viewportRef.current?.focus({ preventScroll: true });
  };

  const handlePointerMove = (event) => {
    const activeCameraGesture = cameraGestureRef.current;
    if (activeCameraGesture?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      setTableCameraY(activeCameraGesture.tableId, updateLatticeOwnerCameraY({
        originY: activeCameraGesture.originY,
        pointerY: event.clientY,
        startCameraY: activeCameraGesture.startCameraY,
      }, plane));
      return;
    }
    const activeGesture = gestureRef.current;
    if (!activeGesture || activeGesture.pointerId !== event.pointerId || settlingRef.current) {
      const target = keeperPointerTarget(event, event.currentTarget.getBoundingClientRect());
      if (!target) return;
      keeperPointerTargetRef.current = target;
      if (!keeperPointerFollowEnabled) return;
      keeperPointerFollowRef.current?.push(target);
      return;
    }
    const wasActivated = activeGesture.gesture.activated;
    const gesture = updatePointerGesture(
      activeGesture.gesture,
      { x: event.clientX, y: event.clientY },
      activeRef.current,
    );
    gestureRef.current = { ...activeGesture, gesture };
    if (gesture.activated && !wasActivated) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setGestureActive(true);
    }
    setDragOffset(gesture.offset);
  };

  const handlePointerUp = (event) => {
    if (cameraGestureRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      finishCameraGesture(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    const wasClick = !gestureRef.current.gesture.activated;
    finishGesture(false);
    if (wasClick && keeperClickToMoveEnabled && keeperClickToMoveTargetAllowed(event.target)) {
      const target = keeperPointerTarget(event, event.currentTarget.getBoundingClientRect());
      if (target) residentHandoff?.moveToScreenPosition?.(target.clientX, target.clientY, {
        continuous: false,
        reducedMotion,
        speedMultiplier: keeperPointerFollowSpeedMultiplier(keeperMovementSpeed),
      });
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (cropModeActive || settlingRef.current || gestureRef.current || performance.now() < wheelBlockedUntilRef.current) return;
    wheelAccumulatorRef.current = addWheelDelta(wheelAccumulatorRef.current, { x: event.deltaX, y: event.deltaY });
    window.clearTimeout(wheelResetTimerRef.current);
    wheelResetTimerRef.current = window.setTimeout(() => {
      wheelAccumulatorRef.current = { x: 0, y: 0 };
    }, DEFAULT_LATTICE_INTERACTION_CONFIG.wheelCooldown);
    const destination = resolveWheelDestination(wheelAccumulatorRef.current, activeRef.current);
    if (!destination) return;
    wheelAccumulatorRef.current = { x: 0, y: 0 };
    wheelBlockedUntilRef.current = performance.now() + DEFAULT_LATTICE_INTERACTION_CONFIG.wheelCooldown;
    settle(destination);
  };

  const handleKeyDown = (event) => {
    if (event.code === 'Space') {
      if (event.target.closest?.('[data-lattice-placement-action]')) return;
      const placementControl = event.target.closest?.('[data-lattice-placement-control]');
      const excludedControl = event.target.closest?.('a,input,select,textarea,button');
      if (excludedControl && excludedControl !== placementControl) return;
      event.preventDefault();
      if (!event.repeat) {
        spacePressedRef.current = true;
        setSpacePanReady(true);
      }
      return;
    }
    if (cropModeActive && keyboardDirection(event.key)) {
      event.preventDefault();
      return;
    }
    if (settlingRef.current || gestureRef.current || event.target.closest?.('input,select,textarea,button')) return;
    const direction = keyboardDirection(event.key);
    const destination = direction && latticeDestination(activeRef.current, direction);
    if (!destination) return;
    event.preventDefault();
    settle(destination);
  };

  const handleKeyUp = (event) => {
    if (event.code !== 'Space') return;
    if (event.target.closest?.('[data-lattice-placement-action]')) return;
    event.preventDefault();
    spacePressedRef.current = false;
    setSpacePanReady(false);
  };

  const navigateDirectly = useCallback((destination) => {
    if (cropModeActive || settlingRef.current || gestureRef.current || sameCoordinate(destination, activeRef.current)) return;
    settle(destination);
  }, [cropModeActive, settle]);

  const stageTransform = `translate3d(${dragOffset.x - (active.x * plane.width)}px, ${dragOffset.y - (active.y * plane.height) + activeCameraY}px, 0)`;
  const activeDraftTable = authoring.draft?.tables.find((table) => table.id === activeTableId) || null;
  const selectedPlacements = (activeDraftTable?.placements || [])
    .filter(({ id }) => selectedPlacementIds.includes(id));
  const selectedPlacement = activeDraftTable?.placements.find(({ id }) => id === selectedPlacementId) || null;
  const activeTable = lattice?.tables.find((table) => table.id === activeTableId) || activeDraftTable;
  const layerEntries = useMemo(() => {
    const publishedById = new Map((lattice?.tables.find(({ id }) => id === activeTableId)?.placements || [])
      .map((placement) => [placement.id, placement]));
    return [...(activeDraftTable?.placements || [])]
      .filter(({ visibility }) => visibility === 'PUBLIC')
      .sort((left, right) => right.layer - left.layer || left.id.localeCompare(right.id))
      .map((placement) => {
        const published = publishedById.get(placement.id);
        const media = placementMedia[`${activeTableId}:${placement.id}`];
        return {
          id: placement.id,
          layer: placement.layer,
          locked: placement.locked,
          name: published?.asset?.name || placement.stableAssetId,
          previewSrc: media?.status === 'ready' ? media.media?.src : null,
        };
      });
  }, [activeDraftTable, activeTableId, lattice, placementMedia]);
  const activeTableName = activeTable ? tableIdentity(activeTable) : activeTableId.replace('-', ' ').toUpperCase();
  const cancelBrowserAssetDrag = useCallback(() => {
    const gesture = browserDragGestureRef.current;
    if (gesture) {
      gesture.element.removeEventListener('pointermove', gesture.move);
      gesture.element.removeEventListener('pointerup', gesture.finish);
      gesture.element.removeEventListener('pointercancel', gesture.cancel);
      if (gesture.element.hasPointerCapture?.(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId);
    }
    browserDragGestureRef.current = null;
    setBrowserAssetDrag(null);
  }, []);
  const beginBrowserAssetDrag = useCallback((event, asset, workspace, { placementPreset = 'default' } = {}) => {
    const id = asset?.stableAssetId || asset?.id;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || !arrangeEnabled
      || !asset?.placeable || workspace.selectedAssetIds.length > 1) return;
    const element = event.currentTarget; const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    const update = (pointerEvent) => {
      const distance = Math.hypot(pointerEvent.clientX - start.x, pointerEvent.clientY - start.y);
      const gesture = browserDragGestureRef.current;
      if (!gesture || (!gesture.started && distance < 6)) return;
      gesture.started = true;
      const target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const tableElement = tableElementsRef.current.get(activeTableId);
      const rectangle = tableElement?.getBoundingClientRect();
      let destination = null;
      const overChrome = target?.closest?.('[data-lattice-chrome]');
      const inside = rectangle && pointerEvent.clientX >= rectangle.left && pointerEvent.clientX <= rectangle.right
        && pointerEvent.clientY >= rectangle.top && pointerEvent.clientY <= rectangle.bottom;
      if (!overChrome && inside && activeDraftTable?.visibility === 'PUBLIC') {
        try {
          destination = createLatticeProductionDropGeometry(asset.width, asset.height,
            { x: pointerEvent.clientX, y: pointerEvent.clientY }, rectangle, { placementPreset });
        } catch { destination = null; }
      }
      setBrowserAssetDrag({ asset, destination, point: { x: pointerEvent.clientX, y: pointerEvent.clientY }, tableId: destination ? activeTableId : null });
    };
    const cleanup = () => {
      element.removeEventListener('pointermove', update);
      element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', cancel);
      if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
      browserDragGestureRef.current = null;
    };
    const finish = (pointerEvent) => {
      const gesture = browserDragGestureRef.current; update(pointerEvent);
      const target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const tableElement = tableElementsRef.current.get(activeTableId); const rectangle = tableElement?.getBoundingClientRect();
      let destination = null;
      const inside = rectangle && pointerEvent.clientX >= rectangle.left && pointerEvent.clientX <= rectangle.right
        && pointerEvent.clientY >= rectangle.top && pointerEvent.clientY <= rectangle.bottom;
      if (gesture?.started && !target?.closest?.('[data-lattice-chrome]') && inside
        && (browserOpen || modul8rActive) && arrangeEnabled && activeDraftTable?.visibility === 'PUBLIC'
        && workspace.isAssetRenderable(id)) {
        try { destination = createLatticeProductionDropGeometry(asset.width, asset.height,
          { x: pointerEvent.clientX, y: pointerEvent.clientY }, rectangle, { placementPreset }); } catch { destination = null; }
      }
      cleanup(); setBrowserAssetDrag(null);
      if (destination) authoring.placePublicAsset({ destination, stableAssetId: id, tableId: activeTableId });
    };
    const cancel = () => { cleanup(); setBrowserAssetDrag(null); };
    browserDragGestureRef.current = { assetId: id, cancel, element, finish, move: update, pointerId, started: false };
    element.setPointerCapture?.(pointerId);
    element.addEventListener('pointermove', update);
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', cancel);
  }, [activeDraftTable?.visibility, activeTableId, arrangeEnabled, authoring.placePublicAsset, browserOpen, modul8rActive]);

  useEffect(() => {
    if ((!browserOpen && !modul8rActive) || !arrangeEnabled) cancelBrowserAssetDrag();
  }, [arrangeEnabled, browserOpen, cancelBrowserAssetDrag, modul8rActive, profileAddress]);
  useEffect(() => {
    if (!browserAssetDrag) return undefined;
    const cancelOnEscape = (event) => { if (event.key === 'Escape') cancelBrowserAssetDrag(); };
    window.addEventListener('keydown', cancelOnEscape, true);
    return () => window.removeEventListener('keydown', cancelOnEscape, true);
  }, [browserAssetDrag, cancelBrowserAssetDrag]);
  const authoringPlacementUnavailableReason = ownerLatticePlacementUnavailableReason({
    activeTable: activeDraftTable,
    authoringStatus: authoring.status,
    profileReady: authoring.profileReady,
  });
  const placementUnavailableReason = arrangeEnabled ? authoringPlacementUnavailableReason : 'PLACE REQUIRES ARRANGE';
  const closeCanvasPlacementFlow = useCallback(() => {
    setCanvasPlacementFlow(null);
    queueMicrotask(() => viewportRef.current?.focus({ preventScroll: true }));
  }, []);
  const openCanvasPlacementMenu = useCallback((event) => {
    if (!arrangeEnabled || cropModeActive || settlingRef.current || gestureRef.current
      || activeDraftTable?.visibility !== 'PUBLIC'
      || event.target.closest?.('[data-lattice-chrome],[data-lattice-placement-control]')) return;
    const tableElement = tableElementsRef.current.get(activeTableId);
    const rectangle = tableElement?.getBoundingClientRect();
    if (!rectangle || event.clientX < rectangle.left || event.clientX > rectangle.right
      || event.clientY < rectangle.top || event.clientY > rectangle.bottom) return;
    event.preventDefault();
    event.stopPropagation();
    setCanvasPlacementFlow({
      anchor: { x: event.clientX, y: event.clientY },
      normalizedPoint: {
        x: (event.clientX - rectangle.left) / rectangle.width,
        y: (event.clientY - rectangle.top) / rectangle.height,
      },
      view: 'menu',
    });
  }, [activeDraftTable?.visibility, activeTableId, arrangeEnabled, cropModeActive]);
  const placeCanvasArtwork = useCallback((chosen) => {
    const flow = canvasPlacementFlow;
    const asset = browserData.assets.find(({ stableAssetId }) => stableAssetId === chosen?.stableAssetId);
    const tableElement = tableElementsRef.current.get(activeTableId);
    const rectangle = tableElement?.getBoundingClientRect();
    let destination = null;
    if (flow?.normalizedPoint && asset?.placeable && rectangle && activeDraftTable?.visibility === 'PUBLIC') {
      try {
        destination = createLatticeProductionDropGeometry(asset.width, asset.height, {
          x: rectangle.left + (flow.normalizedPoint.x * rectangle.width),
          y: rectangle.top + (flow.normalizedPoint.y * rectangle.height),
        }, rectangle);
      } catch { destination = null; }
    }
    setCanvasPlacementFlow(null);
    if (destination) authoring.placePublicAsset({ destination, stableAssetId: asset.stableAssetId, tableId: activeTableId });
    queueMicrotask(() => viewportRef.current?.focus({ preventScroll: true }));
  }, [activeDraftTable?.visibility, activeTableId, authoring.placePublicAsset, browserData.assets, canvasPlacementFlow]);
  useEffect(() => {
    if (!arrangeEnabled) setCanvasPlacementFlow(null);
  }, [arrangeEnabled, profileAddress]);
  const canonicalNotice = authoring.status === OWNER_LATTICE_AUTHORING_STATUS.CORRUPT
    ? 'CANONICAL DRAFT UNAVAILABLE / STORED RECORD PRESERVED / EXPLICIT RECOVERY REQUIRED'
    : previewError || authoring.error || latticeProjection.error;
  const spatialTheme = ['carbon', 'graphite'].includes(surfaceId) ? 'dark' : 'light';

  useEffect(() => {
    residentHandoff?.trackActorPosition?.(spatialRoot ? [spatialRoot] : null);
    return () => residentHandoff?.trackActorPosition?.(null);
  }, [residentHandoff, spatialRoot]);
  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
    const returnFocus = browserReturnFocusRef.current || browserToolRef.current;
    queueMicrotask(() => returnFocus?.isConnected && returnFocus.focus({ preventScroll: true }));
  }, []);
  const requestModul8r = useCallback((moduleId, trigger = null, options = {}) => {
    modul8rReturnFocusRef.current = trigger || modul8rReturnFocusRef.current || browserToolRef.current;
    if (options.toggle && modul8rPresentationState.open && modul8rPresentationState.openModule === moduleId) {
      setModul8rCloseRequestId((current) => current + 1);
      return;
    }
    setBrowserOpen(false);
    setActivityOpen(false);
    setCreationsOpen(false);
    setDiscoveryOpen(false);
    setThemeOpen(false);
    setThemeAnchor(null);
    setSettingsOpen(false);
    setMoreOpen(false);
    setModul8rOpenRequestId((current) => current + 1);
    setModul8rModuleRequest((current) => ({
      moduleId,
      requestId: (current?.requestId || 0) + 1,
      settings: options.settings === true,
      trigger,
    }));
  }, [modul8rPresentationState.open, modul8rPresentationState.openModule]);
  const openCategories = useCallback((trigger) => {
    if (modul8rActive) {
      requestModul8r('library', trigger);
      return;
    }
    browserReturnFocusRef.current = trigger || null;
    activeWorkspaceWindowRef.current = 'browser';
    setActivityOpen(false);
    setCreationsOpen(false);
    setDiscoveryOpen(false);
    setBrowserActivated(true);
    setBrowserTabRequest((current) => ({ id: 'categories', requestId: (current?.requestId || 0) + 1 }));
    setBrowserOpen(true);
  }, [modul8rActive, requestModul8r]);
  const setActivityWindowOpen = useCallback((open, trigger = null) => {
    if (open && modul8rActive) {
      requestModul8r('activity', trigger);
      return;
    }
    if (open) {
      activityTriggerRef.current = trigger || activityTriggerRef.current;
      activeWorkspaceWindowRef.current = 'activity';
      setBrowserOpen(false);
      setCreationsOpen(false);
      setDiscoveryOpen(false);
      setThemeOpen(false);
      setThemeAnchor(null);
      setPublicationOpen(false);
    }
    setActivityOpen(open);
    if (!open) requestAnimationFrame(() => activityTriggerRef.current?.isConnected
      && activityTriggerRef.current.focus({ preventScroll: true }));
  }, [modul8rActive, requestModul8r]);
  const setCreationsWindowOpen = useCallback((open, trigger = null) => {
    if (open && modul8rActive) {
      requestModul8r('library', trigger);
      return;
    }
    if (open) {
      creationsTriggerRef.current = trigger || creationsTriggerRef.current;
      activeWorkspaceWindowRef.current = 'creations';
      setActivityOpen(false);
      setBrowserOpen(false);
      setDiscoveryOpen(false);
      setThemeOpen(false);
      setThemeAnchor(null);
      setPublicationOpen(false);
    }
    setCreationsOpen(open);
    if (!open) requestAnimationFrame(() => creationsTriggerRef.current?.isConnected
      && creationsTriggerRef.current.focus({ preventScroll: true }));
  }, [modul8rActive, requestModul8r]);
  const openDiscovery = useCallback((trigger) => {
    if (modul8rActive) {
      requestModul8r('people', trigger);
      return;
    }
    discoveryTriggerRef.current = trigger || null;
    activeWorkspaceWindowRef.current = 'discover';
    setBrowserOpen(false);
    setActivityOpen(false);
    setCreationsOpen(false);
    setThemeOpen(false);
    setThemeAnchor(null);
    setPublicationOpen(false);
    setDiscoveryOpen(true);
  }, [modul8rActive, requestModul8r]);
  const closeDiscovery = useCallback(() => {
    setDiscoveryOpen(false);
    requestAnimationFrame(() => discoveryTriggerRef.current?.isConnected
      && discoveryTriggerRef.current.focus({ preventScroll: true }));
  }, []);
  const openIdentityDossier = useCallback(async () => {
    if (viewerSession || gestureRef.current || cameraGestureRef.current || cropModeActive || compositionPreview) return;
    const source = identityControlRef.current;
    if (!source || !identityDossier) return;
    const requestId = identityOpenRequestRef.current + 1;
    identityOpenRequestRef.current = requestId;
    const originRectangle = frozenRectangle(source.getBoundingClientRect());
    const viewport = Object.freeze({ width: window.innerWidth, height: window.innerHeight });
    setBrowserOpen(false);
    if (modul8rActive) setModul8rCloseRequestId((current) => current + 1);
    setThemeOpen(false);
    setIdentityDossierOpening(true);
    const profileImageUrl = await preloadIdentityProfileImage(identityDossier.profile.avatarUrl);
    if (identityOpenRequestRef.current !== requestId || !source.isConnected) return;
    setIdentityDossierSession({
      originRectangle,
      preloadedProfileImageUrl: profileImageUrl,
      viewport,
    });
    setIdentityDossierOpening(false);
  }, [compositionPreview, cropModeActive, identityDossier, modul8rActive, viewerSession]);
  const closeIdentityDossier = useCallback(() => {
    setIdentityDossierSession(null);
    requestAnimationFrame(() => identityControlRef.current?.focus({ preventScroll: true }));
  }, []);
  const toggleArrange = useCallback(() => {
    if (arrangeEnabled) {
      setCompositionPreview(null);
      setSelectedPlacementId(null);
    }
    setArrangeEnabled(!arrangeEnabled);
  }, [arrangeEnabled]);
  const selectPlacement = useCallback((placementId, options = {}) => {
    if (!options.range) {
      setSelectedPlacementId(placementId, options);
      return;
    }
    const anchorIndex = layerEntries.findIndex(({ id }) => id === selectedPlacementId);
    const targetIndex = layerEntries.findIndex(({ id }) => id === placementId);
    if (anchorIndex < 0 || targetIndex < 0) {
      setSelectedPlacementId(placementId);
      return;
    }
    const [start, end] = [anchorIndex, targetIndex].sort((left, right) => left - right);
    const rangeIds = layerEntries.slice(start, end + 1).map(({ id }) => id);
    setSelectedPlacementIds((current) => [...new Set([...current, ...rangeIds])]);
  }, [layerEntries, selectedPlacementId, setSelectedPlacementId]);
  const reorderLayers = useCallback((frontToBackIds) => {
    if (!arrangeEnabled || !activeDraftTable || !Array.isArray(frontToBackIds)) return false;
    return authoring.reorderPublicPlacements({
      expectedPlacements: activeDraftTable.placements.map((placement) => structuredClone(placement)),
      orderedPlacementIds: [...frontToBackIds].reverse(),
      tableId: activeTableId,
    });
  }, [activeDraftTable, activeTableId, arrangeEnabled, authoring]);
  const startOwnerPreview = useCallback(async (trigger) => {
    previewReturnFocusRef.current = trigger || previewToolRef.current;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    try {
      if (!authoring.draft || authoring.status !== OWNER_LATTICE_AUTHORING_STATUS.READY) {
        throw new TypeError('CANONICAL DRAFT UNAVAILABLE');
      }
      if (!authoring.profileReady || authoring.missingReferencedAssets) {
        throw new TypeError('PREVIEW REQUIRES ALL REFERENCED PUBLIC ASSETS');
      }
      const { buildOwnerLatticePreviewDocument, preloadOwnerLatticePreviewEntryMedia } = await import('./ownerLatticePreviewDocument.js');
      const preview = buildOwnerLatticePreviewDocument({
        activeActorId, assetRecords: authoring.assetRecords, latticeDraft: authoring.draft,
        profile: publicationProfile, profileAddress, stageId,
      });
      await preloadOwnerLatticePreviewEntryMedia(preview);
      if (previewRequestRef.current !== requestId) return;
      finishGesture(true);
      finishCameraGesture(true);
      cancelBrowserAssetDrag();
      setCompositionPreview(null);
      setCropModeActive(false);
      setArrangeEnabled(false);
      setBrowserOpen(false);
      if (modul8rActive) setModul8rCloseRequestId((current) => current + 1);
      setThemeOpen(false);
      setThemeAnchor(null);
      setIdentityDossierSession(null);
      setViewerSession(null);
      setPreviewError(null);
      setPreviewDocument(preview);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
    }
  }, [activeActorId, authoring, cancelBrowserAssetDrag, finishCameraGesture, finishGesture, modul8rActive,
    profileAddress, publicationProfile, stageId]);
  const stopOwnerPreview = useCallback(() => {
    previewRequestRef.current += 1;
    setPreviewDocument(null);
    requestAnimationFrame(() => {
      const returnFocus = previewReturnFocusRef.current?.isConnected
        ? previewReturnFocusRef.current
        : previewToolRef.current;
      returnFocus?.focus({ preventScroll: true });
    });
  }, []);
  const activateWorkspaceTool = useCallback((toolId, trigger) => {
    if (toolId === 'arrange') toggleArrange();
    if (['rotate', 'mirrorHorizontal', 'mirrorVertical'].includes(toolId) && arrangeEnabled && selectedPlacement) {
      const operation = toolId === 'rotate' ? LATTICE_PRODUCTION_TRANSFORM_OPERATIONS.ROTATE
        : toolId === 'mirrorHorizontal' ? LATTICE_PRODUCTION_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL
          : LATTICE_PRODUCTION_TRANSFORM_OPERATIONS.MIRROR_VERTICAL;
      if (selectedPlacements.length > 1) authoring.transformPublicPlacements({
        expectedPlacements: selectedPlacements.map((placement) => structuredClone(placement)), operation,
        placementIds: selectedPlacements.map(({ id }) => id), tableId: activeTableId,
      });
      else authoring.transformPublicPlacement({
        expectedPlacement: structuredClone(selectedPlacement), operation,
        placementId: selectedPlacement.id, tableId: activeTableId,
      });
    }
    if (toolId === 'duplicate' && arrangeEnabled && selectedPlacement) {
      if (selectedPlacements.length > 1) {
        const duplicateIds = authoring.duplicatePublicPlacements({
          expectedPlacements: selectedPlacements.map((placement) => structuredClone(placement)),
          placementIds: selectedPlacements.map(({ id }) => id),
          tableId: activeTableId,
        });
        if (duplicateIds.length) setSelectedPlacementIds(duplicateIds);
      } else {
        const duplicateId = authoring.duplicatePublicPlacement({
          expectedPlacement: structuredClone(selectedPlacement),
          placementId: selectedPlacement.id, tableId: activeTableId,
        });
        if (duplicateId) setSelectedPlacementId(duplicateId);
      }
    }
    if (toolId === 'browser') {
      if (modul8rActive) {
        requestModul8r('library', trigger, { toggle: true });
        return;
      }
      browserReturnFocusRef.current = trigger || browserToolRef.current;
      activeWorkspaceWindowRef.current = 'browser';
      setActivityOpen(false);
      setCreationsOpen(false);
      setDiscoveryOpen(false);
      setBrowserActivated(true);
      setBrowserOpen((open) => !open);
    }
    if (toolId === 'theme') {
      if (modul8rActive) {
        requestModul8r(modul8rPresentationState.openModule || 'library', trigger, { settings: true });
        return;
      }
      activeWorkspaceWindowRef.current = 'theme';
      if (trigger) setThemeAnchor(frozenRectangle(trigger.getBoundingClientRect()));
      setThemeOpen((open) => !open);
    }
    if (toolId === 'more') {
      if (modul8rActive) {
        requestModul8r(modul8rPresentationState.openModule || 'library', trigger, { settings: true });
        return;
      }
      activeWorkspaceWindowRef.current = 'more';
      setMoreOpen((open) => !open);
    }
    if (toolId === 'settings') {
      if (modul8rActive) {
        requestModul8r(modul8rPresentationState.openModule || 'library', trigger, { settings: true });
        return;
      }
      activeWorkspaceWindowRef.current = 'settings';
      setMoreOpen(false);
      setSettingsOpen(true);
    }
    if (toolId === 'preview') startOwnerPreview(trigger);
    if (toolId === 'publish') {
      activeWorkspaceWindowRef.current = 'publish';
      setPublicationOpen((open) => !open);
    }
  }, [activeTableId, arrangeEnabled, authoring, modul8rActive, modul8rPresentationState.openModule,
    requestModul8r, selectedPlacement, selectedPlacements, startOwnerPreview, toggleArrange]);
  const handlePlacementMediaState = useCallback((state) => {
    const key = `${state.tableId}:${state.placementId}`;
    setPlacementMedia((current) => {
      const previous = current[key];
      if (previous?.status === state.status && previous?.media?.src === state.media?.src
        && previous?.dimensions?.width === state.dimensions?.width
        && previous?.dimensions?.height === state.dimensions?.height) return current;
      return { ...current, [key]: state };
    });
  }, []);
  const openPlacementViewer = useCallback(async ({ element, placement, tableId }) => {
    if (arrangeEnabled || tableId !== activeTableId) return;
    const mediaState = placementMedia[`${tableId}:${placement.id}`];
    if (mediaState?.status !== 'ready' || !mediaState.dimensions) return;
    const originRectangle = element.getBoundingClientRect();
    const nativeImage = new Image();
    nativeImage.decoding = 'async';
    nativeImage.referrerPolicy = 'no-referrer';
    nativeImage.src = mediaState.media.src;
    try { await nativeImage.decode(); } catch { /* The viewer retains its honest media-failure state. */ }
    if (!element.isConnected) return;
    setIdentityDossierSession(null);
    setViewerSession({
      originRectangle,
      placementId: placement.id,
      returnFocus: element,
      tableId,
    });
  }, [activeTableId, arrangeEnabled, placementMedia]);

  const viewerTable = viewerSession ? lattice?.tables.find(({ id }) => id === viewerSession.tableId) : null;
  const viewerEntries = useMemo(() => (viewerTable?.placements || []).map((placement) => {
    const decoded = placementMedia[`${viewerTable.id}:${placement.id}`];
    const assetRecord = assetRecordsById.get(placement.asset.stableAssetId);
    const model = createLatticeProductionFocusViewModel(placement, decoded?.dimensions && assetRecord
      ? { ...assetRecord, imageWidth: decoded.dimensions.width, imageHeight: decoded.dimensions.height }
      : assetRecord);
    return model && decoded?.status === 'ready' && decoded.dimensions
      ? { ...model, focusDimensions: decoded.dimensions, media: { ...model.media, src: decoded.media.src } } : null;
  }).filter(Boolean), [assetRecordsById, placementMedia, viewerTable]);
  const viewerPosition = viewerEntries.findIndex(({ placement }) => placement.id === viewerSession?.placementId);
  const viewerEntry = viewerPosition >= 0 ? viewerEntries[viewerPosition] : null;
  const findPlacementElement = useCallback((placementId) => [...(viewportRef.current
    ?.querySelectorAll('.owner-lattice-table[data-active] [data-placement-id]') || [])]
    .find((node) => node.dataset.placementId === placementId), []);
  const navigateViewer = useCallback((direction) => {
    if (!viewerEntries.length || viewerPosition < 0) return;
    const destination = viewerEntries[(viewerPosition + direction + viewerEntries.length) % viewerEntries.length];
    const element = findPlacementElement(destination.placement.id);
    setViewerSession((current) => current && ({ ...current, placementId: destination.placement.id,
      returnFocus: element || current.returnFocus }));
  }, [findPlacementElement, viewerEntries, viewerPosition]);

  if (previewDocument) return <Suspense fallback={null}>
    <ProfileDocumentPreview document={previewDocument} onExit={stopOwnerPreview} />
  </Suspense>;

  const spatialSurface = <section
    aria-label="Owner lattice navigation"
    aria-hidden={!interfaceVisible || undefined}
    className="owner-lattice-spatial-surface"
    data-camera-active={cameraGestureActive || undefined}
    data-gesture-active={gestureActive || undefined}
    data-interface-visible={interfaceVisible || undefined}
    data-grid-style={gridStyle}
    data-space-pan-ready={(spacePanReady && plane.maximumCameraY > 0) || undefined}
    data-surface={surfaceId}
    onContextMenu={openCanvasPlacementMenu}
    onKeyDown={handleKeyDown}
    onKeyUp={handleKeyUp}
    onLostPointerCapture={() => { if (!finishCameraGesture(true)) finishGesture(true); }}
    onPointerCancel={() => { if (!finishCameraGesture(true)) finishGesture(true); }}
    onPointerDown={handlePointerDown}
    onPointerDownCapture={handlePointerDownCapture}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onWheel={handleWheel}
    ref={viewportRef}
    tabIndex={interfaceVisible ? 0 : -1}
  >
    <div
      className="owner-lattice-stage"
      data-snapping={snapping || undefined}
      style={{
        '--owner-lattice-cell-size': `${cellSize}px`,
        '--owner-lattice-grid-origin-x': `${(3 * plane.width) + plane.left}px`,
        '--owner-lattice-grid-origin-y': `${(3 * plane.height) + plane.top}px`,
        '--owner-lattice-snap-duration': `${reducedMotion ? 0 : DEFAULT_LATTICE_INTERACTION_CONFIG.snapDuration}ms`,
        transform: stageTransform,
      }}
    >
      <div className="owner-lattice-atmosphere" style={{
        left: -3 * plane.width,
        top: -3 * plane.height,
        width: 7 * plane.width,
        height: 7 * plane.height,
      }} />
      {LATTICE_PRODUCTION_COORDINATES.map((coordinate, index) => {
        const table = lattice?.tables[index] || authoring.draft?.tables[index] || {
          id: latticeProductionTableId(coordinate),
        };
        return <div
          className="owner-lattice-table"
          data-active={sameCoordinate(coordinate, active) || undefined}
          key={table.id}
          ref={(node) => { if (node) tableElementsRef.current.set(table.id, node); else tableElementsRef.current.delete(table.id); }}
          style={{
            left: plane.left + (coordinate.x * plane.width),
            top: plane.top + (coordinate.y * plane.height),
            width: plane.width,
            height: plane.height,
          }}
        >{lattice
          ? <><LatticeProductionTableRenderer
              imageLoading={sameCoordinate(coordinate, active) ? 'eager' : 'lazy'}
              lattice={lattice}
              onMediaState={handlePlacementMediaState}
              onPlacementActivate={!arrangeEnabled && sameCoordinate(coordinate, active) ? openPlacementViewer : undefined}
              tableId={table.id}
              viewerPlacementId={viewerSession?.tableId === table.id ? viewerSession.placementId : null}
            />
            {arrangeEnabled && sameCoordinate(coordinate, active) && activeDraftTable?.id === table.id && <LatticeProductionMovementLayer
              acceptedTable={activeDraftTable}
              lattice={lattice}
              onCommitCrop={authoring.cropPublicPlacement}
              onCommitLayer={authoring.layerPublicPlacement}
              onCommitMove={authoring.movePublicPlacement}
              onCommitMoveGroup={authoring.movePublicPlacements}
              onCommitPresentation={authoring.presentPublicPlacement}
              onCommitRemove={authoring.removePublicPlacement}
              onCommitRemoveGroup={authoring.removePublicPlacements}
              onCommitResize={authoring.resizePublicPlacement}
              onCommitResizeGroup={authoring.resizePublicPlacements}
              onCropModeChange={setCropModeActive}
              onPreviewOperation={setCompositionPreview}
              onReturnFocus={() => viewportRef.current?.focus({ preventScroll: true })}
              onSelectedPlacementChange={selectPlacement}
              onSelectedPlacementsChange={(placementIds) => setSelectedPlacementIds([...new Set(placementIds)])}
              selectedPlacementId={selectedPlacementId}
              selectedPlacementIds={selectedPlacementIds}
              tableId={table.id}
            />}
            <UnresolvedRuntimePlacements placements={unresolvedPlacementsByTable.get(table.id) || []} />
            {browserAssetDrag?.destination && browserAssetDrag.tableId === table.id && <div
              aria-hidden="true" className="owner-lattice-browser-drop-preview" style={{
                left: `${browserAssetDrag.destination.column / 32 * 100}%`,
                top: `${browserAssetDrag.destination.row / 18 * 100}%`,
                width: `${browserAssetDrag.destination.columnSpan / 32 * 100}%`,
                height: `${browserAssetDrag.destination.rowSpan / 18 * 100}%`,
              }} />}</>
          : <div className="owner-lattice-canonical-unavailable" role="status">CANONICAL TABLE UNAVAILABLE</div>}</div>;
      })}
    </div>
    <LatticeNavigationOverlay
      active={active}
      onNavigate={navigateDirectly}
      onReturnFocus={() => viewportRef.current?.focus({ preventScroll: true })}
    />
  </section>;

  return <main
    className="owner-lattice-shell"
    data-menu-surface={menuSurfaceId}
    data-surface={surfaceId}
  >
    {browserAssetDrag && createPortal(<div aria-hidden="true" className="owner-lattice-browser-drag-ghost"
      data-valid={browserAssetDrag.destination ? true : undefined}
      style={{ left: browserAssetDrag.point.x, top: browserAssetDrag.point.y }}>
      {browserAssetDrag.asset.previewSrc || browserAssetDrag.asset.src
        ? <img alt="" src={browserAssetDrag.asset.previewSrc || browserAssetDrag.asset.src} /> : <span>MEDIA</span>}
    </div>, document.body)}
    {canvasPlacementFlow?.view === 'menu' && createPortal(<RackMenu
      anchor={canvasPlacementFlow.anchor}
      commands={[{
        disabled: !canvasPlacementAssets.length,
        id: 'artwork',
        label: canvasPlacementAssets.length ? 'Place artwork…' : 'Artwork unavailable',
      }]}
      label="Canvas placement commands"
      onClose={closeCanvasPlacementFlow}
      onCommand={(commandId) => {
        if (commandId === 'artwork' && canvasPlacementAssets.length) {
          setCanvasPlacementFlow((current) => current && ({ ...current, view: 'chooser' }));
        }
      }}
      returnFocus={viewportRef.current}
    />, document.body)}
    {canvasPlacementFlow?.view === 'chooser' && createPortal(<Suspense fallback={null}><ArtworkChooser
      assets={canvasPlacementAssets}
      error={browserData.assetError}
      menuSurfaceId={menuSurfaceId}
      onCancel={closeCanvasPlacementFlow}
      onSelect={placeCanvasArtwork}
      status={browserData.assetLoadState}
    /></Suspense>, document.body)}
    {spatialRoot && createPortal(spatialSurface, spatialRoot)}
    {interfaceVisible && <>
      <LatticeProfileRail
        activeEntryId={modul8rActive && modul8rPresentationState.open
          ? modul8rPresentationState.openModule === 'activity' ? 'activity'
            : modul8rPresentationState.openModule === 'people' ? 'discover'
              : modul8rPresentationState.openModule === 'library' ? 'categories' : null
          : creationsOpen ? 'creations' : activityOpen ? 'activity' : discoveryOpen ? 'discover'
            : browserOpen && browserActiveTab === 'categories' ? 'categories' : null}
        blocked={Boolean(viewerSession || discoveryOpen)}
        collapsed={railCollapsed}
        compact={dimensions.width <= 900}
        entries={PROFILE_RAIL_ENTRIES}
        identityControlRef={identityControlRef}
        identityDisabled={Boolean(identityDossierOpening || identityDossierSession || viewerSession || gestureActive || cameraGestureActive || cropModeActive || compositionPreview)}
        identityExpanded={Boolean(identityDossierOpening || identityDossierSession)}
        identitySourceHidden={Boolean(identityDossierSession)}
        officialIdentity={officialIdentity}
        onCollapsedChange={setRailCollapsed}
        onEntryActivate={(entryId, trigger) => {
          if (entryId === 'categories') openCategories(trigger);
          if (entryId === 'creations') setCreationsWindowOpen(true, trigger);
          if (entryId === 'activity') setActivityWindowOpen(true, trigger);
          if (entryId === 'discover') openDiscovery(trigger);
        }}
        onIdentityActivate={openIdentityDossier}
      />
      <LatticeWorkspaceToolbar
        activeToolIds={[(modul8rActive ? modul8rPresentationState.open : browserOpen) ? 'browser' : null,
          publicationOpen ? 'publish' : null,
          (modul8rActive ? modul8rPresentationState.settingsOpen : themeOpen) ? 'theme' : null,
          (modul8rActive ? modul8rPresentationState.settingsOpen : moreOpen) ? 'more' : null].filter(Boolean)}
        compact={dimensions.width <= 980}
        arrangeEnabled={arrangeEnabled}
        owner
        tools={WORKSPACE_TOOLS}
        onEscape={() => {
          if (activeWorkspaceWindowRef.current === 'publish' && publicationOpen) setPublicationOpen(false);
          else if (activeWorkspaceWindowRef.current === 'theme' && themeOpen) setThemeOpen(false);
          else if (activeWorkspaceWindowRef.current === 'settings' && settingsOpen) setSettingsOpen(false);
          else if (activeWorkspaceWindowRef.current === 'more' && moreOpen) setMoreOpen(false);
          else if (activeWorkspaceWindowRef.current === 'creations' && creationsOpen) setCreationsWindowOpen(false);
          else if (activeWorkspaceWindowRef.current === 'activity' && activityOpen) setActivityWindowOpen(false);
          else if (activeWorkspaceWindowRef.current === 'discover' && discoveryOpen) closeDiscovery();
          else if (activeWorkspaceWindowRef.current === 'browser' && browserOpen) closeBrowser();
          else if (themeOpen) setThemeOpen(false);
          else if (browserOpen) closeBrowser();
        }}
        onToolActivate={activateWorkspaceTool}
          toolButtonRefs={{ browser: browserToolRef, more: moreToolRef, preview: previewToolRef, publish: publishToolRef }}
      />
      {!modul8rActive && browserActivated && BrowserWorkspace && <Suspense fallback={null}>
        <BrowserWorkspace
          categoryCommands={browserCategoryCommands}
          data={{
            ...browserData,
            activeTable: { label: activeTableName, placementUnavailableReason },
            usedAssetIds: [...new Set((authoring.draft?.tables || []).flatMap((table) => table.placements.map(({ stableAssetId }) => stableAssetId)))],
          }}
          onActiveTabChange={setBrowserActiveTab}
          onAssetPointerDown={beginBrowserAssetDrag}
          layers={layerEntries}
          onLayerReorder={reorderLayers}
          onLayerSelectionChange={selectPlacement}
          onRenderableAssetsChange={(assetIds) => {
            const draggedAssetId = browserDragGestureRef.current?.assetId;
            if (draggedAssetId && !assetIds.includes(draggedAssetId)) cancelBrowserAssetDrag();
          }}
          onRequestClose={closeBrowser}
          onWorkspaceToolActivate={activateWorkspaceTool}
          open={browserOpen}
          selectedLayerIds={selectedPlacementIds}
          systemTools={RACK_SYSTEM_TOOLS}
          tabRequest={browserTabRequest}
          workspaceActiveToolIds={[publicationOpen ? 'publish' : null, themeOpen ? 'theme' : null].filter(Boolean)}
          workspaceArrangeEnabled={arrangeEnabled}
          workspaceTools={RACK_AUTHORING_TOOLS.map((tool) => tool.id === 'arrange' ? tool : ({
            ...tool,
            disabled: !arrangeEnabled || !selectedPlacement || selectedPlacements.some(({ locked }) => locked),
            disabledReason: !arrangeEnabled ? 'ENABLE ARRANGE' : !selectedPlacement
              ? 'SELECT AN ASSET ON THE CANVAS' : selectedPlacements.some(({ locked }) => locked)
                ? 'SELECTION CONTAINS A LOCKED PLACEMENT' : undefined,
          }))}
        />
      </Suspense>}
      {modul8rActive && Modul8rOwnerWorkspace && <Suspense fallback={null}>
        <Modul8rOwnerWorkspace
          activeTableId={activeTableId}
          arrangeEnabled={arrangeEnabled}
          categoryCommands={browserCategoryCommands}
          data={{
            ...browserData,
            activeTable: { label: activeTableName, placementUnavailableReason },
            usedAssetIds: [...new Set((authoring.draft?.tables || []).flatMap((table) => table.placements.map(({ stableAssetId }) => stableAssetId)))],
          }}
          menuSurfaceId={menuSurfaceId}
          authoringTools={RACK_AUTHORING_TOOLS.filter(({ id }) => id !== 'arrange').map((tool) => ({
            ...tool,
            disabled: !arrangeEnabled || !selectedPlacement || selectedPlacements.some(({ locked }) => locked),
            disabledReason: !arrangeEnabled ? 'ENABLE ARRANGE' : !selectedPlacement
              ? 'SELECT AN ASSET ON THE CANVAS' : selectedPlacements.some(({ locked }) => locked)
                ? 'SELECTION CONTAINS A LOCKED PLACEMENT' : undefined,
          }))}
          closeRequestId={modul8rCloseRequestId}
          initialOpen={modul8rPresentationState.open}
          layers={layerEntries}
          moduleRequest={modul8rModuleRequest}
          onArrangeToggle={() => activateWorkspaceTool('arrange')}
          onAssetPointerDown={beginBrowserAssetDrag}
          onRelatedAssetRecordsChange={setModul8rRelatedAssetState}
          onAuthoringToolActivate={(toolId) => activateWorkspaceTool(toolId)}
          onEscape={() => {
            if (publicationOpen) { setPublicationOpen(false); return true; }
            return false;
          }}
          onOpenStateChange={setModul8rPresentationState}
          onLayerReorder={reorderLayers}
          onLayerSelectionChange={selectPlacement}
          onMenuSurfaceChange={setMenuSurfaceId}
          onNavigateTable={(tableId) => {
            const table = authoring.draft?.tables.find(({ id }) => id === tableId);
            if (table) navigateDirectly(table.coordinate);
          }}
          onRenderableAssetsChange={(assetIds) => {
            const draggedAssetId = browserDragGestureRef.current?.assetId;
            if (draggedAssetId && !assetIds.includes(draggedAssetId)) cancelBrowserAssetDrag();
          }}
          onVisitProfile={onVisitProfile}
          ownedAssetRecords={publicationAssetRecords.filter((record) => normalizeProfileAddress(record.ownerAddress) === profileAddress)}
          openRequestId={modul8rOpenRequestId}
          profileAddress={profileAddress}
          reorderDisabled={!arrangeEnabled}
          returnFocusRef={modul8rReturnFocusRef}
          selectedLayerIds={selectedPlacementIds}
          surfaceId={surfaceId}
          tables={authoring.draft?.tables || []}
          onSurfaceChange={setSurfaceId}
        />
      </Suspense>}
      {!modul8rActive && themeOpen && <ThemeSurface
        anchor={themeAnchor}
        menuSurfaceId={menuSurfaceId}
        onClose={() => { setThemeOpen(false); setThemeAnchor(null); }}
        onMenuSurfaceChange={setMenuSurfaceId}
        onSurfaceChange={setSurfaceId}
        surfaceId={surfaceId}
      />}
      {publicationOpen && <Suspense fallback={null}>
        <OwnerLatticePublicationRack
          activeActorId={activeActorId}
          assetRecords={publicationAssetRecords}
          avatarShape="square"
          environment={PUBLICATION_ENVIRONMENT}
          getWalletPublicationContext={getWalletPublicationContext}
          latticeDraft={authoring.draft}
          onClose={() => {
            setPublicationOpen(false);
            requestAnimationFrame(() => publishToolRef.current?.focus({ preventScroll: true }));
          }}
          onPublished={() => onPublicationConfirmed?.()}
          profile={publicationProfile}
          profileAddress={profileAddress}
          publishedResolution={publishedResolution}
          signalSettings={PUBLICATION_SIGNALS}
          stageId={stageId}
          visitorNavigation={PUBLICATION_VISITOR_NAVIGATION}
        />
      </Suspense>}
      {!modul8rActive && SettingsBrowser && CreationsBrowser && ActivityBrowser && <Suspense fallback={null}>
        <SettingsBrowser
          open={settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
            if (!open) requestAnimationFrame(() => moreToolRef.current?.focus({ preventScroll: true }));
          }}
        />
        <CreationsBrowser
          menuSurfaceId={menuSurfaceId}
          open={creationsOpen}
          onOpenChange={(open) => setCreationsWindowOpen(open)}
          profileAddress={profileAddress}
        />
        <ActivityBrowser
          menuSurfaceId={menuSurfaceId}
          open={activityOpen}
          onOpenChange={(open) => setActivityWindowOpen(open)}
          profileAddress={profileAddress}
        />
      </Suspense>}
      {!modul8rActive && ProfileDiscoveryBoundary && discoveryOpen && <ProfileDiscoveryBoundary
        onClose={closeDiscovery}
        onSelect={(result) => {
          setDiscoveryOpen(false);
          onVisitProfile?.(result.address);
        }}
      />}
      {identityDossierSession && identityDossier && !viewerSession && <LatticeProductionIdentityDossier
        getReturnRectangle={() => identityDossierSession.originRectangle}
        gridVariables={{
          '--lattice-grid-cell-size': `${cellSize}px`,
          '--lattice-grid-origin-x': `${plane.left}px`,
          '--lattice-grid-origin-y': `${plane.top + activeCameraY}px`,
        }}
        menuSurfaceId={menuSurfaceId}
        model={identityDossier}
        onClosed={closeIdentityDossier}
        originRectangle={identityDossierSession.originRectangle}
        preloadedProfileImageUrl={identityDossierSession.preloadedProfileImageUrl}
        reducedMotion={revealPresentation.reducedMotion}
        returnFocus={identityControlRef.current}
        sourceIdentity={officialIdentity}
        viewport={identityDossierSession.viewport}
      />}
      {viewerSession && viewerEntry && <LatticeFocusViewer
        dossier={viewerEntry.dossier}
        entry={viewerEntry}
        getReturnRectangle={() => findPlacementElement(viewerSession.placementId)?.getBoundingClientRect()}
        gridVariables={{
          '--lattice-grid-cell-size': `${cellSize}px`,
          '--lattice-grid-origin-x': `${plane.left}px`,
          '--lattice-grid-origin-y': `${plane.top + activeCameraY}px`,
        }}
        gridVisible
        inspectionVariant="rack"
        menuSurfaceId={menuSurfaceId}
        onClosed={() => setViewerSession(null)}
        onNavigate={navigateViewer}
        originRectangle={viewerSession.originRectangle}
        position={viewerPosition}
        renderArtwork={(focusEntry, context) => <LatticeProductionFocusArtwork
          entry={focusEntry}
          focused={context.phase === 'open' || context.phase === 'opening' || context.phase === 'outgoing'}
          phase={context.phase}
        />}
        returnFocus={viewerSession.returnFocus}
        surfaceColor="var(--lattice-menu-panel)"
        total={viewerEntries.length}
      />}
      {canonicalNotice && <div className="owner-lattice-authoring-notice" data-lattice-chrome role="alert">{canonicalNotice}</div>}
      <div className="owner-lattice-signature" aria-label="INSCAPE">
        <small>{activeTableName}</small>
        <strong>INSCAPE</strong>
        <span>SPATIAL PROFILE SYSTEM / ACTIVE</span>
      </div>
      {keeperVisible && <KeeperDock
        actorId={activeActorId}
        followCursor={keeperFollowCursor}
        gridStyle={gridStyle}
        movementSpeed={keeperMovementSpeed}
        onDockStateChange={setKeeperDockActive}
        onFollowCursorChange={setKeeperFollowCursor}
        onGridStyleChange={setGridStyle}
        onMovementSpeedChange={setKeeperMovementSpeed}
        reducedMotion={reducedMotion}
        residentHandoff={residentHandoff}
        residentScale={0.5}
        spatialTheme={spatialTheme}
      />}
      {keeperVisible && <KeeperSignalsLayer
        interfaceReady={interfaceVisible}
        reactionBridge={keeperReactions}
        reducedMotion={reducedMotion}
        residentHandoffActive={keeperDockActive}
      />}
    </>}
  </main>;
}

export default function OwnerLatticeShell(props) {
  const profileAddress = normalizeProfileAddress(props.workspaceProfileAddress);
  const viewedAddress = normalizeProfileAddress(props.viewedProfileAddress);
  if (props.ownerAuthoringEnabled !== true || !profileAddress || profileAddress !== viewedAddress) return null;
  return <OwnerLatticeRuntime
    {...props}
    viewedProfileAddress={profileAddress}
    workspaceProfileAddress={profileAddress}
  />;
}
