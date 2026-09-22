import { useEffect, useState } from 'react';
import { renderedSystemWorkflowCssTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectLatticeProductionFocusMediaMotion } from './latticeProductionFocusArtworkMotion.js';
import './latticeProductionFocusArtwork.css';

export default function LatticeProductionFocusArtwork({ entry, motion }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [entry.media.src]);
  const dimensions = entry.focusDimensions;
  const mediaMotion = projectLatticeProductionFocusMediaMotion(entry.placement, dimensions, motion);
  const mediaStyle = { ...mediaMotion.rectangle, transform: renderedSystemWorkflowCssTransform(mediaMotion) };
  const fallbackMedia = !failed && <img alt={entry.accessibleLabel} className="lattice-production-focus-artwork__media" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={entry.media.src} style={mediaStyle} />;
  return <div className="lattice-production-focus-artwork">
    <span className="lattice-production-focus-artwork__opening" style={{ inset: 0 }}>{fallbackMedia}</span>
    {failed && <span className="lattice-production-focus-artwork__unavailable">Artwork unavailable</span>}
  </div>;
}
