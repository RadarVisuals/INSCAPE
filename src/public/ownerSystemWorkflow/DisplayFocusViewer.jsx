import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function DisplayFocusViewer({ camera, controlsContainer, viewer }) {
  const latest = useRef(viewer); latest.current = viewer;
  const closeRef = useRef(null);
  const timer = useRef(null);
  const [closing, setClosing] = useState(false);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    const source = viewer.returnFocus;
    if (!camera || !source || closing) return undefined;
    camera.setAttribute('data-camera-focusing', '');
    source.setAttribute('data-camera-subject', '');
    return () => {
      camera.removeAttribute('data-camera-focusing');
      source.removeAttribute('data-camera-subject');
    };
  }, [camera, viewer.placementId, closing]);

  useLayoutEffect(() => {
    if (!camera || closing) return undefined;
    const frame = requestAnimationFrame(() => {
      const stage = camera.parentElement;
      const bounds = stage.getBoundingClientRect();
      const source = latest.current.getReturnRectangle();
      if (!source || !bounds.width || !bounds.height) return;
      const width = stage.clientWidth, height = stage.clientHeight;
      const pixelScale = bounds.width / width;
      // Read the current animated transform so artwork navigation can also
      // recover original scene coordinates during an unfinished camera move.
      const matrix = new DOMMatrixReadOnly(getComputedStyle(camera).transform);
      const x = ((source.left - bounds.left) / pixelScale - matrix.e) / matrix.a;
      const y = ((source.top - bounds.top) / pixelScale - matrix.f) / matrix.d;
      const w = source.width / pixelScale / matrix.a;
      const h = source.height / pixelScale / matrix.d;
      const fillsStage = w >= width * .9 && h >= height * .9;
      const zoom = fillsStage ? 1 : clamp(Math.min(width * .82 / w, height * .9 / h), 1.5, 3);
      const tx = clamp(width / 2 - (x + w / 2) * zoom, width * (1 - zoom), 0);
      // A placement cropped by the bottom of the Stage keeps that edge outside
      // the viewport, instead of exposing the portrait's unfinished silhouette.
      const desiredY = y + h >= height - 2 ? height - (y + h) * zoom : height / 2 - (y + h / 2) * zoom;
      const ty = clamp(desiredY, height * (1 - zoom), 0);
      camera.style.setProperty('--display-camera-transform', `translate(${tx}px, ${ty}px) scale(${zoom})`);
    });
    return () => cancelAnimationFrame(frame);
  }, [camera, viewer.placementId, closing]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(timer.current);
      camera?.style.removeProperty('--display-camera-transform');
    };
  }, [camera]);

  const close = () => {
    if (timer.current !== null) return;
    setClosing(true);
    latest.current.beginReturn?.();
    camera?.style.removeProperty('--display-camera-transform');
    timer.current = setTimeout(() => {
      const source = latest.current.returnFocus;
      latest.current.close();
      queueMicrotask(() => source?.isConnected && source.focus({ preventScroll: true }));
    }, reducedMotion ? 0 : 360);
  };
  useEffect(() => {
    const keydown = event => {
      if (event.defaultPrevented || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      else if (!closing && camera?.closest('article')?.contains(event.target)
        && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        latest.current.navigate(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  });
  if (!controlsContainer) return null;
  return createPortal(<div className="system-workflow__camera-controls" role="group" aria-label="Artwork inspection">
    <span>INSPECT</span>
    <button className="system-workflow__round-control" aria-label="Previous artwork" disabled={closing || viewer.total < 2}
      onClick={() => viewer.navigate(-1)} type="button"><ChevronLeft /></button>
    <span aria-live="polite">{String(viewer.position + 1).padStart(2, '0')} / {String(viewer.total).padStart(2, '0')}</span>
    <button className="system-workflow__round-control" aria-label="Next artwork" disabled={closing || viewer.total < 2}
      onClick={() => viewer.navigate(1)} type="button"><ChevronRight /></button>
    <button className="system-workflow__round-control" aria-label="Close artwork viewer" disabled={closing}
      onClick={close} ref={closeRef} type="button"><X /></button>
  </div>, controlsContainer);
}
