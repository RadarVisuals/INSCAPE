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
import { createLatticeProductionMovementCandidate } from '../lattice/authoring/latticeProductionMovement.js';
import { createLatticeProductionResizeCandidate } from '../lattice/authoring/latticeProductionResize.js';
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
  keeperPointerFollowAllowed,
  keeperPointerFollowSpeedMultiplier,
  keeperPointerTarget,
} from './keeperPointerFollow.js';
import { prepareOwnerLatticeRuntimeDraft } from './ownerLatticeRuntimeProjection.js';
import KeeperDock from './KeeperDock.jsx';
import useOwnerLatticeBrowser from './useOwnerLatticeBrowser.js';
import useOwnerLatticeAuthoring, {
  OWNER_LATTICE_AUTHORING_STATUS,
  ownerLatticePlacementUnavailableReason,
} from './useOwnerLatticeAuthoring.js';
import '../lattice/rendering/latticeMenuSurface.css';
import './ownerLatticeShell.css';

const BrowserWorkspace = lazy(() => import('../lattice/browser/BrowserWorkspace.jsx'));

const RUNTIME_PROJECTION_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const CENTER_TABLE_ID = 'table-05';
const PROFILE_RAIL_ENTRIES = Object.freeze([
  { id: 'categories', label: 'CATEGORIES', note: 'UNAVAILABLE / PHASE 5', disabled: true, disabledReason: 'Categories integration is not available in Phase 4' },
  { id: 'creations', label: 'CREATIONS', note: 'UNAVAILABLE / LATER PHASE', disabled: true, disabledReason: 'Creations integration is not available in Phase 4' },
  { id: 'activity', label: 'ACTIVITY', note: 'UNAVAILABLE / LATER PHASE', disabled: true, disabledReason: 'Activity integration is not available in Phase 4' },
  { id: 'discover', label: 'DISCOVER', note: 'UNAVAILABLE / LATER PHASE', disabled: true, disabledReason: 'Discovery integration is not available in Phase 4' },
]);
const WORKSPACE_TOOLS = Object.freeze([
  { id: 'browser', label: 'BROWSER' },
  { id: 'arrange', label: 'ARRANGE' },
  { id: 'preview', label: 'PREVIEW', disabled: true, disabledReason: 'Owner Preview integration is not available in Phase 4' },
  { id: 'theme', label: 'THEME' },
  { id: 'publish', label: 'PUBLISH', disabled: true, disabledReason: 'Version 8 publication is disabled' },
  { id: 'more', label: 'MORE', disabled: true, disabledReason: 'Additional owner tools are not available in Phase 4' },
]);
const SURFACE_LABELS = Object.freeze({
  carbon: 'CARBON', graphite: 'GRAPHITE', slate: 'SLATE', ash: 'ASH', mist: 'MIST', paper: 'PAPER',
});

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

function ThemeSurface({ menuSurfaceId, onClose, onMenuSurfaceChange, onSurfaceChange, surfaceId }) {
  return <section className="owner-lattice-theme" data-lattice-chrome aria-label="Phase 4 session Theme">
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
  interfaceVisible = true,
  keeperVisible = true,
  publishedResolution,
  residentHandoff,
  revealPresentation = { reducedMotion: false },
  visitorWalletConnected = false,
  workspaceProfileAddress,
}) {
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
  const identityControlRef = useRef(null);
  const identityOpenRequestRef = useRef(0);
  const keeperPointerFollowRef = useRef(null);
  const keeperPointerTargetRef = useRef(null);
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
  const [themeOpen, setThemeOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserActivated, setBrowserActivated] = useState(false);
  const [compositionPreview, setCompositionPreview] = useState(null);
  const [cropModeActive, setCropModeActive] = useState(false);
  const [arrangeEnabled, setArrangeEnabled] = useState(false);
  const [placementMedia, setPlacementMedia] = useState({});
  const [viewerSession, setViewerSession] = useState(null);
  const [identityDossierSession, setIdentityDossierSession] = useState(null);
  const [identityDossierOpening, setIdentityDossierOpening] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [keeperDockActive, setKeeperDockActive] = useState(false);
  const [keeperFollowCursor, setKeeperFollowCursor] = useState(true);
  const [keeperMovementSpeed, setKeeperMovementSpeed] = useState('normal');
  const profileIdentity = useProfileIdentity(profileAddress);
  const profileContractFacts = useProfileContractFacts(profileAddress, { enabled: Boolean(identityDossierOpening || identityDossierSession) });
  const browserData = useOwnerLatticeBrowser(profileAddress, browserOpen);
  const authoring = useOwnerLatticeAuthoring(profileAddress);
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
        : compositionPreview?.kind === 'resize'
          ? createLatticeProductionResizeCandidate(authoring.draft, compositionPreview.request)
          : compositionPreview?.kind === 'crop'
            ? createLatticeProductionCropCandidate(authoring.draft, compositionPreview.request)
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
    themeOpen,
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
      || event.target.closest?.('[data-lattice-chrome],[data-lattice-placement-layer],button,a,input,select,textarea')) return;
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
      if (!keeperPointerFollowEnabled) return;
      const target = keeperPointerTarget(event, event.currentTarget.getBoundingClientRect());
      if (!target) return;
      keeperPointerTargetRef.current = target;
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
    finishGesture(false);
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
  const activeTable = lattice?.tables.find((table) => table.id === activeTableId) || activeDraftTable;
  const activeTableName = activeTable ? tableIdentity(activeTable) : activeTableId.replace('-', ' ').toUpperCase();
  const authoringPlacementUnavailableReason = ownerLatticePlacementUnavailableReason({
    activeTable: activeDraftTable,
    authoringStatus: authoring.status,
    profileReady: authoring.profileReady,
  });
  const placementUnavailableReason = arrangeEnabled ? authoringPlacementUnavailableReason : 'PLACE REQUIRES ARRANGE';
  const canonicalNotice = authoring.status === OWNER_LATTICE_AUTHORING_STATUS.CORRUPT
    ? 'CANONICAL DRAFT UNAVAILABLE / STORED RECORD PRESERVED / EXPLICIT RECOVERY REQUIRED'
    : authoring.error || latticeProjection.error;
  const spatialTheme = ['carbon', 'graphite'].includes(surfaceId) ? 'dark' : 'light';
  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
    queueMicrotask(() => browserToolRef.current?.focus({ preventScroll: true }));
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
  }, [compositionPreview, cropModeActive, identityDossier, viewerSession]);
  const closeIdentityDossier = useCallback(() => {
    setIdentityDossierSession(null);
    requestAnimationFrame(() => identityControlRef.current?.focus({ preventScroll: true }));
  }, []);
  const toggleArrange = useCallback(() => {
    if (arrangeEnabled) setCompositionPreview(null);
    setArrangeEnabled(!arrangeEnabled);
  }, [arrangeEnabled]);
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

  const spatialSurface = <section
    aria-label="Owner lattice navigation"
    aria-hidden={!interfaceVisible || undefined}
    className="owner-lattice-spatial-surface"
    data-camera-active={cameraGestureActive || undefined}
    data-gesture-active={gestureActive || undefined}
    data-interface-visible={interfaceVisible || undefined}
    data-space-pan-ready={(spacePanReady && plane.maximumCameraY > 0) || undefined}
    data-surface={surfaceId}
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
          style={{
            left: plane.left + (coordinate.x * plane.width),
            top: plane.top + (coordinate.y * plane.height),
            width: plane.width,
            height: plane.height,
          }}
        >{lattice
          ? <><LatticeProductionTableRenderer
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
              onCommitRemove={authoring.removePublicPlacement}
              onCommitResize={authoring.resizePublicPlacement}
              onCropModeChange={setCropModeActive}
              onPreviewOperation={setCompositionPreview}
              onReturnFocus={() => viewportRef.current?.focus({ preventScroll: true })}
              tableId={table.id}
            />}
            <UnresolvedRuntimePlacements placements={unresolvedPlacementsByTable.get(table.id) || []} /></>
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
    {spatialRoot && createPortal(spatialSurface, spatialRoot)}
    {interfaceVisible && <>
      <LatticeProfileRail
        blocked={Boolean(viewerSession)}
        collapsed={railCollapsed}
        compact={dimensions.width <= 900}
        entries={PROFILE_RAIL_ENTRIES}
        identityControlRef={identityControlRef}
        identityDisabled={Boolean(identityDossierOpening || identityDossierSession || viewerSession || gestureActive || cameraGestureActive || cropModeActive || compositionPreview)}
        identityExpanded={Boolean(identityDossierOpening || identityDossierSession)}
        identitySourceHidden={Boolean(identityDossierSession)}
        officialIdentity={officialIdentity}
        onCollapsedChange={setRailCollapsed}
        onIdentityActivate={openIdentityDossier}
      />
      <LatticeWorkspaceToolbar
        activeToolId={browserOpen ? 'browser' : themeOpen ? 'theme' : null}
        compact={dimensions.width <= 980}
        arrangeEnabled={arrangeEnabled}
        owner
        tools={WORKSPACE_TOOLS}
        onEscape={() => {
          if (browserOpen) closeBrowser();
          else setThemeOpen(false);
        }}
        onToolActivate={(toolId) => {
          if (toolId === 'arrange') {
            toggleArrange();
          }
          if (toolId === 'browser') {
            setThemeOpen(false);
            setBrowserActivated(true);
            setBrowserOpen((open) => !open);
          }
          if (toolId === 'theme') {
            setBrowserOpen(false);
            setThemeOpen((open) => !open);
          }
        }}
        toolButtonRefs={{ browser: browserToolRef }}
      />
      {browserActivated && <Suspense fallback={null}>
        <BrowserWorkspace
          data={{
            ...browserData,
            activeTable: { label: activeTableName, placementUnavailableReason },
          }}
          onPlaceAsset={(stableAssetId) => {
            if (arrangeEnabled) authoring.placePublicAsset({ stableAssetId, tableId: activeTableId });
          }}
          onRequestClose={closeBrowser}
          open={browserOpen}
        />
      </Suspense>}
      {themeOpen && <ThemeSurface
        menuSurfaceId={menuSurfaceId}
        onClose={() => setThemeOpen(false)}
        onMenuSurfaceChange={setMenuSurfaceId}
        onSurfaceChange={setSurfaceId}
        surfaceId={surfaceId}
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
        movementSpeed={keeperMovementSpeed}
        onDockStateChange={setKeeperDockActive}
        onFollowCursorChange={setKeeperFollowCursor}
        onMovementSpeedChange={setKeeperMovementSpeed}
        reducedMotion={reducedMotion}
        residentHandoff={residentHandoff}
        residentScale={0.5}
        spatialTheme={spatialTheme}
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
