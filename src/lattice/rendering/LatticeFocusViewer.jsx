import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import LatticeFocusInspection from './LatticeFocusInspection.jsx';
import { LatticeArtworkPresentation } from './LatticePlacementRenderer.jsx';
import {
  DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG,
  focusViewerEntryRectangle,
  focusViewerLayout,
  focusViewerRackLayout,
  normalizeViewerRectangle,
  shouldContainViewerScroll,
} from './latticeFocusViewer.js';
import './latticeMenuSurface.css';
import './latticeFocusViewer.css';

const FOCUSABLE_SELECTOR = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

const viewportSize = () => ({
  width: Math.max(1, window.innerWidth),
  height: Math.max(1, window.innerHeight),
});

export default function LatticeFocusViewer({
  dossier,
  entry,
  getReturnRectangle,
  gridVariables,
  gridVisible,
  inspectionFrameGridVisible = true,
  inspectionVariant = 'paired',
  onClosed,
  onNavigate,
  originRectangle,
  menuSurfaceId,
  navigationPlacement = 'viewport',
  navigationViewportBottom = 18,
  overlayInk,
  position,
  recenterArtworkWhenInspectionClosed = false,
  renderArtwork,
  returnFocus,
  surfaceColor,
  total,
}) {
  const rootRef = useRef(null);
  const artworkRef = useRef(null);
  const closeRef = useRef(null);
  const returnFocusRef = useRef(returnFocus);
  const previousLayerRef = useRef({ entry, originRectangle });
  const suppressArtworkClickRef = useRef(false);
  const swipeRef = useRef(null);
  const wheelRef = useRef({ accumulated: 0, blockedUntil: 0 });
  const wheelResetRef = useRef(null);
  const origin = useMemo(() => normalizeViewerRectangle(originRectangle, 'originRectangle'), [originRectangle]);
  const [phase, setPhase] = useState('starting');
  const [navigationLocked, setNavigationLocked] = useState(false);
  const [dossiersOpen, setDossiersOpen] = useState(true);
  const [activeDossier, setActiveDossier] = useState('narrative');
  const [outgoingLayer, setOutgoingLayer] = useState(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [returnRectangle, setReturnRectangle] = useState(origin);
  const [reducedMotion, setReducedMotion] = useState(
    () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  const layoutOrigin = focusViewerEntryRectangle(origin, entry.focusDimensions);
  const rackInspection = inspectionVariant === 'rack';
  const createLayout = (rectangle, size) => {
    const nextLayout = rackInspection
      ? focusViewerRackLayout(rectangle, size, dossiersOpen)
      : focusViewerLayout(rectangle, size, dossiersOpen);
    if (!rackInspection || !recenterArtworkWhenInspectionClosed || dossiersOpen || nextLayout.mode !== 'rack') {
      return nextLayout;
    }
    return {
      ...nextLayout,
      artwork: {
        ...nextLayout.artwork,
        left: (size.width - nextLayout.artwork.width) / 2,
      },
    };
  };
  const layout = createLayout(layoutOrigin, viewport);
  const focusedRectangle = layout.artwork;
  const collapsedRectangle = phase === 'closing' ? returnRectangle : origin;
  const collapsedTransform = {
    x: collapsedRectangle.left - focusedRectangle.left,
    y: collapsedRectangle.top - focusedRectangle.top,
    scaleX: collapsedRectangle.width / focusedRectangle.width,
    scaleY: collapsedRectangle.height / focusedRectangle.height,
  };
  returnFocusRef.current = returnFocus;

  useLayoutEffect(() => {
    const previous = previousLayerRef.current;
    if (previous.entry.placement.id === entry.placement.id) return;
    setOutgoingLayer(previous);
    previousLayerRef.current = { entry, originRectangle };
  }, [entry, originRectangle]);

  useLayoutEffect(() => {
    if (reducedMotion) {
      setPhase('open');
      return undefined;
    }
    // Establish the source rectangle as a real layout baseline before asking
    // the next frame to animate it. This avoids a cold two-frame delay while
    // still guaranteeing that the transition has stable starting geometry.
    artworkRef.current?.getBoundingClientRect();
    const firstFrame = requestAnimationFrame(() => setPhase('opening'));
    return () => {
      cancelAnimationFrame(firstFrame);
    };
  }, [reducedMotion]);

  useEffect(() => {
    const resize = () => setViewport(viewportSize());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => () => window.clearTimeout(wheelResetRef.current), []);

  useEffect(() => {
    if (!outgoingLayer) return undefined;
    const fallback = window.setTimeout(() => {
      setOutgoingLayer(null);
      setNavigationLocked(false);
    }, reducedMotion ? 0 : DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.browseDuration + 120);
    return () => window.clearTimeout(fallback);
  }, [outgoingLayer, reducedMotion]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const isolated = [...document.body.children]
      .filter((node) => node !== root)
      .map((node) => ({ node, hadInert: node.hasAttribute('inert'), inertValue: node.inert }));
    isolated.forEach(({ node }) => { node.inert = true; });
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      isolated.forEach(({ node, hadInert, inertValue }) => {
        if (hadInert) node.inert = inertValue;
        else node.removeAttribute('inert');
      });
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
    };
  }, []);

  const requestNavigation = useCallback((direction) => {
    if (phase !== 'open' || navigationLocked || total < 2) return;
    setNavigationLocked(true);
    onNavigate(direction);
  }, [navigationLocked, onNavigate, phase, total]);

  const requestClose = useCallback(() => {
    if (phase !== 'open' || navigationLocked) return;
    const liveRectangle = getReturnRectangle?.();
    if (reducedMotion) {
      onClosed();
      return;
    }
    setReturnRectangle(liveRectangle ? normalizeViewerRectangle(liveRectangle, 'returnRectangle') : origin);
    setPhase('closing');
  }, [getReturnRectangle, navigationLocked, onClosed, origin, phase, reducedMotion]);

  const cycleArtworkViewer = useCallback(() => {
    if (suppressArtworkClickRef.current) {
      suppressArtworkClickRef.current = false;
      return;
    }
    if (phase !== 'open' || navigationLocked) return;
    setDossiersOpen((current) => !current);
  }, [navigationLocked, phase]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [requestClose]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (!event.repeat) requestNavigation(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...rootRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter((node) => !node.closest('[inert]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (phase === 'opening') setPhase('open');
    else if (phase === 'closing') onClosed();
  };

  const handleWheel = (event) => {
    const scrollRegion = event.target.closest?.('[data-lattice-viewer-scroll]');
    if (scrollRegion) {
      event.stopPropagation();
      if (shouldContainViewerScroll(scrollRegion, event.deltaX, event.deltaY)) event.preventDefault();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (phase !== 'open' || total < 2) return;
    const now = performance.now();
    if (now < wheelRef.current.blockedUntil) return;
    const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    wheelRef.current.accumulated += movement;
    window.clearTimeout(wheelResetRef.current);
    wheelResetRef.current = window.setTimeout(() => {
      wheelRef.current.accumulated = 0;
    }, DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.wheelCooldown);
    if (Math.abs(wheelRef.current.accumulated) < DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.wheelAccumulationThreshold) return;
    const direction = wheelRef.current.accumulated > 0 ? 1 : -1;
    wheelRef.current = {
      accumulated: 0,
      blockedUntil: now + DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.wheelCooldown,
    };
    requestNavigation(direction);
  };

  const beginSwipe = (event) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || event.target.closest?.('button,a')) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    swipeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const finishSwipe = (event) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    swipeRef.current = null;
    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;
    if (Math.abs(deltaX) >= DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.swipeThreshold
      && Math.abs(deltaX) >= Math.abs(deltaY) * DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.swipeDominance) {
      suppressArtworkClickRef.current = true;
      requestNavigation(deltaX < 0 ? 1 : -1);
    }
  };

  const cancelSwipe = (event) => {
    if (swipeRef.current?.pointerId === event.pointerId) swipeRef.current = null;
  };

  const outgoingRectangle = outgoingLayer
    ? createLayout(focusViewerEntryRectangle(
      outgoingLayer.originRectangle,
      outgoingLayer.entry.focusDimensions,
    ), viewport).artwork
    : null;
  const artworkLayer = (layerEntry, context) => renderArtwork
    ? renderArtwork(layerEntry, context)
    : <LatticeArtworkPresentation entry={layerEntry} />;

  return createPortal(
    <section
      aria-label={`${entry.media.accessibleLabel || 'Artwork'} focus viewer`}
      aria-modal="true"
      className="lattice-focus-viewer"
      data-adaptive-rack-presentation={rackInspection
        && (recenterArtworkWhenInspectionClosed || navigationPlacement === 'artwork') || undefined}
      data-lattice-focus-viewer
      data-layout={layout.mode}
      data-grid-visible={gridVisible}
      data-inspection-frame-grid-visible={inspectionFrameGridVisible}
      data-menu-surface={menuSurfaceId}
      data-phase={phase}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onWheel={handleWheel}
      ref={rootRef}
      role="dialog"
      style={{
        ...gridVariables,
        '--lattice-viewer-browse-duration': `${DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.browseDuration}ms`,
        '--lattice-viewer-content-height': `${layout.contentHeight}px`,
        '--lattice-overlay-ink': overlayInk,
        '--lattice-inspection-surface': surfaceColor,
      }}
    >
      <div aria-hidden="true" className="lattice-focus-viewer__surface" />
      <div aria-hidden="true" className="lattice-focus-viewer__content-spacer" />
      {outgoingLayer && outgoingRectangle && (
        <div
          aria-hidden="true"
          className="lattice-focus-viewer__browse-layer is-outgoing"
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget) return;
            setOutgoingLayer(null);
            setNavigationLocked(false);
          }}
          style={{
            left: outgoingRectangle.left,
            top: outgoingRectangle.top,
            width: outgoingRectangle.width,
            height: outgoingRectangle.height,
          }}
        >
          {artworkLayer(outgoingLayer.entry, { phase: 'outgoing', focused: true })}
        </div>
      )}
      <div
        className="lattice-focus-viewer__artwork"
        data-browsing={outgoingLayer ? true : undefined}
        onClick={cycleArtworkViewer}
        onPointerCancel={cancelSwipe}
        onPointerDown={beginSwipe}
        onPointerUp={finishSwipe}
        onTransitionEnd={handleTransitionEnd}
        ref={artworkRef}
        style={{
          '--lattice-viewer-collapse-x': `${collapsedTransform.x}px`,
          '--lattice-viewer-collapse-y': `${collapsedTransform.y}px`,
          '--lattice-viewer-collapse-scale-x': collapsedTransform.scaleX,
          '--lattice-viewer-collapse-scale-y': collapsedTransform.scaleY,
          left: focusedRectangle.left,
          top: focusedRectangle.top,
          width: focusedRectangle.width,
          height: focusedRectangle.height,
        }}
      >
        {artworkLayer(entry, { phase, focused: phase === 'open' || phase === 'opening' })}
      </div>
      <LatticeFocusInspection
        activeSection={activeDossier}
        dossier={dossier}
        layout={layout}
        onSectionChange={setActiveDossier}
        open={dossiersOpen}
        variant={inspectionVariant}
      />
      <nav
        aria-label="Artwork viewer navigation"
        className="lattice-focus-viewer__navigation"
        style={rackInspection ? {
          left: navigationPlacement === 'artwork'
            ? layout.artwork.left + (layout.artwork.width / 2)
            : '50%',
          ...(layout.mode === 'rack-compact' || navigationPlacement === 'artwork'
            ? { bottom: 'auto', top: layout.artwork.top + layout.artwork.height + 18 }
            : { bottom: navigationViewportBottom }),
        } : undefined}
      >
        <button aria-disabled={navigationLocked || total < 2} aria-label="Previous artwork" onClick={() => requestNavigation(-1)} type="button">‹</button>
        <span>{String(position + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        <button aria-disabled={navigationLocked || total < 2} aria-label="Next artwork" onClick={() => requestNavigation(1)} type="button">›</button>
      </nav>
      <div
        className="lattice-focus-viewer__close-control"
        data-disabled={phase !== 'open' || navigationLocked || undefined}
        style={{
          ...(rackInspection ? { left: 'auto', right: 18, top: 18, transform: 'none' } : {
            left: layout.inspectionFrame.left + (layout.inspectionFrame.width / 2),
            top: Math.max(16, layout.inspectionFrame.top - 118),
          }),
        }}
      >
        <button
          aria-label="Close artwork viewer"
          aria-disabled={phase !== 'open' || navigationLocked}
          className="lattice-focus-viewer__close"
          onClick={requestClose}
          ref={closeRef}
          type="button"
        >×</button>
        <span>CLOSE INSPECTION</span>
      </div>
    </section>,
    document.body,
  );
}
