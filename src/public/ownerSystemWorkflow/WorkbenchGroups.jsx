import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { clampWorkbenchPosition } from './workbenchSpace.js';
import { WORKBENCH_GROUP_STACK_SIZE } from '../../systemWorkflow/domain/workbenchGroups.js';
import { Image, Layers, Monitor, Square, Type, X } from 'lucide-react';
import WorkbenchToolPanel from './WorkbenchToolPanel.jsx';
import { editWorkbenchGroups } from '../../systemWorkflow/workbenchGroupSession.js';
import { workbenchGroupModules, workbenchGroupWindowIds, workbenchMemberIds } from '../../systemWorkflow/domain/workbenchGroups.js';
import './workbenchGroups.css';
import { useWorkbenchGroupScene, WorkbenchGroupStacks } from './WorkbenchGroupScene.jsx';

const layerIcons = { text: Type, image: Image, shape: Square };
const EMPTY_GROUPS = Object.freeze([]);

// This owner tool edits membership through the draft store. Selecting a saved
// group only selects its live windows; navigation remains an explicit action.
export default function WorkbenchGroups({ view, hostRef, locked, dropRef, historyBlocked, navigation, sceneRef, disabled, open, onOpenChange: setOpen, returnFocus, showTrigger = true }) {
  const { bounds: areaBounds } = useWorkbenchArea();
  const { store, profileAddress, selection, setSelection, entries } = view;
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [activeId, setActiveId] = useState(null);
  const [managing, setManaging] = useState(false);
  const [frame, setFrame] = useState(() => ({ left: Math.max(8, innerWidth - 364), top: 72, width: 340, height: 490 }));
  const [name, setName] = useState(''), [error, setError] = useState('');
  const [dropTarget, setDropTarget] = useState(null);
  const trigger = useRef(null), manageTrigger = useRef(null), input = useRef(null), heading = useRef(null);
  const scene = useWorkbenchGroupScene({ view, content: draft, navigation, sceneRef, disabled });
  const groups = draft.workbenchGroups || EMPTY_GROUPS, active = groups.find(group => group.id === activeId);
  const modules = workbenchGroupModules(draft), selected = view.selectionMode === 'activation' ? [] : workbenchMemberIds(draft, selection);
  const grouped = new Set(groups.flatMap(group => group.memberIds));
  const available = selected.filter(id => !grouped.has(id));
  const canGroup = selected.length > 0 && available.length === selected.length;
  const showingMembers = Boolean(active && managing);
  const rows = showingMembers ? active.memberIds : selected;
  useEffect(() => { setName(active?.name || ''); }, [active?.id, active?.name]);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open]);
  const close = () => {
    const origin = manageTrigger.current || (showTrigger ? trigger.current : returnFocus?.current);
    manageTrigger.current = null;
    setOpen(false); setManaging(false);
    (origin?.isConnected ? origin : hostRef.current)?.focus({ preventScroll: true });
  };
  const perform = useCallback(action => {
    try {
      const id = editWorkbenchGroups(store, profileAddress, action);
      setError(''); return id;
    } catch (failure) { setError(failure.message); return null; }
  }, [store, profileAddress]);
  const positionGroup = (group, position) => perform({ type: 'position', id: group.id, expected: group, position });
  const stack = group => {
    const rect = scene.authoredBounds(group), camera = navigation.getCamera();
    const position = clampWorkbenchPosition(rect || { left: (innerWidth / 2 - camera.offset.x) / camera.scale,
      top: (innerHeight / 2 - camera.offset.y) / camera.scale }, WORKBENCH_GROUP_STACK_SIZE, areaBounds);
    if (positionGroup(group, position)) { setSelection([]); scene.close(); }
  };
  const create = memberIds => {
    const id = perform({ type: 'create', name: (!active && name.trim()) || `Group ${groups.length + 1}`, memberIds });
    if (id) { setActiveId(id); (managing ? input : heading).current?.focus({ preventScroll: true }); }
  };
  const groupSelection = () => { if (canGroup) create(selected); };
  const newGroup = () => { setActiveId(null); setName(''); setError(''); (managing ? input : heading).current?.focus({ preventScroll: true }); };
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
    if (locked || disabled || !groups.length) {
      if (dropTarget) setDropTarget(null);
      return;
    }
    const targetAt = (pointer, ids) => {
      // The dragged artwork and its own controls follow the pointer. Other
      // artwork and panels still cover a destination when they are in front.
      const hit = document.elementsFromPoint(pointer.clientX, pointer.clientY)
        .find(node => !node.closest('.workbench-selection')
          && !ids.includes(node.closest('[data-workbench-view-id]')?.dataset.workbenchViewId));
      const node = hit?.closest('[data-workbench-group-drop]');
      return node && hostRef.current?.contains(node) ? groups.find(group => group.id === node.dataset.workbenchGroupDrop) : null;
    };
    dropRef.current = {
      preview(pointer, ids) { setDropTarget(targetAt(pointer, ids)?.id || null); },
      cancel() { setDropTarget(null); },
      commit(pointer, ids) {
        const group = targetAt(pointer, ids);
        if (!group) return false;
        const members = workbenchMemberIds(draft, ids);
        const id = perform({ type: 'members', id: group.id, expected: group,
          memberIds: [...new Set([...group.memberIds, ...members])] });
        if (id) setActiveId(id);
        setDropTarget(null); return true;
      },
    };
    return () => { dropRef.current = null; };
  }, [locked, disabled, groups, dropRef, dropTarget, hostRef, draft, perform]);
  return <>
    <WorkbenchGroupStacks content={draft} {...{ hostRef, scene, locked, dropTarget }} onManage={group => {
      manageTrigger.current = document.activeElement;
      setActiveId(group.id); setManaging(true); setOpen(true);
    }} onPosition={positionGroup} />
    {error && !open && <p className="workbench-move-error" role="alert">{error}</p>}
    {showTrigger && <button className="workflow-tactile-control" ref={trigger} type="button" disabled={locked} aria-expanded={open} aria-label="Workbench groups" onClick={() => open ? close() : setOpen(true)}>Groups</button>}
    {open && !locked && hostRef.current && createPortal(<WorkbenchToolPanel data-workbench-group-tools role="complementary" label="Workbench groups — Groups" title="Groups"
      moveLabel="Move Workbench groups window" closeLabel="Close Workbench groups" onClose={close}
      chrome="flat" className="workbench-groups workbench-utility-panel workbench-editor-panel" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor"
      frame={frame} onFrameChange={setFrame} fitContentHeight minimumWidth={240} minimumHeight={200} zIndex={90} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <div className="workbench-groups__body">
        <section aria-label={showingMembers ? `Members of ${active.name}` : 'Selected layers'}>
          <h3 ref={heading} tabIndex={-1}>{showingMembers ? `Members of ${active.name}` : 'Selected layers'}</h3>
          {rows.length > 0 ? <ol className="workbench-groups__members">
            {rows.map((id, index) => {
              const label = modules.get(id);
              const Icon = layerIcons[id.split(':')[0]] || Monitor;
              return <li key={id}><Icon aria-hidden="true" /><span>{label}{showingMembers && !entries.has(id) ? ' · closed' : ''}</span>
                {showingMembers && <>
                  <button type="button" aria-label={`Move ${label} earlier`} disabled={index === 0} onClick={() => reorder(index, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${label} later`} disabled={index === rows.length - 1} onClick={() => reorder(index, 1)}>↓</button>
                  <button type="button" aria-label={`Remove ${label} from group`} onClick={() => updateMembers(rows.filter(member => member !== id))}><X size={12} /></button>
                </>}
              </li>;
            })}
          </ol> : <p>{showingMembers ? 'Add the selection, or drag selected layers onto the group name.' : 'Shift-click layers to select them.'}</p>}
          {!showingMembers && <>
            {available.length !== selected.length && <p>Selection includes layers that already belong to a group.</p>}
            <button className="workbench-groups__create" type="button" disabled={!canGroup} onClick={groupSelection}><Layers aria-hidden="true" />Group selection</button>
          </>}
          <button type="button" disabled={!active} title={active ? `Ungroup ${active.name} and keep its layers` : 'Choose a saved group to ungroup it'}
            onClick={() => { if (perform({ type: 'ungroup', id: active.id, expected: active })) newGroup(); }}>{active ? `Ungroup · ${active.name}` : 'Ungroup'}</button>
        </section>
        {error && <p role="alert">{error}</p>}
        <details open={managing} className="workbench-groups__manage">
          <summary onClick={event => { event.preventDefault(); setManaging(value => !value); }}>Manage groups</summary>
          <form onSubmit={event => { event.preventDefault(); if (active) perform({ type: 'rename', id: active.id, expected: active, name }); else groupSelection(); }}>
            <label>Group name<input ref={input} aria-label="Group name" maxLength={48} value={name} onChange={event => setName(event.target.value)} placeholder="Name this group" /></label>
            <div className="workbench-groups__actions">
              {active ? <><button type="submit" disabled={!name.trim()}>Rename</button><button type="button" onClick={newGroup}>New group</button></>
                : <button type="button" onClick={() => create([])}>Create empty</button>}
            </div>
          </form>
          <div className="workbench-groups__list" aria-label="Saved Workbench groups">
            {groups.map(group => <button key={group.id} type="button" data-workbench-group-drop={group.id} data-drop-target={dropTarget === group.id || undefined} aria-pressed={activeId === group.id} onClick={() => selectGroup(group)}>
              <strong>{group.name}</strong><span>{group.memberIds.length}</span>
            </button>)}
            {!groups.length && <p>No groups yet.</p>}
          </div>
          {active && <section aria-label={`Settings for ${active.name}`}>
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
          </section>}
          <footer className="workbench-groups__actions">
            <button type="button" disabled={Boolean(historyBlocked) || !history.undo} title={historyBlocked || history.undo || undefined} onClick={() => { if (!store.undo()) setError('Undo could not be saved. Try again.'); else setError(''); }}>Undo</button>
            <button type="button" disabled={Boolean(historyBlocked) || !history.redo} title={historyBlocked || history.redo || undefined} onClick={() => { if (!store.redo()) setError('Redo could not be saved. Try again.'); else setError(''); }}>Redo</button>
          </footer>
        </details>
      </div>
    </WorkbenchToolPanel>, hostRef.current)}
  </>;
}
