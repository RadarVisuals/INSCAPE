import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LayoutGrid, ArrowUpLeft, ChevronLeft, ChevronRight, Check, Ellipsis, Pencil, X } from 'lucide-react';
import VisitorMenu from '../../profileDocument/components/VisitorMenu.jsx';
import CanvasExplorer from './CanvasExplorer.jsx';
import './compositionIndex.css';
import './visitorWorksList.css';

const worksPerPage = 6;

// This index reads the supplied owner/public collection. It never switches the
// editor's active Workbench; only the explicit Edit action may do that.
export default function CompositionIndex({ onDeleteDraft, onRename, onReorder, items, selected, model, profile, listRef, onSelect, onEdit, selection, onDetails, onOpenReception, onEditReception, onGrid, settings, disabled, memory: workspaceMemory, visitorHeader, movingCanvasId }) {
  const [expandRequested, setExpanded] = useState(workspaceMemory?.expanded || false);
  const expanded = !selection && expandRequested;
  const [page, setPage] = useState(() => Math.floor(Math.max(0, items.findIndex(item => item.id === selected.id)) / worksPerPage));
  const [rename, setRename] = useState(null), [rowError, setRowError] = useState('');
  const input = useRef(null);
  const inspector = useRef(null), previousWork = useRef(selected.id);
  useLayoutEffect(() => {
    const changed = previousWork.current !== selected.id;
    previousWork.current = selected.id;
    if (!changed || !visitorHeader || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const artwork = inspector.current?.querySelector('.composition-explorer-viewport > .workbench-overview-preview');
    const reveal = artwork?.animate([{ opacity: 0.78 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    return () => reveal?.cancel();
  }, [selected.id, visitorHeader]);
  const renameId = rename?.id;
  useEffect(() => {
    if (renameId && input.current !== document.activeElement) { input.current?.focus(); input.current?.select(); }
  }, [renameId]);
  const restoreRow = id => {
    requestAnimationFrame(() => {
      const row = [...(listRef.current?.children || [])].find(node => node.dataset.workId === id);
      row?.querySelector('.visitor-menu > button')?.focus({ preventScroll: true });
    });
  };
  const beginRename = item => { setRowError(''); setRename({ id: item.id, name: item.name }); };
  const finishRename = () => { restoreRow(rename.id); setRename(null); setRowError(''); };
  const move = (item, index, step) => {
    const ids = items.map(entry => entry.id), next = index + step;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    try {
      onReorder(ids); setRowError(''); setPage(Math.floor(next / worksPerPage)); restoreRow(item.id);
    } catch (failure) { setRowError(failure.message); }
  };
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
            if (rename?.id === item.id) return <form key={item.id} className="draft-index-rename" onSubmit={event => {
              event.preventDefault();
              try { onRename(item.id, rename.name.trim()); finishRename(); }
              catch (failure) { setRowError(failure.message); input.current?.focus(); }
            }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); finishRename(); } }}>
              <input ref={input} aria-label="Composition name" required maxLength={64} value={rename.name}
                onChange={event => setRename({ id: item.id, name: event.target.value })} />
              <button type="submit" aria-label="Save name" title="Save name"><Check size={14} /></button>
              <button type="button" aria-label="Cancel rename" title="Cancel rename" onClick={finishRename}><X size={14} /></button>
            </form>;
            return <div key={item.id} data-work-id={item.id} className="composition-index-entry">
              <button type="button" data-previewed={active} aria-current={active ? 'page' : undefined}
                aria-label={`Open ${item.name}`} onClick={() => select(item.id)} onDoubleClick={onRename ? () => beginRename(item) : undefined}>
                {!visitorHeader && <small>{String(index + 1).padStart(2, '0')}</small>}<span>{item.name}</span>
              </button>
              {onRename && <VisitorMenu name={`Actions for ${item.name}`} trigger={<Ellipsis size={15} />}>
                <button type="button" onClick={() => beginRename(item)}>Rename</button>
                <button type="button" disabled={start + index === 0} onClick={() => move(item, start + index, -1)}>Move up</button>
                <button type="button" disabled={start + index === items.length - 1} onClick={() => move(item, start + index, 1)}>Move down</button>
                {onDeleteDraft && <button type="button" disabled={items.length === 1} onClick={() => {
                  if (!window.confirm('Delete "' + item.name + '" from Studio on this device? Its edit history will also be deleted. Published versions stay online.')) return;
                  try {
                    onDeleteDraft(item.id); setRowError('');
                    const next = items[start + index + 1] || items[start + index - 1];
                    setPage(Math.floor((items.indexOf(next) > start + index ? start + index : start + index - 1) / worksPerPage));
                    restoreRow(next.id);
                  } catch (failure) { setRowError(failure.message); }
                }}>Delete from Studio</button>}
              </VisitorMenu>}
            </div>;
          })}
        </nav>
        {rowError && <p role="alert">{rowError}</p>}
        {visitorHeader && pageCount > 1 && <nav className="visitor-index-pages" aria-label="Index pages">
          <span aria-live="polite">{start + 1}–{start + visibleItems.length} / {items.length}</span>
          <button type="button" aria-label="Previous index page" disabled={start === 0} onClick={() => setPage(start / worksPerPage - 1)}><ChevronLeft size={15} /></button>
          <button type="button" aria-label="Next index page" disabled={start + visibleItems.length >= items.length} onClick={() => setPage(start / worksPerPage + 1)}><ChevronRight size={15} /></button>
        </nav>}
      </aside>
      <section className="composition-index-main" ref={inspector}>
        {settings ? <section className="composition-index-settings" aria-label="Canvas settings">{settings}</section>
          : <CanvasExplorer key={key} selected={selected} model={model} memory={memory} disabled={disabled} expanded={expanded} visitorHeader={visitorHeader} moving={movingCanvasId === selected.id}
            onExpand={selection ? undefined : toggleExpanded} onEdit={selection ? undefined : onEdit} onDetails={onDetails} />}
      </section>
    </div>
  </div>;
}
