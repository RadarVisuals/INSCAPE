import React from 'react';

import { projectCanonicalLatticeArtboard } from './latticeGeometry.js';
import './latticeAlignmentGuides.css';

export default function LatticeAlignmentGuides({ artboard, guides = [], viewport }) {
  if (!guides.length) return null;
  const field = projectCanonicalLatticeArtboard(artboard, viewport);
  return (
    <div className="lattice-alignment-guides" aria-hidden="true">
      {guides.map((guide) => guide.axis === 'x' ? (
        <span
          className="lattice-alignment-guide is-vertical"
          data-guide-kind={guide.kind}
          key={`x:${guide.position}`}
          style={{ left: field.left + (field.width * guide.position), top: field.top, height: field.height }}
        />
      ) : (
        <span
          className="lattice-alignment-guide is-horizontal"
          data-guide-kind={guide.kind}
          key={`y:${guide.position}`}
          style={{ left: field.left, top: field.top + (field.height * guide.position), width: field.width }}
        />
      ))}
    </div>
  );
}

