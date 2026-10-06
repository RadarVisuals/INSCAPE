import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ArtworkSvgDocument from './ArtworkSvgDocument.jsx';
import { useArtworkPreparation } from './ArtworkPreparation.jsx';
import { useArtworkGeometry } from './ArtworkGeometry.jsx';
import { useArtworkVisibility } from './useArtworkVisibility.js';

// Each mounted artwork owns its document and keeps it in the same DOM location.
// Lift supplies temporary projection only; the registry ends with its owner.
const artworkHosts = new WeakMap();
const projectionMatrix = (rect, viewport) => {
  const rotation = new DOMMatrix(!rect.transform || rect.transform === 'none' ? undefined : rect.transform);
  const matrix = new DOMMatrix().translate(rect.left + rect.width / 2, rect.top + rect.height / 2)
    .multiply(rotation).translate(-rect.width / 2, -rect.height / 2)
    .scale(rect.width / viewport.width, rect.height / viewport.height);
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
};
const liftStyles = ({ mediaStyle, rectangle, viewport }, nativeViewport) => ({
  transform: projectionMatrix(mediaStyle, nativeViewport),
  clipPath: `inset(${rectangle.top}px ${viewport.width - rectangle.left - rectangle.width}px ${viewport.height - rectangle.top - rectangle.height}px ${rectangle.left}px)`,
});
export function projectedSvgArtworkFor(source, src) {
  const artwork = artworkHosts.get(source?.querySelector('[data-svg-artwork-host]'));
  return artwork?.src === src ? artwork : null;
}

// Geometry belongs to the containing module. One SVG viewport clips the
// artwork document after applying that module's existing media transform.
export default function ProjectedSvgArtwork({ src, width, height, dimensions, mediaStyle, onReady }) {
  const root = useRef(null);
  const media = useRef(null);
  const host = useRef(null);
  const [paintHost] = useState(() => {
    const node = document.createElement('span'); node.className = 'artwork-svg-paint'; return node;
  });
  const [lift, setLift] = useState(null);
  const viewportRef = useRef(null);
  const loaded = useRef(false), liftReady = useRef(null);
  const documentControls = useRef(null);
  const visible = useArtworkVisibility(root);
  const prepared = useArtworkPreparation();
  const geometry = useArtworkGeometry();
  const updatePixelScale = () => {
    // Camera motion has already prepared its largest layout. Measuring its
    // temporary shrinking transform would replace those pixels with a thumbnail.
    if (geometry.isProjected()) return;
    const matrix = media.current?.getScreenCTM();
    if (matrix) documentControls.current?.setPixelScale(Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) * (devicePixelRatio || 1));
  };
  // Module geometry changes at resize/zoom endpoints; never resample per motion
  // frame. Inspection uses original pixels until its explicit release.
  useLayoutEffect(updatePixelScale);
  useLayoutEffect(() => geometry.subscribe(updatePixelScale), [geometry]);
  useLayoutEffect(() => {
    // Image content is memoized in authored coordinates; zoom resizes its outer
    // viewport without rendering this component. Measure that real viewport.
    const observer = new ResizeObserver(updatePixelScale);
    observer.observe(root.current);
    addEventListener('resize', updatePixelScale);
    return () => { observer.disconnect(); removeEventListener('resize', updatePixelScale); };
  }, [geometry]);
  useLayoutEffect(() => {
    const home = host.current;
    let active = true, target = null;
    loaded.current = false;
    home.appendChild(paintHost);
    const paint = projection => {
      if (!active || !target) return;
      // Update the foreignObject and its crop together during SVG painting.
      // Separate browser animation effects can move the document beyond its
      // painted clip during transit, even when their endpoint geometry agrees.
      const style = liftStyles(projection, viewportRef.current);
      media.current.style.transform = style.transform;
      paintHost.style.clipPath = style.clipPath;
    };
    artworkHosts.set(home, {
      src,
      paint,
      prepareImages: () => loaded.current ? documentControls.current?.prepareInspection() : undefined,
      releaseImages: () => { if (!target) documentControls.current?.releaseInspection(); },
      prepare(destination, onReady, prepareImages = false) {
        target = destination;
        const prepare = async () => {
          if (prepareImages) await documentControls.current?.prepareInspection();
          if (active && liftReady.current === prepare) documentControls.current?.beginInspection();
          if (active && liftReady.current === prepare) onReady();
        };
        liftReady.current = prepare;
        // Fixed positioning escapes the placement's crop without moving its
        // document. Display's transformed rail / Image's transformed window
        // remains the containing block, and the module keeps its outer clip.
        paintHost.style.position = 'fixed';
        paintHost.style.inset = '0 auto auto 0';
        paintHost.style.transformOrigin = '0 0';
        if (loaded.current) prepare();
        return () => {
          target = null;
          liftReady.current = null;
          documentControls.current?.releaseInspection();
          paintHost.removeAttribute('style');
          media.current?.style.removeProperty('transform');
          if (active) setLift(null);
        };
      },
      project(projection) {
        if (!active || !target) return;
        setLift(projection.viewport);
        // Map the inspection viewport into the unchanged containing block.
        // Both may be scaled (Workbench zoom, Image density, Display zoom).
        // Measure only when geometry changes, never on animation frames.
        paintHost.style.width = `${projection.viewport.width}px`;
        paintHost.style.height = `${projection.viewport.height}px`;
        paintHost.style.transform = 'none';
        const local = paintHost.getBoundingClientRect();
        const destination = target.getBoundingClientRect();
        const scaleX = local.width / projection.viewport.width;
        const scaleY = local.height / projection.viewport.height;
        if (!(scaleX > 0 && scaleY > 0)) return;
        paintHost.style.transform = `translate(${(destination.left - local.left) / scaleX}px, ${(destination.top - local.top) / scaleY}px) scale(${destination.width / local.width}, ${destination.height / local.height})`;
        paint(projection);
      },
    });
    return () => {
      active = false; target = null; liftReady.current = null;
      artworkHosts.delete(home); paintHost.remove();
    };
  }, [paintHost, src]);
  useLayoutEffect(() => { if (!visible && !prepared && !lift) loaded.current = false; }, [visible, prepared, lift]);
  const rect = mediaStyle || { left: 0, top: 0, width, height };
  // Keep the document in native media coordinates. Resizing its iframe during
  // Lift reflows SVG content/scripts instead of scaling the artwork as a unit.
  const viewport = dimensions?.width > 0 && dimensions?.height > 0 ? dimensions : rect;
  viewportRef.current = viewport;
  const transform = projectionMatrix(rect, viewport);
  // Resize and Lift both project the same native-size foreignObject. The
  // outer SVG only supplies the viewport; opening no longer transfers the
  // transform to a newly promoted, native-size outer SVG layer.
  const svgWidth = lift ? lift.width : width;
  const svgHeight = lift ? lift.height : height;
  return <span ref={host} className="artwork-svg-host" data-svg-artwork-host>{createPortal(
    <svg ref={root} className="artwork-svg-viewport" data-interactive-svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
      <foreignObject ref={media} width={viewport.width} height={viewport.height} transform={transform}>
        {(visible || prepared || lift) && <ArtworkSvgDocument key={src} src={src} stretch paintOnly onReady={controls => {
          documentControls.current = controls; updatePixelScale();
          loaded.current = true; liftReady.current?.(); onReady?.();
        }} />}
      </foreignObject>
    </svg>, paintHost)}</span>;
}
