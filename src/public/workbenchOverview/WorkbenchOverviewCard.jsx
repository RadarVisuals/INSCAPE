import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, GripVertical } from 'lucide-react';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';

export default function WorkbenchOverviewCard({ item, duplicate, selected, visible, onOpen, onEdit, onManage, revealed, onReveal, arranging, index, count, onMove, onDrag, dropTarget }) {
  const host = useRef(null);
  const [information, setInformation] = useState(false);
  return <article className="workbench-overview-card" ref={host} data-revealed={revealed || undefined} data-card-id={item.id} data-drop-target={dropTarget || undefined}
    onPointerLeave={event => { if (event.pointerType === 'mouse' && !host.current.matches(':has(:focus-visible)')) setInformation(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInformation(false); }}>
    {visible && <WorkbenchOverviewPreview model={item.model} name={item.name} surfaceId={item.draft.appearance.surfaceId} thumbnail crop={item.thumbnailCrop} />}
    <button type="button" className="workbench-overview-card-open" disabled={arranging} tabIndex={duplicate ? -1 : 0}
      data-workbench-id={item.id} data-previewed={!duplicate && selected} onClick={event => {
        if (event.nativeEvent.pointerType === 'touch' && !revealed) { onReveal(); return; }
        onOpen(item.id, event.currentTarget);
      }} aria-label={`Open ${item.name}`} />
    <div className="workbench-overview-card-reveal" inert={arranging ? '' : undefined}>
      <span className="workbench-overview-card-title">{item.name}</span>
      <div className="workbench-overview-card-actions">
        <button type="button" className="workbench-overview-card-view" tabIndex={duplicate ? -1 : 0}
          onClick={event => onOpen(item.id, event.currentTarget)}>View</button>
        {onEdit && <button type="button" tabIndex={duplicate ? -1 : 0} onClick={() => onEdit(item.id)} aria-label={`Edit ${item.name}`}>Edit</button>}
        {onManage && <button type="button" tabIndex={duplicate ? -1 : 0} onClick={event => onManage(item.id, 'crop', event.currentTarget)} aria-label={`Crop ${item.name}`}>Crop</button>}
        <button type="button" tabIndex={duplicate ? -1 : 0} aria-expanded={information} onClick={() => setInformation(!information)}
          aria-label={`Information for ${item.name}`}>Information</button>
      </div>
      {information && <div className="workbench-overview-card-information">
        {item.introduction && <p>{item.introduction}</p>}
        {onManage && <button type="button" tabIndex={duplicate ? -1 : 0} onClick={event => onManage(item.id, 'details', event.currentTarget)}>Edit details</button>}
      </div>}
    </div>
    {arranging && <div className="workbench-overview-card-arrange">
      <span>{item.name}</span>
      <div><button type="button" aria-label={`Move ${item.name} earlier`} disabled={index === 0} onClick={() => onMove(item.id, -1)}><ArrowLeft size={16} /></button>
        <button type="button" className="workbench-overview-drag" aria-label={`Drag ${item.name} to reorder`} onPointerDown={event => onDrag(event, item.id)}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onMove(item.id, event.key === 'ArrowLeft' ? -1 : 1); } }}><GripVertical size={18} /></button>
        <button type="button" aria-label={`Move ${item.name} later`} disabled={index === count - 1} onClick={() => onMove(item.id, 1)}><ArrowRight size={16} /></button></div>
    </div>}
  </article>;
}

