import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { LatticeArtworkPresentation } from './LatticePlacementRenderer.jsx';
import {
  DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG,
  focusViewerLayout,
  normalizeViewerRectangle,
} from './latticeFocusViewer.js';
import './latticeFocusViewer.css';

const FOCUSABLE_SELECTOR = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

const viewportSize = () => ({
  width: Math.max(1, window.innerWidth),
  height: Math.max(1, window.innerHeight),
});

const unresolved = (value) => (typeof value === 'string' && value.trim() ? value : 'NOT RESOLVED');

function ViewerDossier({ dossier, onClose, open, rectangle, side }) {
  const isLeft = side === 'left';
  return (
    <aside
      aria-hidden={!open}
      aria-label={isLeft ? 'Artwork description dossier' : 'Artwork technical dossier'}
      className={`lattice-focus-viewer__dossier is-${side}`}
      data-open={open || undefined}
      style={{
        left: rectangle.left,
        top: rectangle.top,
        width: rectangle.width,
        height: rectangle.height,
      }}
    >
      <header>
        <span>{isLeft ? 'INSCAPE / ASSET NARRATIVE' : 'INSCAPE / TECHNICAL RECORD'}</span>
        <button aria-label="Close both artwork dossiers" disabled={!open} onClick={onClose} tabIndex={open ? 0 : -1} type="button">×</button>
      </header>
      <div className="lattice-focus-viewer__dossier-body" data-lattice-viewer-scroll>
        <small>{isLeft ? 'DESCRIPTION' : 'MEDIA RECORD'}</small>
        <h2>{unresolved(dossier?.title)}</h2>
        {isLeft ? <>
          <p>{unresolved(dossier?.description)}</p>
          <section>
            <small>TRAITS</small>
            {dossier?.traits?.length
              ? <dl>{dossier.traits.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{unresolved(value)}</dd></div>)}</dl>
              : <p>NO TRAITS RESOLVED</p>}
          </section>
        </> : (
          <dl>{(dossier?.technical || []).map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{unresolved(value)}</dd></div>)}</dl>
        )}
      </div>
      <footer><span>INSCAPE PROTOCOL</span><span>{isLeft ? 'LEFT / DESCRIPTION' : 'RIGHT / RECORD'}</span></footer>
    </aside>
  );
}

export default function LatticeFocusViewer({
  dossier,
  entry,
  getReturnRectangle,
  onClosed,
  onNavigate,
  originRectangle,
  position,
  returnFocus,
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
  const origin = useMemo(() => normalizeViewerRectangle(originRectangle, 'originRectangle'), [originRectangle]);
  const [phase, setPhase] = useState('starting');
  const [navigationLocked, setNavigationLocked] = useState(false);
  const [dossiersOpen, setDossiersOpen] = useState(false);
  const [outgoingLayer, setOutgoingLayer] = useState(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [returnRectangle, setReturnRectangle] = useState(origin);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const layout = focusViewerLayout(origin, viewport, dossiersOpen);
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

  const closeDossiers = useCallback(() => {
    if (phase !== 'open' || navigationLocked || !dossiersOpen) return;
    setDossiersOpen(false);
  }, [dossiersOpen, navigationLocked, phase]);

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
    const focusable = [...rootRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
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
    if (event.target.closest?.('[data-lattice-viewer-scroll]')) return;
    event.preventDefault();
    if (phase !== 'open' || total < 2) return;
    const now = performance.now();
    if (now < wheelRef.current.blockedUntil) return;
    const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    wheelRef.current.accumulated += movement;
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
    ? focusViewerLayout(outgoingLayer.originRectangle, viewport, dossiersOpen).artwork
    : null;

  return createPortal(
    <section
      aria-label={`${entry.media.accessibleLabel || 'Artwork'} focus viewer`}
      aria-modal="true"
      className="lattice-focus-viewer"
      data-lattice-focus-viewer
      data-layout={layout.mode}
      data-phase={phase}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onWheel={handleWheel}
      ref={rootRef}
      role="dialog"
      style={{
        '--lattice-viewer-browse-duration': `${DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG.browseDuration}ms`,
        '--lattice-viewer-content-height': `${layout.contentHeight}px`,
      }}
    >
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
          <LatticeArtworkPresentation entry={outgoingLayer.entry} />
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
        <LatticeArtworkPresentation entry={entry} />
      </div>
      <ViewerDossier
        dossier={dossier}
        onClose={closeDossiers}
        open={dossiersOpen}
        rectangle={layout.leftDossier}
        side="left"
      />
      <ViewerDossier
        dossier={dossier}
        onClose={closeDossiers}
        open={dossiersOpen}
        rectangle={layout.rightDossier}
        side="right"
      />
      <nav
        aria-label="Artwork viewer navigation"
        className="lattice-focus-viewer__navigation"
      >
        <button aria-disabled={navigationLocked || total < 2} aria-label="Previous artwork" onClick={() => requestNavigation(-1)} type="button">‹</button>
        <span>{String(position + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        <button aria-disabled={navigationLocked || total < 2} aria-label="Next artwork" onClick={() => requestNavigation(1)} type="button">›</button>
      </nav>
      <button
        aria-label="Close artwork viewer"
        aria-disabled={phase !== 'open' || navigationLocked}
        className="lattice-focus-viewer__close"
        data-disabled={phase !== 'open' || navigationLocked || undefined}
        onClick={requestClose}
        ref={closeRef}
        style={{ left: focusedRectangle.left + focusedRectangle.width - 28, top: focusedRectangle.top + 6 }}
        type="button"
      >×</button>
    </section>,
    document.body,
  );
}
