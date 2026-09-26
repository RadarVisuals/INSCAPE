import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { displayLiftRectangle } from './displayLiftGeometry.js';
import { interpolateLatticeProductionFocusRectangle, latticeProductionFocusOpeningProgress,
  projectLatticeProductionFocusMediaMotion, LATTICE_PRODUCTION_FOCUS_OPENING_MS } from '../../lattice/rendering/latticeProductionFocusArtworkMotion.js';
import { renderedSystemWorkflowCssTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectedSvgArtworkFor } from '../../artwork/ProjectedSvgArtwork.jsx';

const svgProjection = (entry, geometry, progress) => {
  const rectangle = interpolateLatticeProductionFocusRectangle(geometry.sourceRectangle, geometry.focusedRectangle, progress);
  const media = projectLatticeProductionFocusMediaMotion(entry.placement, entry.focusDimensions, { ...geometry, currentRectangle: rectangle, progress });
  return { rectangle, viewport: geometry.viewport,
    mediaStyle: { ...media.rectangle, left: media.rectangle.left + rectangle.left,
      top: media.rectangle.top + rectangle.top, transform: renderedSystemWorkflowCssTransform(media) } };
};

// Presentation-only geometry in the Stage's local coordinates, including when
// its containing window is scaled. Authored placement geometry never changes.
export default function DisplayLiftArtwork({ scene, source, entry, closing, reducedMotion, onCloseComplete }) {
  const host = scene?.parentElement;
  const liveSvg = projectedSvgArtworkFor(source, entry.media.src);
  const artworkRef = useRef(null);
  const completeRef = useRef(onCloseComplete); completeRef.current = onCloseComplete;
  const progressRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [geometry, setGeometry] = useState(null);
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0);
  // The backdrop follows the same clock as the artwork, including interrupted
  // opening and reduced motion. It never starts before the media is ready.
  useLayoutEffect(() => {
    if (!liveSvg) host?.style.setProperty('--inspection-lift-progress', String(ready ? progress : 0));
  }, [host, ready, progress, liveSvg]);
  useLayoutEffect(() => {
    if (!host) return;
    scene.setAttribute('data-inspection-lift', '');
    return () => { host.style.removeProperty('--inspection-lift-progress'); scene.removeAttribute('data-inspection-lift'); };
  }, [host, scene]);
  useLayoutEffect(() => {
    if (!host || !source) return undefined;
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      const origin = source.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !origin.width || !origin.height) return;
      // clientWidth/clientHeight round to whole layout pixels. That changes
      // the return edge when the Display has a fractional size or camera zoom.
      // This borderless Stage uses its actual local box for both directions.
      const style = getComputedStyle(host);
      const width = parseFloat(style.width), height = parseFloat(style.height);
      if (!(width > 0 && height > 0)) return;
      const scaleX = width / bounds.width;
      const scaleY = height / bounds.height;
      const sourceRectangle = { left: (origin.left - bounds.left) * scaleX,
        top: (origin.top - bounds.top) * scaleY, width: origin.width * scaleX, height: origin.height * scaleY };
      const next = { viewport: { width, height }, sourceRectangle, focusedRectangle: displayLiftRectangle(entry, { width, height }) };
      setGeometry(previous => previous && Object.keys(next).every(key =>
        Object.keys(next[key]).every(axis => next[key][axis] === previous[key][axis])) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(source);
    return () => observer.disconnect();
  }, [host, source, entry]);

  const hasGeometry = Boolean(geometry);
  const sourceMedia = liveSvg && geometry ? svgProjection(entry, geometry, 0).mediaStyle : null;
  const focusedMedia = liveSvg && geometry ? svgProjection(entry, geometry, 1).mediaStyle : null;
  const prepareSvgImages = Boolean(!reducedMotion && sourceMedia && (focusedMedia.width > sourceMedia.width || focusedMedia.height > sourceMedia.height));
  useLayoutEffect(() => {
    if (!hasGeometry || !liveSvg || !source || !host?.contains(source)) return undefined;
    // Keep the document in its placement. Lift that placement and its Grid
    // above their siblings while keeping the Display's outer stacking/clip.
    const plane = source.closest('.system-workflow__grid-plane, .visitor-grid-world__grid-plane');
    const restore = [source, plane].filter(Boolean).map(node => {
      const value = node.style.getPropertyValue('z-index');
      const priority = node.style.getPropertyPriority('z-index');
      const layers = [...node.parentElement.children].map(sibling => Number(getComputedStyle(sibling).zIndex) || 0);
      node.style.setProperty('z-index', String(Math.max(0, ...layers) + 1));
      return () => value ? node.style.setProperty('z-index', value, priority) : node.style.removeProperty('z-index');
    });
    return () => restore.forEach(reset => reset());
  }, [hasGeometry, liveSvg, source, host]);
  useLayoutEffect(() => {
    if (!hasGeometry || !liveSvg) return undefined;
    return liveSvg.prepare(artworkRef.current, () => setReady(true), prepareSvgImages);
  }, [hasGeometry, liveSvg, prepareSvgImages]);
  useLayoutEffect(() => {
    if (!geometry || !liveSvg) return;
    liveSvg.project(svgProjection(entry, geometry, progressRef.current));
  }, [geometry, liveSvg, entry]);
  useLayoutEffect(() => {
    if (liveSvg) return undefined;
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
  }, [hasGeometry, entry.media.src, liveSvg]);

  useLayoutEffect(() => {
    if (!ready || !source || liveSvg) return undefined;
    // Hide only once the replacement is decoded, and restore in the same
    // commit that removes the replacement. Keep this separate from dimming.
    source.setAttribute('data-lift-source', '');
    return () => source.removeAttribute('data-lift-source');
  }, [ready, source, liveSvg]);

  useLayoutEffect(() => {
    if (!ready || !geometry) {
      if (closing) completeRef.current();
      return undefined;
    }
    const paintProgress = value => {
      progressRef.current = value;
      if (liveSvg) {
        liveSvg.paint(svgProjection(entry, geometry, value));
        host.style.setProperty('--inspection-lift-progress', String(value));
      }
      else setProgress(value);
    };
    if (reducedMotion) {
      paintProgress(closing ? 0 : 1);
      if (closing) completeRef.current();
      return undefined;
    }
    let frame;
    const start = performance.now();
    // Closing can interrupt the opening animation without jumping to full size.
    const from = progressRef.current, to = closing ? 0 : 1;
    const duration = LATTICE_PRODUCTION_FOCUS_OPENING_MS;
    const sample = now => {
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = latticeProductionFocusOpeningProgress(elapsed);
      const value = from + (to - from) * eased;
      paintProgress(value);
      return elapsed;
    };
    const tick = now => {
      const elapsed = sample(now);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
      else if (closing) frame = requestAnimationFrame(() => completeRef.current());
    };
    paintProgress(from);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      // The last painted progress is already the visible pose. An interrupted
      // return resumes there without advancing an independent animation clock.
    };
  }, [closing, reducedMotion, entry, ready, geometry, host, liveSvg]);

  if (!geometry || !host) return null;
  const currentRectangle = interpolateLatticeProductionFocusRectangle(
    geometry.sourceRectangle, geometry.focusedRectangle, progress);
  return createPortal(<div aria-hidden="true" className="system-workflow__lift-artwork"
    ref={artworkRef} style={{ ...(liveSvg ? { left: 0, top: 0, ...geometry.viewport } : currentRectangle), visibility: ready || liveSvg ? 'visible' : 'hidden' }}>
    {!liveSvg && <LatticeProductionFocusArtwork entry={entry} onArtworkReady={() => setReady(true)} motion={{ ...geometry, currentRectangle, progress }}
      displayOpening={Boolean(source?.closest('.system-workflow__presentation-board'))} />}
  </div>, host);
}
