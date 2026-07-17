import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IdentityDossier from './IdentityDossier.jsx';
import { CollectionWindow } from '../library/index.js';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';
import { getPublicTheme } from './themeTokens.js';
import {
  MODULE_LAYOUT_STORAGE_KEY,
  clampModulePosition,
  createModuleGridGeometry,
  decodeModuleLayout,
  encodeModuleLayout,
  findNearestAvailableModulePosition,
  findNearestExpandedModulePosition,
  getDefaultModulePositions,
  getCollectionSpan,
  getIdentitySpan,
  isExpandedModulePlacementAvailable,
  isModulePlacementAvailable
} from './moduleLayout.js';
import './moduleGrid.css';
import '../library/collection.css';

const MODULES = Object.freeze([
  { id: 'identity', label: 'Profile Card' },
  { id: 'collection', label: 'Collection' },
  { id: 'creations', label: 'Creations' },
  { id: 'signals', label: 'Signals' }
]);

const MODULE_ENTRY_ORDER = Object.freeze({
  identity: 0,
  collection: 1,
  signals: 2,
  creations: 3
});

const FULL_MODULE_ENTRY_BASE_MS = 240;
const FULL_MODULE_ENTRY_STAGGER_MS = 220;
const GROUPED_MODULE_ENTRY_MS = 70;

const profile = getIdentityProfileViewModel();

function getInitialGeometry() {
  return createModuleGridGeometry(window.innerWidth, window.innerHeight);
}

function readStoredPositions(geometry) {
  try {
    return decodeModuleLayout(window.localStorage.getItem(MODULE_LAYOUT_STORAGE_KEY), geometry);
  } catch {
    return getDefaultModulePositions(geometry);
  }
}

function GridBackdrop({ geometry }) {
  const intersections = [];
  for (let row = 0; row <= geometry.majorRows; row += 1) {
    for (let column = 0; column <= geometry.columns; column += 1) {
      intersections.push({
        x: Math.round(column * geometry.cellWidth),
        y: Math.round(row * geometry.majorCellHeight),
        key: `${column}-${row}`
      });
    }
  }

  return (
    <svg
      className="module-grid__backdrop"
      viewBox={`0 0 ${geometry.usableWidth} ${geometry.usableHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="module-grid__lines">
        {Array.from({ length: geometry.columns + 1 }, (_, index) => (
          <line key={`v-${index}`} x1={Math.round(index * geometry.cellWidth)} y1="0" x2={Math.round(index * geometry.cellWidth)} y2={geometry.usableHeight} />
        ))}
        {Array.from({ length: geometry.majorRows + 1 }, (_, index) => (
          <line key={`h-${index}`} x1="0" y1={Math.round(index * geometry.majorCellHeight)} x2={geometry.usableWidth} y2={Math.round(index * geometry.majorCellHeight)} />
        ))}
      </g>
      <g className="module-grid__minor-lines">
        {Array.from({ length: geometry.majorRows * 2 }, (_, index) => {
          const majorRow = Math.floor(index / 2);
          const subdivision = (index % 2) + 1;
          const y = Math.round((majorRow + subdivision / 3) * geometry.majorCellHeight);
          return <line key={`minor-h-${index}`} x1="0" y1={y} x2={geometry.usableWidth} y2={y} />;
        })}
      </g>
      <g className="module-grid__crosses">
        {intersections.map(({ x, y, key }) => (
          <circle key={key} cx={x} cy={y} r="1.5" />
        ))}
      </g>
    </svg>
  );
}

export default function ModuleGridShell({
  onRequestAtelier,
  activeActorId,
  avatarSrc,
  residentHandoff,
  interfaceVisible = true,
  revealPresentation = { sequence: 'short', reducedMotion: false }
}) {
  const [geometry, setGeometry] = useState(getInitialGeometry);
  const [positions, setPositions] = useState(() => readStoredPositions(getInitialGeometry()));
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityPhase, setIdentityPhase] = useState('closed');
  const [identityPanelPosition, setIdentityPanelPosition] = useState(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionPanelPosition, setCollectionPanelPosition] = useState(null);
  const [collectionSearchRequest, setCollectionSearchRequest] = useState(0);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeHudCommand, setActiveHudCommand] = useState(null);
  const [availableModuleIds, setAvailableModuleIds] = useState(() => new Set());
  const moduleRefs = useRef(new Map());
  const identityRef = useRef(null);
  const identityPanelRef = useRef(null);
  const collectionPanelRef = useRef(null);
  const shellRef = useRef(null);
  const gridRef = useRef(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const resizeFrameRef = useRef(0);
  const theme = useMemo(() => getPublicTheme(activeActorId), [activeActorId]);
  const identitySpan = useMemo(() => getIdentitySpan(geometry), [geometry]);
  const collectionSpan = useMemo(() => getCollectionSpan(geometry), [geometry]);

  useEffect(() => {
    if (!interfaceVisible) {
      setAvailableModuleIds(new Set());
      return undefined;
    }

    const groupedEntry = revealPresentation.sequence !== 'full' || revealPresentation.reducedMotion;
    const timers = MODULES.map(({ id }) => {
      const delay = groupedEntry
        ? GROUPED_MODULE_ENTRY_MS
        : FULL_MODULE_ENTRY_BASE_MS + MODULE_ENTRY_ORDER[id] * FULL_MODULE_ENTRY_STAGGER_MS;
      return window.setTimeout(() => {
        setAvailableModuleIds((current) => {
          const next = new Set(current);
          next.add(id);
          return next;
        });
      }, delay);
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [interfaceVisible, revealPresentation.reducedMotion, revealPresentation.sequence]);

  useEffect(() => {
    if (!identityOpen) return;
    setIdentityPanelPosition((current) => findNearestExpandedModulePosition(
      current ?? positions.identity,
      identitySpan,
      positions,
      geometry
    ));
  }, [geometry, identityOpen, identitySpan, positions]);

  useEffect(() => {
    if (!collectionOpen) return;
    setCollectionPanelPosition((current) => findNearestExpandedModulePosition(
      current ?? positions.collection,
      collectionSpan,
      positions,
      geometry
    ));
  }, [collectionOpen, collectionSpan, geometry, positions]);

  useEffect(() => {
    const resize = () => {
      if (resizeFrameRef.current) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = 0;
        const nextGeometry = createModuleGridGeometry(window.innerWidth, window.innerHeight);
        setGeometry(nextGeometry);
        setPositions(readStoredPositions(nextGeometry));
      });
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      if (resizeFrameRef.current) window.cancelAnimationFrame(resizeFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const closeIdentity = (event) => {
      if (event.key === 'Escape' && identityOpen && activeModuleId === 'identity') identityRef.current?.requestClose();
    };
    window.addEventListener('keydown', closeIdentity);
    return () => window.removeEventListener('keydown', closeIdentity);
  }, [activeModuleId, identityOpen]);

  useEffect(() => {
    residentHandoff?.trackActorPosition?.(gridRef.current);
    return () => residentHandoff?.trackActorPosition?.(null);
  }, [residentHandoff]);

  useEffect(() => {
    if (!identityOpen) return undefined;
    const frame = window.requestAnimationFrame(() => identityRef.current?.updateEntryBounds?.());
    return () => window.cancelAnimationFrame(frame);
  }, [geometry, identityOpen, identityPanelPosition]);

  const persistPositions = useCallback((nextPositions) => {
    if (geometry.narrow) return;
    try {
      window.localStorage.setItem(MODULE_LAYOUT_STORAGE_KEY, encodeModuleLayout(nextPositions));
    } catch (error) {
      console.warn('[ModuleGrid] Could not persist layout:', error);
    }
  }, [geometry.narrow]);

  const commitPosition = useCallback((id, position) => {
    setPositions((current) => {
      const next = { ...current, [id]: position };
      persistPositions(next);
      return next;
    });
  }, [persistPositions]);

  const openModule = useCallback((id) => {
    if (id === 'identity' && identityOpen) {
      identityRef.current?.requestClose();
      return;
    }
    if (id === 'collection' && collectionOpen) {
      setCollectionOpen(false);
      setActiveModuleId(null);
      window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
      return;
    }
    setActiveModuleId(id);
    if (id === 'collection') {
      setCollectionPanelPosition((current) => findNearestExpandedModulePosition(
        current ?? positions.collection,
        collectionSpan,
        positions,
        geometry
      ));
      setCollectionOpen(true);
      return;
    }
    if (id !== 'identity') return;
    setIdentityPanelPosition((current) => findNearestExpandedModulePosition(
      current ?? positions.identity,
      identitySpan,
      positions,
      geometry
    ));
    setIdentityPhase('approaching');
    setIdentityOpen(true);
  }, [collectionOpen, collectionSpan, geometry, identityOpen, identitySpan, positions]);

  const openCollectionSearch = useCallback(() => {
    if (!collectionOpen) openModule('collection');
    setActiveModuleId('collection');
    setActiveHudCommand('search');
    setCollectionSearchRequest((value) => value + 1);
  }, [collectionOpen, openModule]);

  const positionStyle = useCallback((position, span = { columns: 1, rows: 1 }, inset = 4) => {
    const left = Math.round(position.column * geometry.cellWidth);
    const top = Math.round(position.row * geometry.cellHeight);
    const right = Math.round((position.column + span.columns) * geometry.cellWidth);
    const bottom = Math.round((position.row + span.rows) * geometry.cellHeight);
    return {
      left: left + inset,
      top: top + inset,
      width: right - left - inset * 2,
      height: bottom - top - inset * 2
    };
  }, [geometry]);

  const moduleStyle = useCallback((id, span = { columns: 1, rows: 1 }, inset = 4) => (
    positionStyle(positions[id], span, inset)
  ), [positionStyle, positions]);

  const clearDragPresentation = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.frame) window.cancelAnimationFrame(drag.frame);
    if (drag?.shell) {
      drag.shell.style.transform = '';
      delete drag.shell.dataset.dragging;
    }
    if (previewRef.current) previewRef.current.hidden = true;
    if (shellRef.current) delete shellRef.current.dataset.dragging;
    dragRef.current = null;
  }, []);

  const startDrag = useCallback((event, id, span = { columns: 1, rows: 1 }, enabled = true) => {
    if (!enabled || geometry.narrow || (event.button !== undefined && event.button !== 0)) return;
    const shell = moduleRefs.current.get(id);
    if (!shell) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      id,
      span,
      shell,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: positions[id],
      candidate: positions[id],
      moved: false,
      frame: 0,
      deltaX: 0,
      deltaY: 0,
      valid: true
    };
  }, [geometry.narrow, positions]);

  const startExpandedPanelDrag = useCallback((event, id, span, position, panelRef, enabled) => {
    if (geometry.narrow || !enabled || !position) return;
    if (event.button !== undefined && event.button !== 0) return;
    const shell = panelRef.current;
    if (!shell) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      id,
      kind: 'expanded',
      span,
      shell,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
      candidate: position,
      moved: false,
      frame: 0,
      deltaX: 0,
      deltaY: 0,
      valid: true
    };
  }, [geometry.narrow]);

  const moveDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.deltaX = event.clientX - drag.startX;
    drag.deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(drag.deltaX, drag.deltaY) < 6) return;

    drag.moved = true;
    drag.candidate = clampModulePosition({
      column: drag.origin.column + Math.round(drag.deltaX / geometry.cellWidth),
      row: drag.origin.row + Math.round(drag.deltaY / geometry.cellHeight)
    }, drag.span, geometry);
    drag.valid = drag.kind === 'expanded'
      ? isExpandedModulePlacementAvailable(drag.candidate, drag.span, positions, geometry)
      : isModulePlacementAvailable(drag.id, drag.candidate, drag.span, positions, geometry);
    drag.shell.dataset.dragging = 'true';
    if (shellRef.current) shellRef.current.dataset.dragging = drag.id;

    if (!drag.frame) {
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = 0;
        drag.shell.style.transform = `translate3d(${drag.deltaX}px, ${drag.deltaY}px, 0)`;
        const preview = previewRef.current;
        if (!preview) return;
        preview.hidden = false;
        preview.dataset.valid = drag.valid ? 'true' : 'false';
        preview.style.left = `${drag.candidate.column * geometry.cellWidth + 4}px`;
        preview.style.top = `${drag.candidate.row * geometry.cellHeight + 4}px`;
        preview.style.width = `${drag.span.columns * geometry.cellWidth - 8}px`;
        preview.style.height = `${drag.span.rows * geometry.cellHeight - 8}px`;
      });
    }
  }, [geometry, positions]);

  const endDrag = useCallback((event, activateOnClick = false) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const wasMoved = drag.moved;
    const id = drag.id;
    const nextPosition = wasMoved
      ? drag.kind === 'expanded'
        ? findNearestExpandedModulePosition(drag.candidate, drag.span, positions, geometry)
        : findNearestAvailableModulePosition(id, drag.candidate, drag.span, positions, geometry)
      : null;
    clearDragPresentation();
    if (wasMoved && drag.kind === 'expanded') {
      if (id === 'identity-panel') setIdentityPanelPosition(nextPosition);
      if (id === 'collection-panel') setCollectionPanelPosition(nextPosition);
    }
    else if (wasMoved) commitPosition(id, nextPosition);
    else if (activateOnClick) openModule(id);
  }, [clearDragPresentation, commitPosition, geometry, openModule, positions]);

  const resetLayout = () => {
    const defaults = getDefaultModulePositions(geometry);
    setPositions(defaults);
    if (identityOpen) {
      setIdentityPanelPosition(findNearestExpandedModulePosition(
        defaults.identity,
        identitySpan,
        defaults,
        geometry
      ));
    }
    if (collectionOpen) {
      setCollectionPanelPosition(findNearestExpandedModulePosition(
        defaults.collection,
        collectionSpan,
        defaults,
        geometry
      ));
    }
    persistPositions(defaults);
  };

  const identityDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'identity-panel', identitySpan, identityPanelPosition, identityPanelRef, identityPhase === 'open'),
    onPointerMove: moveDrag,
    onPointerUp: (event) => endDrag(event, false),
    onPointerCancel: clearDragPresentation
  };

  const collectionDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'collection-panel', collectionSpan, collectionPanelPosition, collectionPanelRef, true),
    onPointerMove: moveDrag,
    onPointerUp: (event) => endDrag(event, false),
    onPointerCancel: clearDragPresentation
  };

  return (
    <main
      className="public-shell"
      data-application-mode="public"
      data-identity-open={identityOpen || undefined}
      data-actor-id={activeActorId}
      data-layout-mode={geometry.narrow ? 'narrow' : 'desktop'}
      data-interface-visible={interfaceVisible || undefined}
      data-entry-sequence={revealPresentation.sequence}
      data-reduced-motion={revealPresentation.reducedMotion || undefined}
      style={theme}
      aria-label="OS Underneath public world"
      ref={shellRef}
    >
      <header className="public-shell__masthead">
        <div className="system-hud__identity">
          <h1 aria-label="OS Underneath">
            <span className="system-hud__bracket" aria-hidden="true">[</span>
            {' OS_'}<span className="system-hud__brand-accent">UNDERNEATH</span>{' '}
            <span className="system-hud__bracket" aria-hidden="true">]</span>
          </h1>
          <span className="system-hud__operator">{profile.artistName}</span>
          <span className="system-hud__live"><i aria-hidden="true" />Live</span>
        </div>

        <nav className="system-hud__commands" aria-label="OS Underneath controls">
          <button
            type="button"
            aria-pressed={activeHudCommand === 'search'}
            onClick={openCollectionSearch}
          >
            [ Search ]
          </button>
          <button type="button" onClick={() => openModule('identity')} aria-expanded={identityOpen}>[ Share ]</button>
          <button type="button" onClick={onRequestAtelier} aria-label="Edit in Atelier">[ Edit ]</button>
          <button
            type="button"
            aria-pressed={activeHudCommand === 'settings'}
            onClick={() => setActiveHudCommand((current) => current === 'settings' ? null : 'settings')}
          >
            [ Settings ]
          </button>
        </nav>
      </header>

      <section
        className="module-grid"
        aria-label="Modules"
        ref={gridRef}
        style={{
          left: geometry.left,
          top: geometry.top,
          width: geometry.usableWidth,
          height: geometry.usableHeight,
          '--grid-cell-width': `${geometry.cellWidth}px`,
          '--grid-cell-height': `${geometry.cellHeight}px`,
          '--grid-left': `${geometry.left}px`,
          '--grid-top': `${geometry.top}px`
        }}
      >
        <GridBackdrop geometry={geometry} />
        <div className="module-grid__placement-preview" ref={previewRef} hidden />

        {MODULES.map(({ id, label }) => {
          const isActive = activeModuleId === id || (id === 'identity' && identityOpen) || (id === 'collection' && collectionOpen);
          const entryAvailable = availableModuleIds.has(id);
          const entryIndex = MODULE_ENTRY_ORDER[id];
          return (
            <button
              className="module-shell module-button"
              data-module-shell
              data-module-id={id}
              data-module-entry-index={entryIndex}
              data-entry-state={entryAvailable ? 'ready' : 'pending'}
              data-active={isActive || undefined}
              key={id}
              type="button"
              disabled={!entryAvailable}
              aria-hidden={!entryAvailable || undefined}
              aria-expanded={id === 'identity' ? identityOpen : id === 'collection' ? collectionOpen : undefined}
              aria-pressed={id === 'identity' ? undefined : isActive}
              aria-label={`Open ${label} module`}
              style={{
                ...moduleStyle(id, undefined, 0),
                '--module-entry-index': entryIndex
              }}
              ref={(node) => {
                if (node) moduleRefs.current.set(id, node);
                else moduleRefs.current.delete(id);
              }}
              onPointerDown={(event) => startDrag(event, id)}
              onPointerMove={moveDrag}
              onPointerUp={(event) => endDrag(event, true)}
              onPointerCancel={clearDragPresentation}
              onClick={(event) => {
                if (event.detail === 0) openModule(id);
              }}
            >
              <span>{label}</span>
            </button>
          );
        })}

        {identityOpen && identityPanelPosition && (
          <section
            className="module-shell module-shell--expanded"
            data-module-shell
            data-module-id="identity-panel"
            data-transition-state={identityPhase}
            ref={identityPanelRef}
            style={positionStyle(identityPanelPosition, identitySpan)}
            role="dialog"
            aria-modal="false"
            aria-labelledby="identity-title"
            onPointerDownCapture={() => setActiveModuleId('identity')}
          >
            <IdentityDossier
              ref={identityRef}
              avatarSrc={avatarSrc}
              actorId={activeActorId}
              residentHandoff={residentHandoff}
              dragHandleProps={identityDragProps}
              dragEnabled={!geometry.narrow && identityPhase === 'open'}
              onTransitionStateChange={setIdentityPhase}
              onClose={() => {
                setIdentityOpen(false);
                setIdentityPhase('closed');
                setActiveModuleId(collectionOpen ? 'collection' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get('identity')?.focus());
              }}
            />
          </section>
        )}

        {collectionOpen && collectionPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection"
            data-module-shell
            data-module-id="collection-panel"
            ref={collectionPanelRef}
            style={positionStyle(collectionPanelPosition, collectionSpan)}
            role="dialog"
            aria-modal="false"
            aria-labelledby="collection-title"
            onPointerDownCapture={() => setActiveModuleId('collection')}
          >
            <CollectionWindow
              dragHandleProps={collectionDragProps}
              dragEnabled={!geometry.narrow}
              focusSearchRequest={collectionSearchRequest}
              escapeEnabled={activeModuleId === 'collection'}
              onClose={() => {
                setCollectionOpen(false);
                setActiveModuleId(identityOpen ? 'identity' : null);
                setActiveHudCommand((current) => current === 'search' ? null : current);
                window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
              }}
            />
          </section>
        )}
      </section>
    </main>
  );
}
