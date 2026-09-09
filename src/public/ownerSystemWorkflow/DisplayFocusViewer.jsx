import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import DisplayLiftArtwork from './DisplayLiftArtwork.jsx';

export default function DisplayFocusViewer({ scene, controlsContainer, viewer }) {
  const latest = useRef(viewer); latest.current = viewer;
  const closeRef = useRef(null);
  const timer = useRef(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const lift = viewer.entry?.placement.inspectionMode === 'LIFT';

  useLayoutEffect(() => {
    const source = viewer.returnFocus;
    if (!scene || !source) return undefined;
    // Both renderers place artwork in sibling elements with explicit z-order.
    // Change only temporary presentation; retain the authored geometry/order.
    const siblings = [...source.parentElement.children].filter(node =>
      node.matches('.system-workflow__placement, .lattice-production-placement'));
    const ordered = siblings.map((node, index) => ({ node, index, layer: Number(getComputedStyle(node).zIndex) || 0 }))
      .sort((a, b) => a.layer - b.layer || a.index - b.index);
    const selectedIndex = ordered.findIndex(item => item.node === source);
    if (selectedIndex < 0) return undefined;
    ordered.forEach(({ node }, index) => {
      node.setAttribute('data-inspection-context', node === source ? 'selected'
        : !lift && index > selectedIndex ? 'foreground' : 'background');
    });
    return () => siblings.forEach(node => node.removeAttribute('data-inspection-context'));
  }, [scene, viewer.placementId, lift]);

  useLayoutEffect(() => {
    if (!scene) return undefined;
    // Retain placement roles throughout restoration. Only change the fade
    // target, so the selected artwork never joins the dimmed group on close.
    scene.setAttribute('data-inspection-phase', closing ? 'closing' : 'active');
    return () => scene.removeAttribute('data-inspection-phase');
  }, [scene, closing]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(timer.current);
    };
  }, [scene]);

  const finishClose = () => {
    const source = latest.current.returnFocus;
    latest.current.close();
    queueMicrotask(() => {
      if (source?.isConnected) source.focus({ preventScroll: true });
    });
  };
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    latest.current.beginReturn?.();
    if (!lift) timer.current = setTimeout(finishClose, reducedMotion ? 0 : 360);
  };
  useEffect(() => {
    const keydown = event => {
      if (event.defaultPrevented || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      else if (!closing && scene?.closest('article')?.contains(event.target)
        && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        latest.current.navigate(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  });
  if (!controlsContainer) return null;
  return <>{lift && <DisplayLiftArtwork key={viewer.placementId} scene={scene} source={viewer.returnFocus}
    entry={viewer.entry} closing={closing} reducedMotion={reducedMotion} onCloseComplete={finishClose} />}
  {scene?.parentElement && createPortal(<div aria-hidden="true" className="system-workflow__inspection-hit-surface"
    onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }}
    onClick={event => {
      event.preventDefault(); event.stopPropagation();
      if (event.button === 0) close();
    }} onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); }} />, scene.parentElement)}
  {createPortal(<div className="system-workflow__scene-controls" role="group" aria-label="Artwork inspection">
    <span>INSPECT</span>
    <button className="system-workflow__round-control" aria-label="Previous artwork" disabled={closing || viewer.total < 2}
      onClick={() => viewer.navigate(-1)} type="button"><ChevronLeft /></button>
    <span aria-live="polite">{String(viewer.position + 1).padStart(2, '0')} / {String(viewer.total).padStart(2, '0')}</span>
    <button className="system-workflow__round-control" aria-label="Next artwork" disabled={closing || viewer.total < 2}
      onClick={() => viewer.navigate(1)} type="button"><ChevronRight /></button>
    <button className="system-workflow__round-control" aria-label="Close artwork viewer" disabled={closing}
      onClick={close} ref={closeRef} type="button"><X /></button>
  </div>, controlsContainer)}</>;
}
