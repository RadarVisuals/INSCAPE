import { useId } from 'react';
import { moduleGrainStyle } from '../systemWorkflow/domain/moduleSurfaceAppearance.js';
import './shapes.css';

// Appearance belongs to the Shape. Editor and Reception paint the same record.
export default function ShapeSurface({ record, children, radius = 0, hideOutline = false }) {
  const pattern = useId().replaceAll(':', '');
  const kind = record.kind || 'rectangle';
  const borderRadius = radius || undefined;
  return <div className="shape-paint" style={{ filter: record.blur ? `blur(calc(${record.blur}px * var(--workbench-content-scale, 1)))` : undefined }}>
    <div className="shape-fill" data-shape-kind={kind} style={{ backgroundColor: kind === 'grid' ? 'transparent' : record.color,
      color: record.color, opacity: record.opacity, borderRadius, ...moduleGrainStyle(record.grain),
      ...(record.grid ? { '--shape-grid-spacing': `${record.grid.spacing}px`, '--shape-grid-line': `${record.grid.lineWidth}px` } : {}),
      ...(record.texture ? { '--shape-noise-scale': record.texture.scale } : {}) }}>
      {children || (kind === 'grid' && <svg className="shape-grid-paint" aria-hidden="true" width="100%" height="100%">
        <defs><pattern id={pattern} width={record.grid.spacing} height={record.grid.spacing} patternUnits="userSpaceOnUse">
          <path d={`M0,${record.grid.spacing}V0H${record.grid.spacing}`} fill="none" stroke="currentColor" strokeWidth={record.grid.lineWidth * 2} />
        </pattern></defs><rect width="100%" height="100%" fill={`url(#${pattern})`} />
      </svg>)}
      {kind === 'rectangle' && record.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
    </div>
    {!hideOutline && kind === 'rectangle' && record.outline?.width > 0 && <span className="shape-outline" aria-hidden="true" style={{ borderRadius,
      opacity: record.outline.opacity, boxShadow: `inset 0 0 0 calc(${record.outline.width}px * var(--workbench-content-scale, 1)) ${record.outline.color}` }} />}
  </div>;
}
