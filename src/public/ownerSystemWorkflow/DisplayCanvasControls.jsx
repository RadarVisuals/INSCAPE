import { SYSTEM_WORKFLOW_SURFACE_IDS } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { displayGuideMode } from '../../systemWorkflow/domain/displayAppearance.js';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import './moduleSurface.css';
import './displayCanvasControls.css';

// The same controls edit a temporary setup form or the targeted Display session.
export default function DisplayCanvasControls({ appearance, onChange, error }) {
  return <fieldset className="module-surface-controls display-canvas-controls">
    <legend>Background and grid</legend>
    <div className="display-canvas-colour">
      <label>Background preset<select value={appearance.backgroundColor ? 'custom' : appearance.surfaceId}
        onChange={event => event.target.value !== 'custom' && onChange({ surfaceId: event.target.value, backgroundColor: null })}>
        {appearance.backgroundColor && <option value="custom">Custom</option>}
        {SYSTEM_WORKFLOW_SURFACE_IDS.map(id => <option key={id} value={id}>{id.charAt(0).toUpperCase() + id.slice(1)}</option>)}
      </select></label>
      <label>Colour<input aria-label="Background colour" type="color" value={appearance.backgroundColor || latticeSurfaceColor(appearance.surfaceId)}
        onChange={event => onChange({ backgroundColor: event.target.value })} /></label>
    </div>
    <label className="module-surface-check"><input type="checkbox" checked={appearance.snapToGrid !== false}
      onChange={event => onChange({ snapToGrid: event.target.checked })} />Snap to grid</label>
    <label className="module-surface-check"><input type="checkbox" checked={displayGuideMode(appearance) !== 'NONE'}
      onChange={event => onChange({ guideVisible: event.target.checked, ...(appearance.guideMode === 'NONE' && event.target.checked ? { guideMode: 'LINES' } : {}) })} />Show grid</label>
    <div className="display-canvas-colour">
      <label>Grid style<select value={appearance.guideMode === 'NONE' ? 'LINES' : appearance.guideMode}
        onChange={event => onChange({ guideMode: event.target.value, ...(appearance.guideMode === 'NONE' ? { guideVisible: false } : {}) })}>
        <option value="LINES">Lines</option><option value="DOTS">Dots</option>
      </select></label>
      <label>Colour<input aria-label="Grid colour" type="color" value={appearance.guideColor} onChange={event => onChange({ guideColor: event.target.value })} /></label>
    </div>
    <label className="module-grain-control">Grid spacing<input aria-label="Grid spacing" type="range" min="-8" max="8" step="1" value={appearance.guideSize}
      onChange={event => onChange({ guideSize: Number(event.target.value) })} />
      <output>{appearance.guideSize > 0 ? '+' : ''}{appearance.guideSize} {appearance.guideSize < 0 ? 'Fine' : appearance.guideSize > 0 ? 'Coarse' : 'Base'}</output>
    </label>
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
