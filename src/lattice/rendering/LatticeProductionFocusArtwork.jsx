import { useEffect, useState } from 'react';
import { projectLatticeProductionArtwork } from './latticeProductionProjection.js';
import './latticeProductionFocusArtwork.css';

const percentRectangle = (rectangle, footprint) => ({
  left: `${((rectangle.left - footprint.left) / footprint.width) * 100}%`,
  top: `${((rectangle.top - footprint.top) / footprint.height) * 100}%`,
  width: `${(rectangle.width / footprint.width) * 100}%`,
  height: `${(rectangle.height / footprint.height) * 100}%`,
});

export default function LatticeProductionFocusArtwork({ entry, focused, phase }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [entry.media.src]);
  const dimensions = entry.focusDimensions;
  const field = { left: 0, top: 0, cellSize: 100 };
  const artwork = projectLatticeProductionArtwork(entry.placement, field, dimensions);
  const background = entry.placement.backing.enabled ? entry.placement.backing.color
    : entry.placement.transparencyMode === 'OPAQUE' ? '#d8d4ca' : 'transparent';
  return <div className="lattice-production-focus-artwork" data-focused={focused || undefined} data-phase={phase}>
    <div className="lattice-production-focus-artwork__authored">
      {artwork.backplateRectangle && <span className="lattice-production-focus-artwork__mat" style={{ backgroundColor: artwork.mat.color }} />}
      <span className="lattice-production-focus-artwork__opening" style={{
        ...percentRectangle(artwork.mediaOpeningRectangle, artwork.footprint), backgroundColor: background,
      }}>
        <img alt="" draggable="false" src={entry.media.src} style={{
          ...percentRectangle(artwork.imageRenderRectangle, artwork.mediaOpeningRectangle),
          transform: artwork.imageTransform,
          transformOrigin: 'center',
        }} />
      </span>
    </div>
    <div className="lattice-production-focus-artwork__native">
      {!failed && <img alt={entry.accessibleLabel} decoding="async" draggable="false" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={entry.media.src} />}
      {failed && <span role="status">ARTWORK UNAVAILABLE</span>}
    </div>
  </div>;
}
