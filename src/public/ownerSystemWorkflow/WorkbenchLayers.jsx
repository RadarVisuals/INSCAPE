import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Trash2, X, Check, Group, Ungroup, Scan, Image, Type, Square, Layers, Monitor } from 'lucide-react';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { artworkRecords, artworkModuleId, artworkWindowIds, layerMembers } from '../../systemWorkflow/domain/artworkLayers.js';
import { editArtworkLayers } from '../../systemWorkflow/artworkLayerSession.js';
import { workbenchGroupModules } from '../../systemWorkflow/domain/workbenchGroups.js';
import { workbenchLayerOutline } from './workbenchLayerOutline.js';
import './workbenchLayers.css';
import ArtworkOrderControls from '../../ui/ArtworkOrderControls.jsx';
import { useEditorCells } from '../../reception/EditorCellsContext.jsx';
import { OwnerSystemWorkflowSelectMenu } from './OwnerSystemWorkflowWorkspaceControls.jsx';

export default function WorkbenchLayers({ open, hidden, onOpen, historyBlocked, hostRef }) {
  const view = useWorkbenchView(), { store, profileAddress, layers, content } = view;
  const cellContext = useEditorCells(), cells = cellContext?.cells || [];
  const cellsById = new Map(cells.map(cell => [cell.id, cell]));
  const cellOwners = new Map(cells.flatMap(cell => cell.members.map(id => [id, cell.id])));
  const groups = cellContext ? [] : content?.workbenchGroups || [];
  const groupOwners = new Map(groups.flatMap(group => group.memberIds.map(id => [id, group])));
  const [expanded, setExpanded] = useState([]), [pending, setPending] = useState(null), [error, setError] = useState('');
  const [grouping, setGrouping] = useState(false), [groupName, setGroupName] = useState('Group');
  const [drop, setDrop] = useState(null);
  const root = useRef(null), drag = useRef(null), returnFocus = useRef(null);
  const records = artworkRecords(content), byId = new Map(records.map(item => [item.id, item]));
  // Arrival retains module tools, not a layer selection or layer commands.
  const selected = view.selectionMode === 'activation' ? []
    : [...new Set(view.selection.map(id => artworkModuleId(content, id)))].filter(id => byId.has(id));
  // Cell membership owns this outline; native layers still own paint order.
  // Filter composition blocks within each cell without rewriting either model.
  const outline = members => layers.flatMap(layer => {
    const includes = id => members ? members.includes(id) : !cellOwners.has(id);
    if (typeof layer === 'string') return includes(layer) ? [layer] : [];
    const children = layer.children.filter(includes);
    return children.length ? [{ ...layer, children }] : [];
  });
  const revealIds = [...new Set([
    ...selected.map(id => cellOwners.get(id) || groupOwners.get(id)?.id), cellContext?.editingCellId,
    ...layers.filter(layer => layer.children?.some(id => selected.includes(id) || selected.some(child => cellOwners.get(child) === id))).map(layer => layer.id),
  ].filter(Boolean))];
  const revealKey = JSON.stringify(revealIds), selectionKey = JSON.stringify(selected);
  useEffect(() => { setExpanded([]); setPending(null); setGrouping(false); setError(''); }, [store]);
  useEffect(() => {
    const ids = JSON.parse(revealKey);
    if (ids.length) setExpanded(current => ids.every(id => current.includes(id)) ? current : [...new Set([...current, ...ids])]);
  }, [revealKey, selectionKey, store]);
  const block = layers.find(layer => typeof layer !== 'string' && layer.children.length === selected.length && layer.children.every(id => selected.includes(id)));
  const transferable = cellContext && selected.length > 0 && selected.every(id => !cellsById.has(id));
  const transferGeneration = store.getGeneration();
  const partBlock = layers.find(layer => layer.id === view.editingBlockId);
  const run = (action, generation = store.getGeneration()) => {
    if (historyBlocked) { setError(historyBlocked); return false; }
    try { editArtworkLayers(store, profileAddress, action, generation, view.getPresentation()); setError(''); return true; }
    catch (failure) { setError(failure.message); return false; }
  };
  const cancel = () => {
    const rowId = pending?.rowId; setPending(null);
    queueMicrotask(() => {
      const row = [...(root.current?.querySelectorAll('[data-layer-key]') || [])].find(node => node.dataset.layerKey === rowId);
      (row?.querySelector('button[aria-label^="Delete "]') || (returnFocus.current?.isConnected ? returnFocus.current : root.current))?.focus();
    });
  };
  const requestDelete = (ids, id, cellId = cellOwners.get(ids[0])) => {
    returnFocus.current = document.activeElement;
    const parents = layers.filter(layer => layer.children?.includes(id) || layer.children?.includes(cellId)).map(layer => layer.id);
    const folderId = groupOwners.get(ids[0])?.id;
    setExpanded(current => [...new Set([...current, ...parents, ...[cellId, folderId].filter(Boolean)])]);
    onOpen();
    setPending({ ids, rowId: `${cellId || ''}/${id}`, generation: store.getGeneration() }); setError('');
  };
  // The host listener is installed for its lifetime, but Delete uses the current
  // composition and row action even when grouping did not change selected ids.
  const deletion = useRef(null);
  deletion.current = { selected, blockId: block?.children.every(id => groupOwners.get(id) === groupOwners.get(selected[0])) ? block.id : null, requestDelete };
  const select = (ids, additive = false, part = null, cellId = null) => {
    const group = groupOwners.get(ids[0]);
    if (group?.position && view.hiddenModuleIds.includes(ids[0])) view.groupScene.current?.open(group);
    cellContext?.store.setEditingCell(cellId);
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
  const toggleExpanded = id => setExpanded(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const disclosure = (id, name) => <button type="button" aria-label={`${expanded.includes(id) ? 'Collapse' : 'Expand'} ${name}`} aria-expanded={expanded.includes(id)} onClick={() => toggleExpanded(id)}>{expanded.includes(id) ? <ChevronDown /> : <ChevronRight />}</button>;
  const row = (layer, parent = null, cellParent = null) => {
    const isBlock = typeof layer !== 'string', id = isBlock ? layer.id : layer;
    const cell = cellsById.get(id), children = cell ? outline(cell.members) : isBlock ? layer.children : null;
    const rowKey = `${cellParent || ''}/${id}`;
    const ids = layerMembers(layer), item = byId.get(id), name = isBlock ? layer.name : item?.name || 'Unavailable artwork';
    const childCount = children ? cell ? cell.members.length : ids.length : null;
    const description = childCount === null ? undefined : `${childCount} ${childCount === 1 ? 'layer' : 'layers'} inside`;
    const visibilityIds = cell ? [id, ...cell.members] : ids;
    const Icon = isBlock ? Group : item?.key === 'imageModules' ? Image : item?.key === 'texts' ? Type : Square;
    const chosen = ids.every(id => selected.includes(id)), invisible = visibilityIds.every(id => view.editorHiddenIds.includes(id));
    const closed = ids.some(id => view.getPresentation()?.[byId.get(id)?.key]?.find(item => item.id === id)?.open === false);
    const deleting = pending?.rowId === rowKey;
    const acceptsDrop = () => {
      const moving = drag.current?.ids;
      if (!moving?.length) return false;
      if (moving.some(member => groupOwners.get(member) !== groupOwners.get(ids[0]))) return false;
      const owner = cellOwners.get(moving[0]);
      if (moving.some(id => cellOwners.get(id) !== owner)) return false;
      return owner ? cellParent === owner || id === owner : !cellParent;
    };
    return <div key={id}>
      <div className="workbench-layer-row" data-layer-id={id} data-layer-key={rowKey} data-selected={chosen || undefined} data-part={Boolean(parent || cellParent) || undefined}
        data-drop={drop?.rowKey === rowKey ? drop.edge : undefined} draggable={!deleting}
        onDragStart={event => { drag.current = { ids: chosen ? selected : ids, generation: store.getGeneration() }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }}
        onDragEnd={() => { drag.current = null; setDrop(null); }}
        onDragOver={event => { if (!acceptsDrop()) { setDrop(null); return; } event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setDrop({ rowKey, edge: event.clientY < rect.top + rect.height / 2 ? 'after' : 'before' }); }}
        onDrop={event => { event.preventDefault(); if (acceptsDrop() && drop?.rowKey === rowKey) run({ type: 'order', direction: 'drop', ids: drag.current.ids, targetId: id, edge: drop.edge }, drag.current.generation); drag.current = null; setDrop(null); }}>
        {deleting ? <><span className="workbench-layer-confirm">Delete {pending.ids.length === 1 ? name : `${pending.ids.length} layers`}?</span>
          <button type="button" aria-label="Cancel layer deletion" onClick={cancel}><X /></button>
          <button type="button" aria-label="Confirm layer deletion" onClick={() => { if (run({ type: 'delete', ids: pending.ids }, pending.generation)) { setPending(null); view.clearSelection(); root.current?.focus(); } }}><Check /></button></>
          : <>
            {children ? disclosure(id, name) : <span className="workbench-layer-indent" />}
            <button type="button" className="workbench-layer-name" aria-label={`Select ${name}`} aria-description={description} title={description ? `${name} · ${description}` : name} aria-pressed={chosen} onClick={event => select(ids, event.shiftKey || event.ctrlKey || event.metaKey, parent, cellParent)}
              onDoubleClick={() => view.focusModulesRef.current?.(artworkWindowIds(content, ids))}><Icon /><span>{name}</span></button>
            <button type="button" className="workbench-layer-visibility" aria-label={`${invisible ? 'Show' : 'Hide'} ${name} in editor`} aria-pressed={invisible} title="Show or hide while editing; publication stays unchanged." onClick={() => toggleVisible(visibilityIds)}>{invisible ? <EyeOff /> : <Eye />}</button>
            <button type="button" className="workbench-layer-delete" aria-label={`Delete ${name}`} title={`Delete ${name}`} onClick={() => requestDelete(chosen ? selected : ids, id, cellParent)}><Trash2 /></button>
          </>}
      </div>
      {closed && !deleting && <button type="button" className="workbench-layer-reopen" onClick={() => ids.forEach(view.openArtwork)}>Reopen {name}</button>}
      {children && expanded.includes(id) && <div className="workbench-layer-children">
        {[...children].reverse().map(child => row(child, isBlock ? id : null, cell ? id : cellParent))}
        {cell && !children.length && <p className="workbench-layer-empty">No layers in this cell.</p>}
      </div>}
    </div>;
  };
  const groupNames = groups.length ? workbenchGroupModules(content) : null;
  const folderRow = ({ group, children }) => <div key={group.id}>
    <div className="workbench-layer-row" data-layer-folder={group.id}>
      <button className="workbench-layer-name" type="button" aria-expanded={expanded.includes(group.id)} onClick={() => toggleExpanded(group.id)}>
        {expanded.includes(group.id) ? <ChevronDown /> : <ChevronRight />}<Layers /><span>{group.name}</span>
        <small className="workbench-layer-count">{group.memberIds.length}</small>
      </button>
    </div>
    {expanded.includes(group.id) && <div className="workbench-layer-children">
      {children.map(({ layer, parent }) => row(layer, parent))}
      {group.memberIds.filter(id => !byId.has(id)).map(id => <div className="workbench-layer-row" key={id}>
        <span className="workbench-layer-indent" /><button type="button" className="workbench-layer-name" onClick={() => select([id])}><Monitor /><span>{groupNames.get(id)}</span></button>
      </div>)}
      {!group.memberIds.length && <p className="workbench-layer-empty">No layers in this group.</p>}
    </div>}
  </div>;
  return (
      <div ref={root} tabIndex={-1} className="workbench-layers" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor"
        onKeyDown={event => {
          if (event.key === 'Escape' && pending) { event.preventDefault(); event.stopPropagation(); cancel(); }
          if (event.key === 'Escape' && grouping) { event.preventDefault(); event.stopPropagation(); setGrouping(false); }
          if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key) && selected.length && !event.target.matches('input')) {
            event.preventDefault(); event.stopPropagation(); run({ type: 'order', ids: selected, direction: event.key === 'ArrowUp' ? 'forward' : 'backward' });
          }
        }}>
        {partBlock && <div className="workbench-layers-context"><span>{partBlock.name}{selected.length === 1 ? ` › ${byId.get(selected[0])?.name}` : ' › Edit group contents'}</span><button type="button" onClick={() => select(partBlock.children)}>Done</button></div>}
        <div className="workbench-layers-list" aria-label="Artwork layers">
          {groups.length ? workbenchLayerOutline(layers, groups, groupOwners).map(entry => entry.group ? folderRow(entry) : row(entry.layer, entry.parent))
            : layers.length ? outline().reverse().map(layer => row(layer)) : <p>No artwork yet. Add an Image, Text or Shape to this Workbench.</p>}
        </div>
        <nav className="workbench-layers-actions" aria-label="Layer actions">
          <ArtworkOrderControls disabled={!selected.length || Boolean(historyBlocked)} onOrder={direction => run({ type: 'order', ids: selected, direction })} />
          <button type="button" aria-label="Group selected layers" title="Group selected layers" disabled={selected.length < 2 || selected.some(id => layers.some(layer => layer.children?.includes(id)))} onClick={() => setGrouping(true)}><Group /></button>
          <button type="button" aria-label="Ungroup selected group" title="Ungroup; keep all artwork" disabled={!block} onClick={() => run({ type: 'ungroup', id: block.id })}><Ungroup /></button>
          <button type="button" aria-label="Focus selected layers" title="Focus selected layers" disabled={!selected.length} onClick={() => view.focusModulesRef.current?.(artworkWindowIds(content, selected))}><Scan /></button>
        </nav>
        {transferable && <OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control"
          label="Move to cell" triggerPrefix="Move to cell" value="" defaultValue=""
          disabled={Boolean(historyBlocked) || Object.keys(view.transforms).length > 0}
          options={[...cells.map(cell => ({ value: cell.id, label: byId.get(cell.id)?.name || 'Cell',
            disabled: selected.every(id => cellOwners.get(id) === cell.id) })),
          { value: 'outside', label: 'Move out of cell', disabled: selected.every(id => !cellOwners.has(id)) }]} onChange={id => {
            const target = id === 'outside' ? null : id;
            try {
              cellContext.store.editBento('moveMembers', [selected, target], transferGeneration, view.getPresentation());
              cellContext.store.setEditingCell(target); view.selectLayers(selected, false, null); setError('');
            }
            catch (failure) { setError(failure.message); }
          }} />}
        {block && <button type="button" onClick={() => view.enterBlock(block.id)}>Edit group contents</button>}
        {partBlock && selected.length === 1 && <button type="button" title="Keep this layer on the Workbench" onClick={() => { if (run({ type: 'leave', id: selected[0] })) view.leaveBlock(false); }}>Move out of group</button>}
        {grouping && <form onSubmit={event => { event.preventDefault(); if (run({ type: 'group', ids: selected, id: `composition:${crypto.randomUUID()}`, name: groupName.trim() })) setGrouping(false); }}><label>Group name<input autoFocus value={groupName} maxLength={48} onChange={event => setGroupName(event.target.value)} /></label><button type="submit">Create group</button><button type="button" onClick={() => setGrouping(false)}>Cancel</button></form>}
        {error && <p role="alert">{error}</p>}
      </div>
  );
}
