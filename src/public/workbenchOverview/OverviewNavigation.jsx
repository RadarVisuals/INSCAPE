import { useEffect, useRef, useState } from 'react';
import { Plus, List, LayoutGrid, Repeat, GripVertical } from 'lucide-react';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';

export default function OverviewNavigation({ disabled, limited, label, view, onViewChange, count, onCreate, triggerRef, arranging, selecting, onArrange, cardSize, onCardSize }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector('.workbench-overview-menu button')?.focus({ preventScroll: true });
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const go = action => { setOpen(false); action(); };
  return <header className="workbench-overview-navigation" ref={root} data-open={open || undefined}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); } }}>
    <div className="workbench-overview-menu-fold" inert={open ? undefined : ''} aria-hidden={!open}><section className="workbench-overview-menu" aria-label={label}>
    <div className="workbench-overview-view-controls" role="group" aria-label="Overview layout">
      <button type="button" aria-label="List" title="List" aria-pressed={view.layout === 'list'} onClick={() => onViewChange({ ...view, layout: 'list' })}><List size={16} /></button>
      <button type="button" aria-label="Grid" title="Grid" aria-pressed={view.layout === 'grid'} onClick={() => onViewChange({ ...view, layout: 'grid' })}><LayoutGrid size={16} /></button>
      <button type="button" aria-label="Wrap around" title="Wrap around" aria-pressed={view.wrap && !selecting} disabled={selecting || view.layout !== 'grid' || count < 2}
        onClick={() => onViewChange({ ...view, wrap: !view.wrap })}><Repeat size={16} /></button>
    </div>
    {view.layout === 'grid' && <div className="workbench-overview-arrangement">
      <label>Card size<input type="range" aria-label="Card size" min="1" max="3" step="1" value={cardSize}
        onChange={event => onCardSize(Number(event.target.value))} /><span>{['Small', 'Medium', 'Large'][cardSize - 1]}</span></label>
      {onArrange && <button type="button" aria-pressed={arranging} disabled={count < 2} onClick={() => go(onArrange)}><GripVertical size={16} />{arranging ? 'Finish arranging' : 'Arrange canvases'}</button>}
    </div>}
    {onCreate && <button className="workbench-overview-menu-create" type="button" disabled={limited && count >= MAX_WORKBENCHES} onClick={() => go(onCreate)}><Plus size={16} />+ New</button>}
    {onCreate && limited && count >= MAX_WORKBENCHES && <small>All {MAX_WORKBENCHES} local canvases are in use.</small>}
    </section></div>
    <button ref={triggerRef} className="workbench-overview-menu-trigger" type="button" disabled={disabled} aria-label={label} aria-expanded={open}
      onClick={() => setOpen(!open)}>
      <LayoutGrid size={16} aria-hidden="true" /><span>{label}</span>
    </button>
  </header>;
}
