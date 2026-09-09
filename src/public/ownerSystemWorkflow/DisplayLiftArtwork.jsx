import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { focusedViewerRectangle, focusViewerPresentationDimensions } from '../../lattice/rendering/latticeFocusViewer.js';
import { interpolateLatticeProductionFocusRectangle, latticeProductionFocusOpeningProgress,
  latticeProductionFocusTransitionProgress } from '../../lattice/rendering/latticeProductionFocusArtworkMotion.js';

// Presentation-only geometry in the Stage's local coordinates, including when
// its containing window is scaled. Authored placement geometry never changes.
export default function DisplayLiftArtwork({ scene, source, entry, closing, reducedMotion }) {
  const host = scene?.parentElement;
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

  useLayoutEffect(() => {
    if (reducedMotion) { setProgress(closing ? 0 : 1); return undefined; }
    let frame;
    const start = performance.now();
    // Closing can interrupt the opening animation without jumping to full size.
    const from = closing ? progress : 0;
    const duration = closing ? 260 : 460;
    const tick = now => {
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = closing ? latticeProductionFocusTransitionProgress(elapsed)
        : latticeProductionFocusOpeningProgress(elapsed);
      setProgress(closing ? from * (1 - eased) : eased);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };
    if (!closing) setProgress(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [closing, reducedMotion, entry.placement.id]);

  if (!geometry || !host) return null;
  const currentRectangle = interpolateLatticeProductionFocusRectangle(
    geometry.sourceRectangle, geometry.focusedRectangle, progress);
  return createPortal(<div aria-hidden="true" className="system-workflow__lift-artwork"
    style={currentRectangle}>
    <LatticeProductionFocusArtwork entry={entry} motion={{ ...geometry, currentRectangle, progress }} />
  </div>, host);
}
