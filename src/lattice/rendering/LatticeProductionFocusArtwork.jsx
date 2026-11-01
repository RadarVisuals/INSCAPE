import { useEffect, useState } from 'react';
import { renderedSystemWorkflowCssTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectLatticeProductionFocusMediaMotion } from './latticeProductionFocusArtworkMotion.js';
import './latticeProductionFocusArtwork.css';
import DisplayArtworkSurface from '../../public/ownerSystemWorkflow/DisplayArtworkSurface.jsx';
import useSvgArtwork from '../../artwork/useSvgArtwork.js';

export default function LatticeProductionFocusArtwork({ entry, motion, displayOpening = false, onArtworkReady }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [entry.media.src]);
  const dimensions = entry.focusDimensions;
  const svg = useSvgArtwork(entry.media.src);
  const mediaMotion = projectLatticeProductionFocusMediaMotion(entry.placement, dimensions, motion);
  const mediaStyle = { ...mediaMotion.rectangle, transform: renderedSystemWorkflowCssTransform(mediaMotion) };
  const fallbackMedia = !failed && <img alt={entry.accessibleLabel} className="lattice-production-focus-artwork__media" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={entry.media.src} style={mediaStyle} />;
  return <div className="lattice-production-focus-artwork">
    <span className="lattice-production-focus-artwork__opening" style={{ inset: 0 }}>
      {displayOpening || svg ? <DisplayArtworkSurface src={entry.media.src} onReady={onArtworkReady} width={motion.currentRectangle.width} height={motion.currentRectangle.height}
        dimensions={dimensions} mediaStyle={mediaStyle}>{fallbackMedia}</DisplayArtworkSurface> : fallbackMedia}
    </span>
    {failed && !svg && <span className="lattice-production-focus-artwork__unavailable">Artwork unavailable</span>}
  </div>;
}
