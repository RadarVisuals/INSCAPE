import { useId, useMemo, useRef, useState } from 'react';
import { Scan, Minus, Plus, Maximize2, Minimize2, Info, Pencil } from 'lucide-react';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import useCanvasViewport from './useCanvasViewport.js';
import { canvasArtworkSources, canvasDestinations } from './canvasPresentationModel.js';
import { OwnerSystemWorkflowMetadataContent } from '../ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';

export default function CanvasExplorer({ selected, model, memory, disabled, expanded, onExpand, onEdit, onDetails, moving, visitorHeader }) {
  const host = useRef(null), helpId = useId();
  const [sourceId, setSourceId] = useState('');
  const destinations = useMemo(() => canvasDestinations(selected.draft).filter(item => item.view), [selected.draft]);
  const sources = useMemo(() => canvasArtworkSources(model), [model]);
  const source = sources.find(item => item.id === sourceId);
  const navigation = useCanvasViewport({ hostRef: host, area: model.area, destinations, memory, disabled });
  const expandLabel = expanded ? 'Return to index' : 'Expand canvas';
  const expandButton = <button type="button" disabled={!onExpand} onClick={onExpand} aria-label={expandLabel} title={expandLabel} aria-pressed={expanded}>
    {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{!visitorHeader && <span>{expanded ? 'Return to index' : 'Expand'}</span>}
  </button>;
  const help = <details className="composition-explorer-help"><summary aria-label="Viewing controls" title="Viewing controls"><Info size={15} />{!visitorHeader && 'Viewing controls'}</summary><p id={helpId}>Drag or Space + drag to move. Ctrl + scroll to zoom. Use the arrow keys to move, + / - to zoom, and Home to return to the whole canvas.</p></details>;
  const information = <div className="composition-explorer-information">
    {selected.introduction && <p className="workbench-overview-introduction">{selected.introduction}</p>}
    <div className="composition-explorer-secondary"><span>{model.area.width} × {model.area.height}{visitorHeader && ' px'}</span>{onDetails && <button type="button" onClick={onDetails}>Edit details</button>}</div>
  </div>;
  const artworkSources = sources.length > 0 && <details className="composition-explorer-sources"><summary>Artwork sources <span>{sources.length}</span></summary>
    <label>Artwork<select aria-label="Artwork source" value={sourceId} onChange={event => setSourceId(event.target.value)}>
      <option value="">Choose a piece</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {source && <div className="composition-explorer-dossier">{source.dossier ? <OwnerSystemWorkflowMetadataContent dossier={source.dossier} /> : <p>Source information is unavailable.</p>}</div>}
  </details>;
  return <section className="composition-explorer" aria-label={`View ${selected.name}`}>
    {!visitorHeader && <header className="composition-explorer-heading"><h1>{selected.name}</h1><div>
      {onEdit && <button type="button" onClick={() => onEdit(selected.id, host.current)} aria-label="Edit canvas"><Pencil size={15} /><span>Edit canvas</span></button>}
      {expandButton}</div></header>}
    <div className="composition-explorer-stage">
      <div ref={host} className="composition-explorer-viewport" data-canvas-id={selected.id} tabIndex={0} role="group" aria-label={`${selected.name} canvas`}
        data-canvas-journey-target={moving || undefined}
        aria-describedby={helpId} onKeyDown={navigation.onKeyDown}
        data-camera-scale={navigation.camera?.scale} data-camera-x={navigation.camera?.offset.x} data-camera-y={navigation.camera?.offset.y}>
        <WorkbenchOverviewPreview model={model} name={selected.name}
          camera={navigation.camera} highlights={source?.frames} emptyHint={visitorHeader ? null : undefined} presenting />
      </div>
      <div className="composition-explorer-controls">
        <div className="composition-explorer-zoom">
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => navigation.zoom(.8)}><Minus size={15} /></button>
          <output aria-label="Canvas zoom">{Math.round((navigation.camera?.scale || 0) * 100)}%</output>
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => navigation.zoom(1.25)}><Plus size={15} /></button>
        </div>
        <nav className="composition-camera-points" aria-label="Camera points">
          <button type="button" title="Whole canvas" aria-label="Complete canvas" aria-pressed={navigation.fitted}
            onClick={() => navigation.choose(null)}><Scan size={15} /></button>
          {destinations.map(item => <button key={item.id} type="button" className="composition-camera-point" title={item.name} aria-label={item.name}
            aria-pressed={navigation.destinationId === item.id} onClick={() => navigation.choose(item.id)} />)}
        </nav>
        {visitorHeader && <div className="visitor-canvas-actions">{help}{expandButton}</div>}
      </div>
    </div>
    {visitorHeader ? <aside className="visitor-work-details" aria-label="Work details">
      <h2>Details</h2><h1>{selected.name}</h1>{information}{artworkSources}
    </aside> : <><div className="composition-explorer-bottom">{information}{help}</div>{artworkSources}</>}
  </section>;
}
