import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, Plus, ArrowUpLeft, Pencil } from 'lucide-react';
import CanvasExplorer from './CanvasExplorer.jsx';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import './compositionIndex.css';

// This index reads the supplied owner/public collection. It never switches the
// editor's active Workbench; only the explicit Edit action may do that.
export default function CompositionIndex({ items, selected, model, profile, listRef, onSelect, onEdit, onDetails, onCreate, onOpenReception, onEditReception, onGrid, settings, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const memories = useRef(new Map()), root = useRef(null);
  const profileAddress = selected.draft.profileAddress;
  const key = `${profileAddress}:${selected.id}:${JSON.stringify(model.area)}`;
  if (!memories.current.has(key)) memories.current.set(key, { current: null });
  const memory = memories.current.get(key);
  useEffect(() => {
    const retained = new Set(items.map(item => `${profileAddress}:${item.id}:`));
    for (const id of memories.current.keys()) if (![...retained].some(prefix => id.startsWith(prefix))) memories.current.delete(id);
  }, [items, profileAddress]);
  const toggleExpanded = () => { setExpanded(value => !value); };
  const select = id => { if (!disabled) onSelect(id); };
  return <div className="composition-index" ref={root} data-expanded={expanded || undefined} onKeyDown={event => {
    if (event.key === 'Escape' && expanded && !event.defaultPrevented) { event.preventDefault(); setExpanded(false); }
  }}>
    <header className="composition-index-header" inert={disabled ? '' : undefined}>
      <span className="composition-index-brand">{onEdit ? 'My Inscape' : 'inscape'}</span>
      <span className="composition-index-maker">{profile?.name || 'Unnamed profile'}</span>
      <button type="button" onClick={onGrid} aria-label="Grid" title="Thumbnail grid"><LayoutGrid size={17} /><span>Grid view</span></button>
    </header>
    <div className="composition-index-body">
      <aside className="composition-index-sidebar" inert={disabled || expanded ? '' : undefined}>
        {(onOpenReception || onEditReception) && <div className="composition-index-reception">
          {onOpenReception && <button className="composition-index-about" type="button" onClick={onOpenReception}><ArrowUpLeft size={14} />Reception</button>}
          {onEditReception && <button type="button" className="composition-index-edit-reception" aria-label="Edit Reception" title="Edit Reception" onClick={onEditReception}><Pencil size={14} />{onOpenReception ? 'Edit' : 'Edit Reception'}</button>}
        </div>}
        <div className="composition-index-label"><h2>Canvases</h2><span>{items.length}</span></div>
        <nav className="workbench-overview-list" aria-label="Canvases" ref={listRef}>
          {items.map((item, index) => <button type="button" key={item.id} data-previewed={selected.id === item.id} aria-current={selected.id === item.id ? 'page' : undefined}
            aria-label={`Open ${item.name}`} onClick={() => select(item.id)}>
            <small>{String(index + 1).padStart(2, '0')}</small><span>{item.name}</span>
          </button>)}
        </nav>
        {onCreate && <button className="composition-index-create" type="button" onClick={onCreate} disabled={items.length >= MAX_WORKBENCHES}><Plus size={14} />New canvas</button>}
      </aside>
      <main className="composition-index-main">
        {settings ? <section className="composition-index-settings" aria-label="Canvas settings">{settings}</section>
          : <CanvasExplorer key={key} selected={selected} model={model} memory={memory} disabled={disabled} expanded={expanded}
            onExpand={toggleExpanded} onEdit={onEdit} onDetails={onDetails} />}
      </main>
    </div>
  </div>;
}
