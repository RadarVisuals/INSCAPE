import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import LatticeProductionFocusArtwork from '../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { displayLiftRectangle } from '../public/ownerSystemWorkflow/displayLiftGeometry.js';
import { interpolateLatticeProductionFocusRectangle, animateLatticeProductionFocus,
  projectLatticeProductionFocusMediaMotion } from '../lattice/rendering/latticeProductionFocusArtworkMotion.js';
import { renderedSystemWorkflowCssTransform } from '../systemWorkflow/systemWorkflowTransform.js';
import { projectedSvgArtworkFor } from '../artwork/ProjectedSvgArtwork.jsx';

const svgProjection = (entry, geometry, progress) => {
  const rectangle = interpolateLatticeProductionFocusRectangle(geometry.sourceRectangle, geometry.focusedRectangle, progress);
  const media = projectLatticeProductionFocusMediaMotion(entry.placement, entry.focusDimensions, { ...geometry, currentRectangle: rectangle, progress });
  return { rectangle, viewport: geometry.viewport,
    mediaStyle: { ...media.rectangle, left: media.rectangle.left + rectangle.left,
      top: media.rectangle.top + rectangle.top, transform: renderedSystemWorkflowCssTransform(media) } };
};

// Presentation-only geometry in the Stage's local coordinates, including when
// its containing window is scaled. Authored placement geometry never changes.
export default function ImageLiftArtwork({ scene, source, entry, closing, reducedMotion, onCloseComplete }) {
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
    return () => { host?.style.removeProperty('--inspection-lift-progress'); scene.removeAttribute('data-inspection-lift'); };
  }, [host, scene]);
  useLayoutEffect(() => {
    if (!host || !source) return undefined;
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      const origin = source.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !origin.width || !origin.height) return;
      // clientWidth/clientHeight round to whole layout pixels. That changes
      // the return edge at fractional sizes or camera zoom.
      // This borderless Stage uses its actual local box for both directions.
      const style = getComputedStyle(host);
      const width = parseFloat(style.width), height = parseFloat(style.height);
      if (!(width > 0 && height > 0)) return;
      const scaleX = width / bounds.width;
      const scaleY = height / bounds.height;
      const sourceRectangle = { left: (origin.left - bounds.left) * scaleX,
        top: (origin.top - bounds.top) * scaleY, width: origin.width * scaleX, height: origin.height * scaleY };
      const focusedRectangle = displayLiftRectangle(entry, { width, height });
      const next = { viewport: { width, height }, sourceRectangle, focusedRectangle };
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
    if (!hasGeometry || !liveSvg) return undefined;
    setReady(false);
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
    return animateLatticeProductionFocus({ from: progressRef.current, to: closing ? 0 : 1, reducedMotion,
      paint: paintProgress, complete: closing ? () => completeRef.current() : undefined });
  }, [closing, reducedMotion, entry, ready, geometry, host, liveSvg]);

  if (!geometry || !host) return null;
  const currentRectangle = interpolateLatticeProductionFocusRectangle(
    geometry.sourceRectangle, geometry.focusedRectangle, progress);
  return createPortal(<div aria-hidden="true" className="system-workflow__lift-artwork"
    ref={artworkRef} style={{ ...(liveSvg ? { left: 0, top: 0, ...geometry.viewport } : currentRectangle), visibility: ready || liveSvg ? 'visible' : 'hidden' }}>
    {!liveSvg && <LatticeProductionFocusArtwork entry={entry} onArtworkReady={() => setReady(true)} motion={{ ...geometry, currentRectangle, progress }} />}
  </div>, host);
}
