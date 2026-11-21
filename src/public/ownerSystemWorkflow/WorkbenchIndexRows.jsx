import { useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { MAX_WORKBENCH_DESTINATIONS, workbenchDestinationAnchor } from '../../systemWorkflow/domain/workbenchIndex.js';

function selectName(input) {
  if (input) { input.focus(); input.select(); }
}

function ViewName({ item, editing, setEditing, active, disabled, go, update }) {
  const pendingVisit = useRef(null), restoreFocus = useRef(false);
  const cancelVisit = () => clearTimeout(pendingVisit.current);
  useEffect(() => () => clearTimeout(pendingVisit.current), []);

  if (editing) return <input aria-label={`Rename ${item.name}`} ref={selectName} defaultValue={item.name} maxLength={48}
    onBlur={event => {
      const name = event.currentTarget.value.trim();
      if (name && name !== item.name) update({ ...item, name }, 'Rename destination');
      setEditing(null);
    }}
    onKeyDown={event => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); restoreFocus.current = true;
      if (event.key === 'Escape') event.currentTarget.value = item.name;
      event.currentTarget.blur();
    }} />;
  return <button type="button" className="workbench-index__name" disabled={disabled} aria-label={`Go to ${item.name}`}
    aria-current={active ? 'location' : undefined} aria-keyshortcuts="F2" title={`${item.name} · Double-click name or press F2 to rename`}
    ref={node => { if (node && restoreFocus.current) { restoreFocus.current = false; node.focus({ preventScroll: true }); } }}
    onBlur={cancelVisit} onContextMenu={cancelVisit}
    onKeyDown={event => {
      if (event.key === 'F2') { event.preventDefault(); event.stopPropagation(); cancelVisit(); setEditing(item.id); }
    }}
    onClick={event => {
      cancelVisit();
      // Only clicks on the lettering need to wait for a possible rename.
      if (event.target === event.currentTarget || event.detail === 0) go(item.id);
      else if (event.detail === 1) pendingVisit.current = setTimeout(() => go(item.id), 450);
    }}>
    <span onDoubleClick={event => { event.preventDefault(); cancelVisit(); setEditing(item.id); }}>{item.name}</span>
  </button>;
}

export default function WorkbenchIndexRows({ index, owner, content, getFrame, navigation, go, save, update, add, replace, follow, activeId }) {
  const [options, setOptions] = useState(null);
  const [editing, setEditing] = useState(null);
  const drag = useRef(null);
  const { destinations, landingId } = index;
  const captureDisabled = navigation.locked || navigation.moving;
  function move(id, to) {
    const from = destinations.findIndex(item => item.id === id);
    if (from < 0 || to < 0 || to >= destinations.length || from === to) return;
    const ordered = [...destinations];
    ordered.splice(to, 0, ...ordered.splice(from, 1));
    save({ ...index, destinations: ordered }, 'Reorder destinations');
  }
  return <nav className="workbench-index__list" aria-label="Workbench destinations">
    <h3>Saved views</h3>
    <ol>{destinations.map((item, order) => {
      const start = landingId === item.id;
      const goLabel = `Go to ${item.name}`;
      if (!owner) return <li key={item.id}>
        <button type="button" className="workbench-index__visitor-row" aria-label={goLabel} aria-current={activeId === item.id ? 'location' : undefined}
          disabled={navigation.locked} onClick={() => go(item.id)}>
          <span>{order + 1}</span>{item.name}{start && <Star aria-label="Starting view" fill="currentColor" />}
        </button>
      </li>;
      const starLabel = start ? `Clear starting view ${item.name}` : `Set ${item.name} as starting view`;
      return <li key={item.id}
        onDragOver={event => { if (drag.current) event.preventDefault(); }}
        onDrop={event => {
          if (!drag.current) return;
          event.preventDefault(); event.stopPropagation();
          move(drag.current, order); drag.current = null;
        }}>
        <div className="workbench-index__view-row" data-active={activeId === item.id || undefined}
          onClick={event => { if (event.target === event.currentTarget && !navigation.locked) go(item.id); }}
          onContextMenu={event => { event.preventDefault(); setOptions(item.id); }}
          onKeyDown={event => {
            if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') {
              event.preventDefault(); setOptions(item.id);
            }
          }}>
          <button type="button" className="workbench-index__grip" draggable aria-label={`Options for ${item.name}`}
            title="View options · drag or use ↑ ↓ to reorder" aria-expanded={options === item.id}
            onClick={() => setOptions(options === item.id ? null : item.id)}
            onDragStart={event => { drag.current = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); }}
            onDragEnd={() => { drag.current = null; }}
            onKeyDown={event => {
              if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault(); event.stopPropagation(); move(item.id, order + (event.key === 'ArrowUp' ? -1 : 1));
            }}><GripVertical /></button>
          <ViewName item={item} active={activeId === item.id} disabled={navigation.locked} editing={editing === item.id}
            setEditing={setEditing} go={go} update={update} />
          <button type="button" aria-label={starLabel} title={item.visibility === 'PRIVATE' ? 'Include in publication to use as starting view' : starLabel}
            aria-pressed={start} disabled={item.visibility === 'PRIVATE'} onClick={() => save({ ...index, landingId: start ? null : item.id }, 'Set starting view')}>
            <Star fill={start ? 'currentColor' : 'none'} /></button>
          <button type="button" aria-label={`Replace view for ${item.name}`} title="Replace with current camera position" disabled={captureDisabled}
            onClick={() => replace(item)}><RotateCcw /></button>
          <button type="button" aria-label={`Delete ${item.name}`} title="Delete view"
            onClick={() => save({ ...index, destinations: destinations.filter(other => other.id !== item.id), landingId: start ? null : landingId }, 'Delete destination')}><Trash2 /></button>
        </div>
        {options === item.id && <div className="workbench-index__options" role="group" aria-label={`Options for ${item.name}`}
          onKeyDown={event => {
            if (event.key !== 'Escape') return;
            event.stopPropagation(); event.preventDefault();
            event.currentTarget.parentElement.querySelector('.workbench-index__grip').focus();
            setOptions(null);
          }}>
          <label><input type="checkbox" checked={item.visibility === 'PUBLIC'} onChange={event => update({ ...item, visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
          <label>Follow group<select value={item.follow?.groupId || ''} onChange={event => follow(item, event.target.value)}>
            <option value="">Fixed view</option>
            {item.follow && !content.workbenchGroups?.some(group => group.id === item.follow.groupId) && <option value={item.follow.groupId}>Removed group</option>}
            {(content.workbenchGroups || []).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select></label>
          {item.follow && !workbenchDestinationAnchor(content, item.follow, getFrame) && <p>Using the saved view. Choose a group to reconnect it.</p>}
        </div>}
      </li>;
    })}</ol>
    {owner && <button type="button" className="workbench-index__add" aria-label="Add view" title="Save current camera position"
      disabled={captureDisabled || destinations.length >= MAX_WORKBENCH_DESTINATIONS}
      onClick={() => setEditing(add() ?? null)}><Plus /> View</button>}
  </nav>;
}
