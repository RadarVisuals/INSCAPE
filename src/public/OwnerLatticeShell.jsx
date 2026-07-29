import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeProfileAddress } from '../library/config.js';
import { useProfileIdentity } from '../profileIdentity/index.js';
import {
  LATTICE_PRODUCTION_COORDINATES,
  LATTICE_PRODUCTION_SURFACE_IDS,
  createEmptyLatticeProductionDraft,
} from '../lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../lattice/domain/latticeProductionAdapter.js';
import { assertValidLatticeProductionPublication } from '../lattice/domain/latticeProductionPublication.js';
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
import LatticeProductionTableRenderer from '../lattice/rendering/LatticeProductionTableRenderer.jsx';
import LatticeNavigationOverlay from '../lattice/rendering/LatticeNavigationOverlay.jsx';
import LatticeProfileRail from '../lattice/rendering/LatticeProfileRail.jsx';
import LatticeWorkspaceToolbar from '../lattice/rendering/LatticeWorkspaceToolbar.jsx';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';
import KeeperDock from './KeeperDock.jsx';
import useOwnerLatticeBrowser from './useOwnerLatticeBrowser.js';
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
  { id: 'arrange', label: 'ARRANGE', disabled: true, disabledReason: 'Authoring is not available in Phase 4' },
  { id: 'preview', label: 'PREVIEW', disabled: true, disabledReason: 'Owner Preview integration is not available in Phase 4' },
  { id: 'theme', label: 'THEME' },
  { id: 'publish', label: 'PUBLISH', disabled: true, disabledReason: 'Version 8 publication is disabled' },
  { id: 'more', label: 'MORE', disabled: true, disabledReason: 'Additional owner tools are not available in Phase 4' },
]);
const SURFACE_LABELS = Object.freeze({
  carbon: 'CARBON', graphite: 'GRAPHITE', slate: 'SLATE', ash: 'ASH', mist: 'MIST', paper: 'PAPER',
});

const sameCoordinate = (left, right) => left.x === right.x && left.y === right.y;
const tableIdentity = (table) => table.title.trim() || table.id.replace('-', ' ').toUpperCase();

export function createEmptyOwnerLatticeRuntimeValue(profileAddress, {
  menuSurfaceId = 'carbon',
  surfaceId = 'carbon',
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
  residentHandoff,
  revealPresentation = { reducedMotion: false },
  visitorWalletConnected = false,
  workspaceProfileAddress,
}) {
  const profileAddress = workspaceProfileAddress;

  const viewportRef = useRef(null);
  const activeRef = useRef(entryLatticeCoordinate());
  const gestureRef = useRef(null);
  const settlingRef = useRef(false);
  const snapTimerRef = useRef(null);
  const wheelResetTimerRef = useRef(null);
  const wheelAccumulatorRef = useRef({ x: 0, y: 0 });
  const wheelBlockedUntilRef = useRef(0);
  const browserToolRef = useRef(null);
  const [spatialRoot, setSpatialRoot] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState(() => entryLatticeCoordinate());
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapping, setSnapping] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [surfaceId, setSurfaceId] = useState('carbon');
  const [menuSurfaceId, setMenuSurfaceId] = useState('carbon');
  const [themeOpen, setThemeOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserActivated, setBrowserActivated] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const profileIdentity = useProfileIdentity(profileAddress);
  const browserData = useOwnerLatticeBrowser(profileAddress, browserOpen);
  const profile = useMemo(
    () => getIdentityProfileViewModel(profileIdentity, { walletConnected: visitorWalletConnected }),
    [profileIdentity, visitorWalletConnected],
  );
  const officialIdentity = useMemo(() => ({
    avatarUrl: profile.avatarUrl || null,
    displayName: profile.name || 'UNRESOLVED PROFILE',
    secondaryLabel: profile.displayAddress || 'UNIVERSAL PROFILE',
  }), [profile]);
  const lattice = useMemo(
    () => createEmptyOwnerLatticeRuntimeValue(profileAddress, { menuSurfaceId, surfaceId }),
    [menuSurfaceId, profileAddress, surfaceId],
  );

  useEffect(() => {
    setSpatialRoot(document.querySelector('.application-root'));
  }, []);

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
    activeRef.current = active;
  }, [active]);

  const reducedMotion = revealPresentation.reducedMotion === true;
  const cellSize = Math.min(dimensions.width / 32, dimensions.height / 18);
  const plane = {
    width: 32 * cellSize,
    height: 18 * cellSize,
    left: (dimensions.width - (32 * cellSize)) / 2,
    top: (dimensions.height - (18 * cellSize)) / 2,
  };

  const settle = useCallback((destination, offset = { x: 0, y: 0 }) => {
    if (settlingRef.current) return;
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

  const handlePointerDown = (event) => {
    if (settlingRef.current || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || event.target.closest?.('[data-lattice-chrome],button,a,input,select,textarea')) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      gesture: createPointerGesture({ x: event.clientX, y: event.clientY }),
    };
    viewportRef.current?.focus({ preventScroll: true });
  };

  const handlePointerMove = (event) => {
    const activeGesture = gestureRef.current;
    if (!activeGesture || activeGesture.pointerId !== event.pointerId || settlingRef.current) return;
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
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    finishGesture(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (settlingRef.current || gestureRef.current || performance.now() < wheelBlockedUntilRef.current) return;
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
    if (settlingRef.current || gestureRef.current || event.target.closest?.('input,select,textarea,button')) return;
    const direction = keyboardDirection(event.key);
    const destination = direction && latticeDestination(activeRef.current, direction);
    if (!destination) return;
    event.preventDefault();
    settle(destination);
  };

  const navigateDirectly = useCallback((destination) => {
    if (settlingRef.current || gestureRef.current || sameCoordinate(destination, activeRef.current)) return;
    settle(destination);
  }, [settle]);

  const stageTransform = `translate3d(${dragOffset.x - (active.x * plane.width)}px, ${dragOffset.y - (active.y * plane.height)}px, 0)`;
  const activeTable = lattice.tables.find((table) => table.coordinate.x === active.x && table.coordinate.y === active.y);
  const activeTableName = tableIdentity(activeTable);
  const spatialTheme = ['carbon', 'graphite'].includes(surfaceId) ? 'dark' : 'light';
  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
    queueMicrotask(() => browserToolRef.current?.focus({ preventScroll: true }));
  }, []);

  const spatialSurface = <section
    aria-label="Owner lattice navigation"
    aria-hidden={!interfaceVisible || undefined}
    className="owner-lattice-spatial-surface"
    data-gesture-active={gestureActive || undefined}
    data-interface-visible={interfaceVisible || undefined}
    data-surface={surfaceId}
    onKeyDown={handleKeyDown}
    onLostPointerCapture={() => finishGesture(true)}
    onPointerCancel={() => finishGesture(true)}
    onPointerDown={handlePointerDown}
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
        '--owner-lattice-grid-origin-x': `${(3 * dimensions.width) + plane.left}px`,
        '--owner-lattice-grid-origin-y': `${(3 * dimensions.height) + plane.top}px`,
        '--owner-lattice-snap-duration': `${reducedMotion ? 0 : DEFAULT_LATTICE_INTERACTION_CONFIG.snapDuration}ms`,
        transform: stageTransform,
      }}
    >
      <div className="owner-lattice-atmosphere" style={{
        left: -3 * dimensions.width,
        top: -3 * dimensions.height,
        width: 7 * dimensions.width,
        height: 7 * dimensions.height,
      }} />
      {LATTICE_PRODUCTION_COORDINATES.map((coordinate, index) => {
        const table = lattice.tables[index];
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
        ><LatticeProductionTableRenderer lattice={lattice} tableId={table.id} /></div>;
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
        collapsed={railCollapsed}
        compact={dimensions.width <= 900}
        entries={PROFILE_RAIL_ENTRIES}
        identityDisabled
        identityExpanded={false}
        officialIdentity={officialIdentity}
        onCollapsedChange={setRailCollapsed}
      />
      <LatticeWorkspaceToolbar
        activeToolId={browserOpen ? 'browser' : themeOpen ? 'theme' : null}
        compact={dimensions.width <= 980}
        owner
        tools={WORKSPACE_TOOLS}
        onEscape={() => {
          if (browserOpen) closeBrowser();
          else setThemeOpen(false);
        }}
        onToolActivate={(toolId) => {
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
            activeTable: { label: activeTableName, placementAvailable: false },
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
      <div className="owner-lattice-signature" aria-label="INSCAPE">
        <small>{activeTableName}</small>
        <strong>INSCAPE</strong>
        <span>SPATIAL PROFILE SYSTEM / ACTIVE</span>
      </div>
      {keeperVisible && <KeeperDock
        actorId={activeActorId}
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
