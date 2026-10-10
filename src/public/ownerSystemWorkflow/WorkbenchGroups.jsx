import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { clampWorkbenchPosition } from './workbenchSpace.js';
import { WORKBENCH_GROUP_STACK_SIZE } from '../../systemWorkflow/domain/workbenchGroups.js';
import { X } from '../InscapeIcons.jsx';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import { editWorkbenchGroups } from '../../systemWorkflow/workbenchGroupSession.js';
import { workbenchGroupModules, workbenchGroupWindowIds, workbenchMemberIds } from '../../systemWorkflow/domain/workbenchGroups.js';
import './workbenchGroups.css';
import { useWorkbenchGroupScene, WorkbenchGroupStacks } from './WorkbenchGroupScene.jsx';

// This owner tool edits membership through the draft store. Selecting a saved
// group only selects its live windows; navigation remains an explicit action.
export default function WorkbenchGroups({ view, hostRef, locked, dropRef, historyBlocked, navigation, sceneRef, disabled }) {
  const { store, profileAddress, selection, setSelection, entries } = view;
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [open, setOpen] = useState(false), [activeId, setActiveId] = useState(null);
  const [name, setName] = useState(''), [error, setError] = useState('');
  const [dropTarget, setDropTarget] = useState(null);
  const trigger = useRef(null), input = useRef(null), content = useRef(null);
  const scene = useWorkbenchGroupScene({ view, content: draft, hostRef, navigation, sceneRef, disabled });
  const groups = draft.workbenchGroups || [], active = groups.find(group => group.id === activeId);
  const modules = workbenchGroupModules(draft), selected = workbenchMemberIds(draft, selection);
  const grouped = new Set(groups.flatMap(group => group.memberIds));
  const available = selected.filter(id => !grouped.has(id));
  useEffect(() => { setName(active?.name || ''); }, [active?.id, active?.name]);
  useEffect(() => { if (open) input.current?.focus({ preventScroll: true }); }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const perform = action => {
    try {
      const id = editWorkbenchGroups(store, profileAddress, action);
      setError(''); return id;
    } catch (failure) { setError(failure.message); return null; }
  };
  const positionGroup = (group, position) => perform({ type: 'position', id: group.id, expected: group, position });
  const stack = group => {
    const rect = scene.authoredBounds(group), camera = navigation.getCamera();
    const position = clampWorkbenchPosition(rect || { left: (innerWidth / 2 - camera.offset.x) / camera.scale,
      top: (innerHeight / 2 - camera.offset.y) / camera.scale }, WORKBENCH_GROUP_STACK_SIZE);
    if (positionGroup(group, position)) { setSelection([]); scene.close(); }
  };
  const create = memberIds => {
    const id = perform({ type: 'create', name: name.trim() || `Group ${groups.length + 1}`, memberIds });
    if (id) setActiveId(id);
  };
  const updateMembers = memberIds => perform({ type: 'members', id: active.id, expected: active, memberIds });
  const selectGroup = group => {
    setActiveId(group.id); setError('');
    if (!group.position) setSelection(workbenchGroupWindowIds(draft, group).filter(id => entries.has(id)));
  };
  const reorder = (index, direction) => {
    const members = [...active.memberIds], target = index + direction;
    [members[index], members[target]] = [members[target], members[index]]; updateMembers(members);
  };
  const history = store.getHistory();
  useLayoutEffect(() => {
    if (locked) return;
    const targetAt = pointer => {
      const node = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest('[data-workbench-group-drop]');
      return node && hostRef.current?.contains(node) ? groups.find(group => group.id === node.dataset.workbenchGroupDrop) : null;
    };
    dropRef.current = {
      preview(pointer) { setDropTarget(targetAt(pointer)?.id || null); },
      cancel() { setDropTarget(null); },
      commit(pointer, ids) {
        const group = targetAt(pointer);
        if (!group) return false;
        const members = workbenchMemberIds(draft, ids);
        const id = perform({ type: 'members', id: group.id, expected: group,
          memberIds: [...new Set([...group.memberIds, ...members])] });
        if (id) setActiveId(id);
        setDropTarget(null); return true;
      },
    };
    return () => { dropRef.current = null; };
  });
  return <>
    <WorkbenchGroupStacks content={draft} {...{ hostRef, scene, locked, dropTarget }} onManage={group => { setActiveId(group.id); setOpen(true); }} onPosition={positionGroup} />
    {error && !open && <p className="workbench-move-error" role="alert">{error}</p>}
    <button ref={trigger} type="button" disabled={locked} aria-expanded={open} aria-label="Workbench groups" onClick={() => setOpen(value => !value)}>Groups</button>
    {open && !locked && hostRef.current && createPortal(<div data-workbench-group-tools onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <WorkbenchWindow label="Workbench groups" title="Groups" width={340} initialHeight={490} minimumHeight={200}
        initialX={Math.max(8, globalThis.innerWidth - 364)} initialY={72} resizable={false} chrome="bevel" className="workbench-groups"
        controls={<button type="button" aria-label="Close Workbench groups" onClick={close}><X size={14} /></button>}>
        <div ref={content} className="workbench-groups__body">
          <form onSubmit={event => { event.preventDefault(); if (active) perform({ type: 'rename', id: active.id, expected: active, name }); else create(selected); }}>
            <label>Group name<input ref={input} aria-label="Group name" maxLength={48} value={name} onChange={event => setName(event.target.value)} placeholder="Name this group" /></label>
            <div className="workbench-groups__actions">
              {active ? <><button type="submit" disabled={!name.trim()}>Rename</button><button type="button" onClick={() => { setActiveId(null); setName(''); setError(''); input.current?.focus(); }}>New group</button></>
                : <><button type="submit" disabled={!selected.length || available.length !== selected.length}>Create from selection</button>
                  <button type="button" onClick={() => create([])}>Create empty</button></>}
            </div>
          </form>
          {error && <p role="alert">{error}</p>}
          {!active && <p>{selected.length ? `${selected.length} selected${available.length !== selected.length ? ' · some already belong to a group' : ''}` : 'Select modules with Shift-click or drag a selection on the Workbench.'}</p>}
          <div className="workbench-groups__list" aria-label="Saved Workbench groups">
            {groups.map(group => <button key={group.id} type="button" data-workbench-group-drop={group.id} data-drop-target={dropTarget === group.id || undefined} aria-pressed={activeId === group.id} onClick={() => selectGroup(group)}>
              <strong>{group.name}</strong><span>{group.memberIds.length}</span>
            </button>)}
            {!groups.length && <p>No groups yet.</p>}
          </div>
          {active && <section aria-label={`Members of ${active.name}`}>
            <label className="workbench-groups__visibility"><input type="checkbox" aria-label="Public group" checked={active.visibility === 'PUBLIC'}
              onChange={event => perform({ type: 'visibility', id: active.id, expected: active, visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Public group</label>
            <p>{active.visibility === 'PUBLIC' ? 'Publish the group name, position and public members. Private members stay private.' : 'This group is private. Its name and membership stay in your draft.'}</p>
            <div className="workbench-groups__actions">
              <button type="button" disabled={!available.length} onClick={() => updateMembers([...active.memberIds, ...available])}>Add selection ({available.length})</button>
              <button type="button" disabled={Boolean(active.position) || !active.memberIds.some(id => entries.has(id))} onClick={() => { selectGroup(active); hostRef.current?.focus({ preventScroll: true }); }}>Select members</button>
            </div>
            <div className="workbench-groups__actions">
              <button type="button" disabled={!scene.bounds(active)} onClick={() => { close(); requestAnimationFrame(() => scene.open(active)); }}>Open group</button>
              <button type="button" onClick={() => { if (active.position) { if (positionGroup(active, null)) scene.close(); } else stack(active); }}>{active.position ? 'Unstack' : 'Stack'}</button>
            </div>
            {active.position && <p>Stacked on the Workbench. Open to explore, or Unstack to edit the original layout.</p>}
            <ol className="workbench-groups__members">
              {active.memberIds.map((id, index) => <li key={id}>
                <span>{modules.get(id)}{entries.has(id) ? '' : ' · closed'}</span>
                <button type="button" aria-label={`Move ${modules.get(id)} earlier`} disabled={index === 0} onClick={() => reorder(index, -1)}>↑</button>
                <button type="button" aria-label={`Move ${modules.get(id)} later`} disabled={index === active.memberIds.length - 1} onClick={() => reorder(index, 1)}>↓</button>
                <button type="button" aria-label={`Remove ${modules.get(id)} from group`} onClick={() => updateMembers(active.memberIds.filter(member => member !== id))}><X size={12} /></button>
              </li>)}
            </ol>
            {!active.memberIds.length && <p>Add the selection, or drag selected modules onto the group name.</p>}
            <button type="button" onClick={() => { if (perform({ type: 'ungroup', id: active.id, expected: active })) { setActiveId(null); setName(''); } }}>Ungroup</button>
          </section>}
          <footer className="workbench-groups__actions">
            <button type="button" disabled={Boolean(historyBlocked) || !history.undo} title={historyBlocked || history.undo || undefined} onClick={() => { if (!store.undo()) setError('Undo could not be saved. Try again.'); else setError(''); }}>Undo</button>
            <button type="button" disabled={Boolean(historyBlocked) || !history.redo} title={historyBlocked || history.redo || undefined} onClick={() => { if (!store.redo()) setError('Redo could not be saved. Try again.'); else setError(''); }}>Redo</button>
          </footer>
        </div>
      </WorkbenchWindow>
    </div>, hostRef.current)}
  </>;
}
