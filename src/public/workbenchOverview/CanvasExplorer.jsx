import { useId, useMemo, useRef, useState } from 'react';
import { Scan, Minus, Plus, Maximize2, Minimize2, Info, Pencil } from 'lucide-react';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import useCanvasViewport from './useCanvasViewport.js';
import { canvasArtworkSources, canvasDestinations } from './canvasPresentationModel.js';
import { OwnerSystemWorkflowMetadataContent } from '../ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';

export default function CanvasExplorer({ selected, model, memory, disabled, expanded, onExpand, onEdit, onDetails }) {
  const host = useRef(null), helpId = useId();
  const [sourceId, setSourceId] = useState('');
  const destinations = useMemo(() => canvasDestinations(selected.draft).filter(item => item.view), [selected.draft]);
  const sources = useMemo(() => canvasArtworkSources(model), [model]);
  const source = sources.find(item => item.id === sourceId);
  const navigation = useCanvasViewport({ hostRef: host, area: model.area, destinations, memory, disabled });
  return <section className="composition-explorer" aria-label={`View ${selected.name}`}>
    <header className="composition-explorer-heading"><h1>{selected.name}</h1><div>
      {onEdit && <button type="button" onClick={() => onEdit(selected.id)} aria-label="Edit canvas"><Pencil size={15} /><span>Edit canvas</span></button>}
      <button type="button" onClick={onExpand} aria-label={expanded ? 'Return to index' : 'Expand canvas'} aria-pressed={expanded}>
        {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{expanded ? 'Return to index' : 'Expand'}</span>
      </button></div></header>
    <div ref={host} className="composition-explorer-viewport" tabIndex={0} role="group" aria-label={`${selected.name} canvas`}
      aria-describedby={helpId} onKeyDown={navigation.onKeyDown}
      data-camera-scale={navigation.camera?.scale} data-camera-x={navigation.camera?.offset.x} data-camera-y={navigation.camera?.offset.y}>
      <WorkbenchOverviewPreview model={model} name={selected.name} surfaceId={selected.draft.appearance.surfaceId}
        camera={navigation.camera} highlights={source?.frames} presenting />
    </div>
    <div className="composition-explorer-controls">
      <nav aria-label="Camera points"><button type="button" onClick={() => navigation.choose(null)} aria-label="Complete canvas" aria-pressed={navigation.fitted}><Scan size={16} /><span>Whole canvas</span></button>
        {destinations.length > 0 && <select aria-label="Camera point" value={navigation.destinationId || ''} onChange={event => navigation.choose(event.target.value || null)}>
          <option value="">Camera points</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>}
      </nav>
      <div className="composition-explorer-zoom"><button type="button" aria-label="Zoom out" onClick={() => navigation.zoom(.8)}><Minus size={15} /></button>
        <output aria-label="Canvas zoom">{Math.round((navigation.camera?.scale || 0) * 100)}%</output>
        <button type="button" aria-label="Zoom in" onClick={() => navigation.zoom(1.25)}><Plus size={15} /></button>
      </div>
    </div>
    <div className="composition-explorer-bottom">
      <div className="composition-explorer-information">
        {selected.introduction && <p className="workbench-overview-introduction">{selected.introduction}</p>}
        <div className="composition-explorer-secondary"><span>{model.area.width} × {model.area.height}</span>{onDetails && <button type="button" onClick={onDetails}>Edit details</button>}</div>
        {model.interactive && <p className="workbench-overview-preview-note">Interactive apps are shown as previews here.</p>}
      </div>
      <details className="composition-explorer-help"><summary><Info size={14} />Viewing controls</summary><p id={helpId}>Drag or Space + drag to move. Ctrl + scroll to zoom. Use the arrow keys to move, + / − to zoom, and Home to return to the whole canvas.</p></details>
    </div>
    {sources.length > 0 && <details className="composition-explorer-sources"><summary>Artwork sources <span>{sources.length}</span></summary>
      <label>Artwork<select aria-label="Artwork source" value={sourceId} onChange={event => setSourceId(event.target.value)}>
        <option value="">Choose a piece</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      {source && <div className="composition-explorer-dossier">{source.dossier ? <OwnerSystemWorkflowMetadataContent dossier={source.dossier} /> : <p>Source information is unavailable.</p>}</div>}
    </details>}
  </section>;
}
