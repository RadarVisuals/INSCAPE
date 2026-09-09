import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { focusedViewerRectangle, focusViewerPresentationDimensions } from '../../lattice/rendering/latticeFocusViewer.js';
import { interpolateLatticeProductionFocusRectangle, latticeProductionFocusOpeningProgress,
  latticeProductionFocusTransitionProgress } from '../../lattice/rendering/latticeProductionFocusArtworkMotion.js';

// Presentation-only geometry in the Stage's local coordinates, including when
// its containing window is scaled. Authored placement geometry never changes.
export default function DisplayLiftArtwork({ scene, source, entry, closing, reducedMotion, onCloseComplete }) {
  const host = scene?.parentElement;
  const artworkRef = useRef(null);
  const completeRef = useRef(onCloseComplete); completeRef.current = onCloseComplete;
  const progressRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [geometry, setGeometry] = useState(null);
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0);
  useLayoutEffect(() => {
    if (!host || !source) return undefined;
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      const origin = source.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !origin.width || !origin.height) return;
      const scaleX = host.clientWidth / bounds.width;
      const scaleY = host.clientHeight / bounds.height;
      const sourceRectangle = { left: (origin.left - bounds.left) * scaleX,
        top: (origin.top - bounds.top) * scaleY, width: origin.width * scaleX, height: origin.height * scaleY };
      const dimensions = focusViewerPresentationDimensions(entry);
      setGeometry({ sourceRectangle, focusedRectangle: focusedViewerRectangle(
        { left: 0, top: 0, ...dimensions }, { width: host.clientWidth, height: host.clientHeight },
        { horizontalMargin: Math.min(32, host.clientWidth * .04),
          verticalMargin: Math.min(32, host.clientHeight * .04), verticalArtworkScale: 1 }) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(source);
    return () => observer.disconnect();
  }, [host, source, entry]);

  const hasGeometry = Boolean(geometry);
  useLayoutEffect(() => {
    const image = artworkRef.current?.querySelector('img');
    if (!image) return undefined;
    let disposed = false;
    setReady(false);
    const prepare = async () => {
      try {
        await image.decode();
        if (!disposed && image.naturalWidth > 0) setReady(true);
      } catch { /* Keep the original visible if this copy cannot be decoded. */ }
    };
    image.addEventListener('load', prepare);
    if (image.complete && image.naturalWidth > 0) prepare();
    return () => { disposed = true; image.removeEventListener('load', prepare); };
  }, [hasGeometry, entry.media.src]);

  useLayoutEffect(() => {
    if (!ready || !source) return undefined;
    // Hide only once the replacement is decoded, and restore in the same
    // commit that removes the replacement. Keep this separate from dimming.
    source.setAttribute('data-lift-source', '');
    return () => source.removeAttribute('data-lift-source');
  }, [ready, source]);

  useLayoutEffect(() => {
    if (!ready) {
      if (closing) completeRef.current();
      return undefined;
    }
    if (reducedMotion) {
      setProgress(closing ? 0 : 1);
      if (closing) completeRef.current();
      return undefined;
    }
    let frame;
    const start = performance.now();
    // Closing can interrupt the opening animation without jumping to full size.
    const from = closing ? progressRef.current : 0;
    const duration = closing ? 260 : 460;
    const tick = now => {
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = closing ? latticeProductionFocusTransitionProgress(elapsed)
        : latticeProductionFocusOpeningProgress(elapsed);
      progressRef.current = closing ? from * (1 - eased) : eased;
      setProgress(progressRef.current);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
      else if (closing) frame = requestAnimationFrame(() => completeRef.current());
    };
    if (!closing) setProgress(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [closing, reducedMotion, entry.placement.id, ready]);

  if (!geometry || !host) return null;
  const currentRectangle = interpolateLatticeProductionFocusRectangle(
    geometry.sourceRectangle, geometry.focusedRectangle, progress);
  return createPortal(<div aria-hidden="true" className="system-workflow__lift-artwork"
    ref={artworkRef} style={{ ...currentRectangle, visibility: ready ? 'visible' : 'hidden' }}>
    <LatticeProductionFocusArtwork entry={entry} motion={{ ...geometry, currentRectangle, progress }} />
  </div>, host);
}
