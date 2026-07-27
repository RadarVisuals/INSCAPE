import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { LatticeArtworkPresentation } from './LatticePlacementRenderer.jsx';
import {
  focusedViewerRectangle,
  normalizeViewerRectangle,
  viewerTransform,
} from './latticeFocusViewer.js';
import './latticeFocusViewer.css';

const FOCUSABLE_SELECTOR = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

const viewportSize = () => ({
  width: Math.max(1, window.innerWidth),
  height: Math.max(1, window.innerHeight),
});

export default function LatticeFocusViewer({ entry, getReturnRectangle, onClosed, originRectangle, returnFocus }) {
  const rootRef = useRef(null);
  const closeRef = useRef(null);
  const origin = useMemo(() => normalizeViewerRectangle(originRectangle, 'originRectangle'), [originRectangle]);
  const [phase, setPhase] = useState('starting');
  const [viewport, setViewport] = useState(viewportSize);
  const [returnRectangle, setReturnRectangle] = useState(origin);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const focusedRectangle = focusedViewerRectangle(origin, viewport);
  const destination = phase === 'starting'
    ? origin
    : phase === 'closing'
      ? returnRectangle
      : focusedRectangle;
  const transform = viewerTransform(origin, destination);

  useLayoutEffect(() => {
    if (reducedMotion) {
      setPhase('open');
      return undefined;
    }
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setPhase('opening'));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
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
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [returnFocus]);

  const requestClose = useCallback(() => {
    if (phase !== 'open') return;
    const liveRectangle = getReturnRectangle?.();
    if (reducedMotion) {
      onClosed();
      return;
    }
    setReturnRectangle(liveRectangle ? normalizeViewerRectangle(liveRectangle, 'returnRectangle') : origin);
    setPhase('closing');
  }, [getReturnRectangle, onClosed, origin, phase, reducedMotion]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
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

  return createPortal(
    <section
      aria-label={`${entry.media.accessibleLabel || 'Artwork'} focus viewer`}
      aria-modal="true"
      className="lattice-focus-viewer"
      data-lattice-focus-viewer
      data-phase={phase}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      ref={rootRef}
      role="dialog"
    >
      <div
        className="lattice-focus-viewer__artwork"
        onTransitionEnd={handleTransitionEnd}
        style={{
          left: origin.left,
          top: origin.top,
          width: origin.width,
          height: origin.height,
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
        }}
      >
        <LatticeArtworkPresentation entry={entry} />
      </div>
      <button
        aria-label="Close artwork viewer"
        aria-disabled={phase !== 'open'}
        className="lattice-focus-viewer__close"
        data-disabled={phase !== 'open' || undefined}
        onClick={requestClose}
        ref={closeRef}
        type="button"
      >×</button>
    </section>,
    document.body,
  );
}
