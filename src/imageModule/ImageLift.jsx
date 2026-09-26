import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DisplayLiftArtwork from '../public/ownerSystemWorkflow/DisplayLiftArtwork.jsx';
import { projectedSvgArtworkFor } from '../artwork/ProjectedSvgArtwork.jsx';

export default function ImageLift({ source, entry, reducedMotion, onClose }) {
  const [scene, setScene] = useState(null), [closing, setClosing] = useState(false);
  const returnButton = useRef(null), returnId = useId();
  const liveSvg = projectedSvgArtworkFor(source, entry.media.src);
  // Use the same stacking context as the retained Image window. The artwork
  // stays above the backdrop without elevating the rest of the Workbench.
  const overlayHost = source?.closest('.system-workflow') || document.body;
  useLayoutEffect(() => {
    if (!liveSvg) return undefined;
    const window = source.closest('.image-module__window');
    window?.setAttribute('data-svg-inspection', '');
    return () => window?.removeAttribute('data-svg-inspection');
  }, [source, liveSvg]);
  useEffect(() => () => { if (source?.isConnected) source.focus({ preventScroll: true }); }, [source]);
  return createPortal(<div className="image-lift" role="dialog" aria-modal="true" aria-label="Inspect Image" aria-owns={returnId}
    onClick={() => setClosing(true)} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setClosing(true); }
      if (event.key === 'Tab') { event.preventDefault(); returnButton.current?.focus(); }
    }}>
    <div ref={setScene} />
    <DisplayLiftArtwork scene={scene} source={source} entry={entry} closing={closing} reducedMotion={reducedMotion} onCloseComplete={onClose} />
    {createPortal(<button id={returnId} ref={returnButton} className="image-lift-return" type="button" autoFocus
      onClick={() => setClosing(true)}>Return to Image</button>, overlayHost)}
  </div>, overlayHost);
}
