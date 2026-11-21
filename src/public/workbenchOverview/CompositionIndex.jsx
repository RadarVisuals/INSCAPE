import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, ArrowUpLeft, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import CanvasExplorer from './CanvasExplorer.jsx';
import './compositionIndex.css';
import './visitorWorksList.css';

const worksPerPage = 6;

// This index reads the supplied owner/public collection. It never switches the
// editor's active Workbench; only the explicit Edit action may do that.
export default function CompositionIndex({ items, selected, model, profile, listRef, onSelect, onEdit, selection, onDetails, onOpenReception, onEditReception, onGrid, settings, disabled, memory: workspaceMemory, visitorHeader, movingCanvasId }) {
  const [expandRequested, setExpanded] = useState(workspaceMemory?.expanded || false);
  const expanded = !selection && expandRequested;
  const [page, setPage] = useState(() => Math.floor(Math.max(0, items.findIndex(item => item.id === selected.id)) / worksPerPage));
  const pageCount = Math.ceil(items.length / worksPerPage);
  const start = visitorHeader ? Math.min(page, Math.max(0, pageCount - 1)) * worksPerPage : 0;
  const visibleItems = visitorHeader ? items.slice(start, start + worksPerPage) : items;
  const localMemories = useRef(new Map());
  const memories = workspaceMemory?.cameras || localMemories.current;
  const profileAddress = selected.draft.profileAddress;
  const key = `${profileAddress}:${selected.id}:${JSON.stringify(model.area)}`;
  if (!memories.has(key)) memories.set(key, { current: null });
  const memory = memories.get(key);
  useEffect(() => {
    const retained = new Set(items.map(item => `${profileAddress}:${item.id}:`));
    for (const id of memories.keys()) if (![...retained].some(prefix => id.startsWith(prefix))) memories.delete(id);
  }, [items, profileAddress, memories]);
  const expand = value => { setExpanded(value); if (workspaceMemory) workspaceMemory.expanded = value; };
  const toggleExpanded = () => expand(!expanded);
  const select = id => { if (!disabled) onSelect(id); };
  return <div className="composition-index" data-expanded={expanded || undefined} onKeyDown={event => {
    if (event.key === 'Escape' && expanded && !event.defaultPrevented) { event.preventDefault(); expand(false); }
  }}>
    {!visitorHeader && <header className="composition-index-header" inert={disabled ? '' : undefined}>
      <span className="composition-index-brand">inscape</span>
      <span className="composition-index-maker">{profile?.name || 'Unnamed profile'}</span>
      <button type="button" onClick={onGrid} aria-label="Grid" title="Thumbnail grid"><LayoutGrid size={17} /><span>Grid view</span></button>
    </header>}
    <div className="composition-index-body">
      <aside className="composition-index-sidebar" inert={disabled || expanded ? '' : undefined}>
        {!visitorHeader && (onOpenReception || onEditReception) && <div className="composition-index-reception">
          {onOpenReception && <button className="composition-index-about" type="button" onClick={onOpenReception}><ArrowUpLeft size={14} />Profile</button>}
          {onEditReception && <button type="button" className="composition-index-edit-reception" aria-label="Studio" title="Studio" onClick={onEditReception}><Pencil size={14} />{onOpenReception ? 'Edit' : 'Studio'}</button>}
        </div>}
        <div className="composition-index-label"><h2>{visitorHeader ? 'Index' : 'Canvases'}</h2>
          {!visitorHeader && <span>{items.length}</span>}
        </div>
        <nav className="workbench-overview-list" aria-label="Canvases" ref={listRef}>
          {visibleItems.map((item, index) => {
            const active = selected.id === item.id;
            if (selection) return <label key={item.id} className="gallery-index-selection">
              <input type="checkbox" checked={selection.checked.has(item.id)} aria-label={`Select ${item.name}`} onChange={() => selection.toggle(item.id)} />
              <span>{item.name}</span>
            </label>;
            return <div key={item.id} data-work-id={item.id} className="composition-index-entry">
              <button type="button" data-previewed={active} aria-current={active ? 'page' : undefined}
                aria-label={`Open ${item.name}`} onClick={() => select(item.id)}>
                {!visitorHeader && <small>{String(index + 1).padStart(2, '0')}</small>}<span>{item.name}</span>
              </button>
            </div>;
          })}
        </nav>
        {visitorHeader && pageCount > 1 && <nav className="visitor-index-pages" aria-label="Index pages">
          <span aria-live="polite">{start + 1}–{start + visibleItems.length} / {items.length}</span>
          <button type="button" aria-label="Previous index page" disabled={start === 0} onClick={() => setPage(start / worksPerPage - 1)}><ChevronLeft size={15} /></button>
          <button type="button" aria-label="Next index page" disabled={start + visibleItems.length >= items.length} onClick={() => setPage(start / worksPerPage + 1)}><ChevronRight size={15} /></button>
        </nav>}
      </aside>
      <section className="composition-index-main">
        {settings ? <section className="composition-index-settings" aria-label="Canvas settings">{settings}</section>
          : <CanvasExplorer key={key} selected={selected} model={model} memory={memory} disabled={disabled} expanded={expanded} visitorHeader={visitorHeader} moving={movingCanvasId === selected.id}
            onExpand={selection ? undefined : toggleExpanded} onEdit={selection ? undefined : onEdit} onDetails={onDetails} />}
      </section>
    </div>
  </div>;
}
