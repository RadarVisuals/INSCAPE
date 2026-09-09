import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

function markPointerReturn(node) {
  if (node.hasAttribute('data-inspection-pointer-focus')) return;
  node.setAttribute('data-inspection-pointer-focus', '');
  const clear = () => {
    node.removeAttribute('data-inspection-pointer-focus');
    node.removeEventListener('blur', clear);
    node.removeEventListener('keydown', clear);
  };
  node.addEventListener('blur', clear, { once: true });
  node.addEventListener('keydown', clear, { once: true });
}

export default function DisplayFocusViewer({ scene, controlsContainer, viewer }) {
  const latest = useRef(viewer); latest.current = viewer;
  const closeRef = useRef(null);
  const timer = useRef(null);
  const [closing, setClosing] = useState(false);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    const source = viewer.returnFocus;
    if (!scene || !source || closing) return undefined;
    // Both renderers place artwork in sibling elements with explicit z-order.
    // Change only temporary presentation; retain the authored geometry/order.
    const siblings = [...source.parentElement.children].filter(node =>
      node.matches('.system-workflow__placement, .lattice-production-placement'));
    const ordered = siblings.map((node, index) => ({ node, index, layer: Number(getComputedStyle(node).zIndex) || 0 }))
      .sort((a, b) => a.layer - b.layer || a.index - b.index);
    const selectedIndex = ordered.findIndex(item => item.node === source);
    if (selectedIndex < 0) return undefined;
    ordered.forEach(({ node }, index) => {
      if (node !== source) node.setAttribute('data-inspection-context', index > selectedIndex ? 'foreground' : 'background');
    });
    return () => siblings.forEach(node => node.removeAttribute('data-inspection-context'));
  }, [scene, viewer.placementId, closing]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(timer.current);
    };
  }, [scene]);

  const close = (input = 'keyboard') => {
    if (timer.current !== null) return;
    setClosing(true);
    latest.current.beginReturn?.();
    timer.current = setTimeout(() => {
      const source = latest.current.returnFocus;
      latest.current.close();
      queueMicrotask(() => {
        if (!source?.isConnected) return;
        if (input === 'pointer') markPointerReturn(source);
        source.focus({ preventScroll: true });
      });
    }, reducedMotion ? 0 : 260);
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
  return <>{scene?.parentElement && createPortal(<div aria-hidden="true" className="system-workflow__inspection-hit-surface"
    onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }}
    onClick={event => {
      event.preventDefault(); event.stopPropagation();
      if (event.button === 0) close('pointer');
    }} onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); }} />, scene.parentElement)}
  {createPortal(<div className="system-workflow__scene-controls" role="group" aria-label="Artwork inspection">
    <span>INSPECT</span>
    <button className="system-workflow__round-control" aria-label="Previous artwork" disabled={closing || viewer.total < 2}
      onClick={() => viewer.navigate(-1)} type="button"><ChevronLeft /></button>
    <span aria-live="polite">{String(viewer.position + 1).padStart(2, '0')} / {String(viewer.total).padStart(2, '0')}</span>
    <button className="system-workflow__round-control" aria-label="Next artwork" disabled={closing || viewer.total < 2}
      onClick={() => viewer.navigate(1)} type="button"><ChevronRight /></button>
    <button className="system-workflow__round-control" aria-label="Close artwork viewer" disabled={closing}
      onClick={event => close(event.detail === 0 ? 'keyboard' : 'pointer')} ref={closeRef} type="button"><X /></button>
  </div>, controlsContainer)}</>;
}
