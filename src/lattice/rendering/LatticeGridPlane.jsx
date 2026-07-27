import React from 'react';

import { normalizeLatticeSurface, semanticGridVariables } from './latticeGeometry.js';
import './latticeTableRenderer.css';

export default function LatticeGridPlane({
  artboard,
  children,
  className = '',
  geometry,
  stageOrigin,
  style,
  surfaceId = 'carbon',
  viewport,
}) {
  return (
    <div
      className={`lattice-grid-plane ${className}`.trim()}
      data-surface={normalizeLatticeSurface(surfaceId)}
      style={{ ...style, ...semanticGridVariables(geometry, viewport, stageOrigin, artboard) }}
    >
      {children}
    </div>
  );
}
