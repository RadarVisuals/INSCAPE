import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Trash2, X, Check, Group, Ungroup, Scan, Image, Type, Square } from 'lucide-react';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { artworkRecords, artworkModuleId, artworkWindowIds, layerMembers } from '../../systemWorkflow/domain/artworkLayers.js';
import { editArtworkLayers } from '../../systemWorkflow/artworkLayerSession.js';
import './workbenchLayers.css';
import ArtworkOrderControls from '../../ui/ArtworkOrderControls.jsx';

export default function WorkbenchLayers({ open, hidden, onOpen, historyBlocked, hostRef }) {
  const view = useWorkbenchView(), { store, profileAddress, layers, content } = view;
  const [expanded, setExpanded] = useState([]), [pending, setPending] = useState(null), [error, setError] = useState('');
  const [grouping, setGrouping] = useState(false), [groupName, setGroupName] = useState('Group');
  const [drop, setDrop] = useState(null);
  const root = useRef(null), drag = useRef(null), returnFocus = useRef(null);
  const records = artworkRecords(content), byId = new Map(records.map(item => [item.id, item]));
  // Arrival retains module tools, not a layer selection or layer commands.
  const selected = view.selectionMode === 'activation' ? []
    : [...new Set(view.selection.map(id => artworkModuleId(content, id)))].filter(id => byId.has(id));
  const block = layers.find(layer => typeof layer !== 'string' && layer.children.length === selected.length && layer.children.every(id => selected.includes(id)));
  const partBlock = layers.find(layer => layer.id === view.editingBlockId);
  const run = (action, generation = store.getGeneration()) => {
    if (historyBlocked) { setError(historyBlocked); return false; }
    try { editArtworkLayers(store, profileAddress, action, generation, view.getPresentation()); setError(''); return true; }
    catch (failure) { setError(failure.message); return false; }
  };
  const cancel = () => {
    const rowId = pending?.rowId; setPending(null);
    queueMicrotask(() => {
      const row = [...(root.current?.querySelectorAll('[data-layer-id]') || [])].find(node => node.dataset.layerId === rowId);
      (row?.querySelector('button[aria-label^="Delete "]') || (returnFocus.current?.isConnected ? returnFocus.current : root.current))?.focus();
    });
  };
  const requestDelete = (ids, rowId) => {
    returnFocus.current = document.activeElement;
    const parent = layers.find(layer => layer.children?.includes(rowId));
    if (parent) setExpanded(current => [...new Set([...current, parent.id])]);
    onOpen();
    setPending({ ids, rowId, generation: store.getGeneration() }); setError('');
  };
  // The host listener is installed for its lifetime, but Delete uses the current
  // composition and row action even when grouping did not change selected ids.
  const deletion = useRef(null);
  deletion.current = { selected, blockId: block?.id, requestDelete };
  const select = (ids, additive = false, part = null) => {
    view.selectLayers(ids, additive, part);
  };
  const toggleVisible = ids => {
    const hidden = ids.every(id => view.editorHiddenIds.includes(id));
    view.setEditorHiddenIds(current => hidden ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]);
  };
  useEffect(() => { if (!open || hidden) { setPending(null); setGrouping(false); } }, [open, hidden]);
  useLayoutEffect(() => {
    if (!pending) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector('[aria-label="Cancel layer deletion"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [pending]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || hidden) return;
    const key = event => {
      if (event.defaultPrevented || event.isComposing || event.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="dialog"],[role="menu"]')) return;
      const { selected, blockId, requestDelete } = deletion.current;
      if (event.key === 'Delete' && selected.length && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); requestDelete(selected, blockId || selected[0]);
      }
    };
    host.addEventListener('keydown', key);
    return () => host.removeEventListener('keydown', key);
  }, [hostRef, hidden]);
  if (!open || hidden) return null;
  const row = (layer, parent = null) => {
    const isBlock = typeof layer !== 'string', id = isBlock ? layer.id : layer;
    const ids = layerMembers(layer), item = byId.get(id), name = isBlock ? layer.name : item?.name || 'Unavailable artwork';
    const Icon = isBlock ? Group : item?.key === 'imageModules' ? Image : item?.key === 'texts' ? Type : Square;
    const chosen = ids.every(id => selected.includes(id)), invisible = ids.every(id => view.editorHiddenIds.includes(id));
    const closed = ids.some(id => view.getPresentation()?.[byId.get(id)?.key]?.find(item => item.id === id)?.open === false);
    const deleting = pending?.rowId === id;
    return <div key={id}>
      <div className="workbench-layer-row" data-layer-id={id} data-selected={chosen || undefined} data-part={Boolean(parent) || undefined}
        data-drop={drop?.id === id ? drop.edge : undefined} draggable={!deleting}
        onDragStart={event => { drag.current = { ids: chosen ? selected : ids, generation: store.getGeneration() }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }}
        onDragEnd={() => { drag.current = null; setDrop(null); }}
        onDragOver={event => { if (!drag.current) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setDrop({ id, edge: event.clientY < rect.top + rect.height / 2 ? 'after' : 'before' }); }}
        onDrop={event => { event.preventDefault(); if (drag.current && drop) run({ type: 'order', direction: 'drop', ids: drag.current.ids, targetId: id, edge: drop.edge }, drag.current.generation); drag.current = null; setDrop(null); }}>
        {deleting ? <><span className="workbench-layer-confirm">Delete {pending.ids.length === 1 ? name : `${pending.ids.length} layers`}?</span>
          <button type="button" aria-label="Cancel layer deletion" onClick={cancel}><X /></button>
          <button type="button" aria-label="Confirm layer deletion" onClick={() => { if (run({ type: 'delete', ids: pending.ids }, pending.generation)) { setPending(null); view.clearSelection(); root.current?.focus(); } }}><Check /></button></>
          : <>
            {isBlock ? <button type="button" aria-label={`${expanded.includes(id) ? 'Collapse' : 'Expand'} ${name}`} aria-expanded={expanded.includes(id)} onClick={() => setExpanded(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])}>{expanded.includes(id) ? <ChevronDown /> : <ChevronRight />}</button> : <span className="workbench-layer-indent" />}
            <button type="button" className="workbench-layer-name" aria-label={`Select ${name}`} aria-pressed={chosen} onClick={event => select(ids, event.shiftKey || event.ctrlKey || event.metaKey, parent)}
              onDoubleClick={() => view.focusModulesRef.current?.(artworkWindowIds(content, ids))}><Icon /><span>{name}</span>{isBlock && <small>{ids.length}</small>}</button>
            <button type="button" aria-label={`${invisible ? 'Show' : 'Hide'} ${name} in editor`} aria-pressed={invisible} title="Show or hide while editing; publication stays unchanged." onClick={() => toggleVisible(ids)}>{invisible ? <EyeOff /> : <Eye />}</button>
            <button type="button" aria-label={`Delete ${name}`} title={`Delete ${name}`} onClick={() => requestDelete(chosen ? selected : ids, id)}><Trash2 /></button>
          </>}
      </div>
      {closed && !deleting && <button type="button" className="workbench-layer-reopen" onClick={() => ids.forEach(view.openArtwork)}>Reopen {name}</button>}
      {isBlock && expanded.includes(id) && [...layer.children].reverse().map(child => row(child, id))}
    </div>;
  };
  return (
      <div ref={root} tabIndex={-1} className="workbench-layers" data-workflow-material="tactile" data-workflow-finish="flat"
        onKeyDown={event => {
          if (event.key === 'Escape' && pending) { event.preventDefault(); event.stopPropagation(); cancel(); }
          if (event.key === 'Escape' && grouping) { event.preventDefault(); event.stopPropagation(); setGrouping(false); }
          if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key) && selected.length && !event.target.matches('input')) {
            event.preventDefault(); event.stopPropagation(); run({ type: 'order', ids: selected, direction: event.key === 'ArrowUp' ? 'forward' : 'backward' });
          }
        }}>
        <div className="workbench-layers-summary"><span>{records.length} {records.length === 1 ? 'layer' : 'layers'}{selected.length ? ` · ${selected.length} selected` : ''}</span></div>
        {partBlock && <div className="workbench-layers-context"><span>{partBlock.name}{selected.length === 1 ? ` › ${byId.get(selected[0])?.name}` : ' › Edit group contents'}</span><button type="button" onClick={() => select(partBlock.children)}>Done</button></div>}
        <div className="workbench-layers-list" aria-label="Artwork layers">
          {layers.length ? [...layers].reverse().map(layer => row(layer)) : <p>No artwork yet. Add an Image, Text or Shape to this Workbench.</p>}
        </div>
        <nav className="workbench-layers-actions" aria-label="Layer actions">
          <ArtworkOrderControls disabled={!selected.length || Boolean(historyBlocked)} onOrder={direction => run({ type: 'order', ids: selected, direction })} />
          <button type="button" aria-label="Group selected layers" title="Group selected layers" disabled={selected.length < 2 || selected.some(id => layers.some(layer => layer.children?.includes(id)))} onClick={() => setGrouping(true)}><Group /></button>
          <button type="button" aria-label="Ungroup selected group" title="Ungroup; keep all artwork" disabled={!block} onClick={() => run({ type: 'ungroup', id: block.id })}><Ungroup /></button>
          <button type="button" aria-label="Focus selected layers" title="Focus selected layers" disabled={!selected.length} onClick={() => view.focusModulesRef.current?.(artworkWindowIds(content, selected))}><Scan /></button>
        </nav>
        {block && <button type="button" onClick={() => view.enterBlock(block.id)}>Edit group contents</button>}
        {partBlock && selected.length === 1 && <button type="button" title="Keep this layer on the Workbench" onClick={() => { if (run({ type: 'leave', id: selected[0] })) view.leaveBlock(false); }}>Move out of group</button>}
        {grouping && <form onSubmit={event => { event.preventDefault(); if (run({ type: 'group', ids: selected, id: `composition:${crypto.randomUUID()}`, name: groupName.trim() })) setGrouping(false); }}><label>Group name<input autoFocus value={groupName} maxLength={48} onChange={event => setGroupName(event.target.value)} /></label><button type="submit">Create group</button><button type="button" onClick={() => setGrouping(false)}>Cancel</button></form>}
        {error && <p role="alert">{error}</p>}
      </div>
  );
}
