import { useEffect, useState } from 'react';
import { renderedSystemWorkflowCssTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectArtworkMat } from './latticeMat.js';
import { projectLatticeProductionFocusMediaMotion } from './latticeProductionFocusArtworkMotion.js';
import './latticeProductionFocusArtwork.css';

const percentRectangle = (rectangle, footprint) => ({
  left: `${((rectangle.left - footprint.left) / footprint.width) * 100}%`,
  top: `${((rectangle.top - footprint.top) / footprint.height) * 100}%`,
  width: `${(rectangle.width / footprint.width) * 100}%`,
  height: `${(rectangle.height / footprint.height) * 100}%`,
});

export default function LatticeProductionFocusArtwork({ entry, motion }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [entry.media.src]);
  const dimensions = entry.focusDimensions;
  const footprint = { left: 0, top: 0, width: 100, height: 100 };
  const presentation = projectArtworkMat(footprint, entry.placement.mat);
  const mediaMotion = projectLatticeProductionFocusMediaMotion(entry.placement, dimensions, motion);
  const background = entry.placement.backing.enabled ? entry.placement.backing.color
    : entry.placement.transparencyMode === 'OPAQUE' ? '#d8d4ca' : 'transparent';
  return <div className="lattice-production-focus-artwork">
    {presentation.backplateRectangle && <span className="lattice-production-focus-artwork__mat" style={{ backgroundColor: presentation.mat.color }} />}
    <span className="lattice-production-focus-artwork__opening" style={{ ...percentRectangle(presentation.mediaOpeningRectangle, footprint), backgroundColor: background }} />
    {!failed && <img alt={entry.accessibleLabel} className="lattice-production-focus-artwork__media" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={entry.media.src}
      style={{ ...mediaMotion.rectangle, transform: renderedSystemWorkflowCssTransform(mediaMotion) }} />}
    {failed && <span className="lattice-production-focus-artwork__unavailable">Artwork unavailable</span>}
  </div>;
}
