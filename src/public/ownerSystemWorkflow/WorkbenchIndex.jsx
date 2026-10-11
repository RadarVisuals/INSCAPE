import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { editWorkbenchIndex } from '../../systemWorkflow/workbenchIndexSession.js';
import { MAX_WORKBENCH_DESTINATIONS, resolveWorkbenchDestination, workbenchDestinationAnchor } from '../../systemWorkflow/domain/workbenchIndex.js';
import { workbenchGroupWindowIds } from '../../systemWorkflow/domain/workbenchGroups.js';
import './workbenchIndex.css';

const empty = Object.freeze({});
const noSubscribe = () => () => {};

export default function WorkbenchIndex({ hostRef, navigation, sceneRef, entryTarget }) {
  const view = useWorkbenchView(), owner = Boolean(view.store);
  const content = useSyncExternalStore(view.store?.subscribe || noSubscribe,
    view.store?.getSnapshot || (() => view.groupContent || empty));
  const index = content.workbenchIndex;
  const [visitorOpen, setVisitorOpen] = useState(null), [selected, setSelected] = useState(null);
  const [error, setError] = useState(''), [name, setName] = useState('');
  const started = useRef(false), current = useRef(null);
  current.current = { content, index, navigation };
  const getFrame = useCallback(id => view.frames.get(id)?.current, [view.frames]);
  const save = (next, label) => {
    try { editWorkbenchIndex(view.store, view.profileAddress, index, next, label); setError(''); return true; }
    catch (failure) { setError(failure.message); return false; }
  };
  const visit = useCallback(id => {
    const { navigation } = current.current;
    return navigation.focusDestination({ padding: 0, onArrive: () => view.setSelection([]),
      prepare: () => sceneRef.current?.restore(null),
      getBounds: () => {
        const { index, content } = current.current;
        return resolveWorkbenchDestination(index?.destinations.find(item => item.id === id), content, getFrame);
      } });
  }, [sceneRef, getFrame, view.setSelection]);
  useEffect(() => {
    if (owner || entryTarget || started.current || !index?.landingId || navigation.locked) return;
    let second;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      if (visit(index.landingId)) started.current = true;
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [owner, entryTarget, index?.landingId, navigation.locked, visit]);
  if (!index) return null;
  const open = owner ? index.open : visitorOpen ?? index.open;
  const toggle = () => owner ? save({ ...index, open: !open }, 'Toggle Index') : setVisitorOpen(!open);
  const entry = index.destinations.find(item => item.id === selected);
  const update = next => save({ ...index, landingId: next.visibility === 'PRIVATE' && index.landingId === next.id ? null : index.landingId, destinations: index.destinations.map(item => item.id === next.id ? next : item) }, 'Edit destination');
  const withFollow = (item, groupId) => {
    const { follow: _follow, ...fixed } = item;
    if (!groupId) return fixed;
    const group = content.workbenchGroups?.find(group => group.id === groupId);
    const anchorId = group && workbenchGroupWindowIds(content, group).find(id =>
      workbenchDestinationAnchor(content, { groupId, anchorId: id }, getFrame));
    const origin = anchorId && workbenchDestinationAnchor(content, { groupId, anchorId }, getFrame);
    if (!origin) throw new Error('Open a member of this group before linking a view to it.');
    return { ...fixed, follow: { groupId, anchorId, origin: { left: origin.left, top: origin.top } } };
  };
  const capture = () => {
    if (Object.keys(view.presentationTransforms || {}).length) throw new Error('Return from the expanded group before saving its canvas view.');
    const region = navigation.captureView();
    if (!region) throw new Error('Let the camera settle before saving a view.');
    return region;
  };
  const run = action => { try { action(); } catch (failure) { setError(failure.message); } };
  const moveEntry = direction => {
    const destinations = [...index.destinations], from = destinations.findIndex(item => item.id === selected), to = from + direction;
    if (from < 0 || to < 0 || to >= destinations.length) return;
    destinations.splice(to, 0, ...destinations.splice(from, 1)); save({ ...index, destinations }, 'Reorder destinations');
  };
  const pin = pinned => {
    const { scale, offset } = navigation.getCamera(), frame = index.window;
    const window = pinned ? { ...frame, left: Math.max(8, frame.left * scale + offset.x), top: Math.max(8, frame.top * scale + offset.y) }
      : { ...frame, left: Math.max(8, Math.min(3992 - frame.width, (frame.left - offset.x) / scale)),
        top: Math.max(8, Math.min(3992 - frame.height, (frame.top - offset.y) / scale)) };
    save({ ...index, pinned, window }, 'Pin Index');
  };
  const panel = open && hostRef.current && createPortal(<div className="workbench-index" data-system-workflow-panel="index" data-workbench-index="true">
    <WorkbenchWindow key={`${index.pinned}:${owner}`} label="Index" title="Destinations" chrome="bevel"
      viewId={index.pinned ? undefined : 'workbench:index'} registerView={false}
      width={index.window.width} initialHeight={index.window.height} initialX={index.window.left} initialY={index.window.top}
      minimumWidth={240} minimumHeight={180} resizableWidth resizable={owner} committedFrame={index.window}
      onLayoutCommit={owner ? window => save({ ...index, window }, 'Move or resize Index') : undefined}
      controls={<button type="button" aria-label="Close Index" className="system-workflow__window-cap" onClick={toggle}>×</button>}>
      <nav aria-label="Workbench destinations">
        {index.destinations.length === 0 && <p>Frame a composition, then save its view here.</p>}
        <ol>{index.destinations.map((item, order) => <li key={item.id}>
          <button type="button" disabled={navigation.locked} onClick={() => { if (!visit(item.id)) setError('This view is unavailable while another interaction is active.'); else setError(''); }}
            aria-label={`Go to ${item.name}`}><span>{String(order + 1).padStart(2, '0')}</span>{item.name}{index.landingId === item.id && <small>Start</small>}</button>
          {owner && <button type="button" aria-label={`Edit ${item.name}`} aria-pressed={selected === item.id} onClick={() => setSelected(selected === item.id ? null : item.id)}>Edit</button>}
        </li>)}</ol>
      </nav>
      {owner && <div className="workbench-index__editor">
        <form onSubmit={event => { event.preventDefault(); run(() => {
          const item = { id: `workbench-view:${crypto.randomUUID()}`, name: name.trim() || `View ${index.destinations.length + 1}`, view: capture(), visibility: 'PUBLIC' };
          if (save({ ...index, destinations: [...index.destinations, item] }, 'Save view')) { setName(''); setSelected(item.id); }
        }); }}>
          <label>New destination<input aria-label="Destination name" value={name} maxLength={48} placeholder="Name this view" onChange={event => setName(event.target.value)} /></label>
          <button type="submit" disabled={index.destinations.length >= MAX_WORKBENCH_DESTINATIONS || navigation.moving || navigation.locked}>Save current view</button>
        </form>
        {entry && <section aria-label={`Destination settings for ${entry.name}`}>
          <label>Name<input key={`${entry.id}:${entry.name}`} aria-label="Rename destination" defaultValue={entry.name} maxLength={48}
            onBlur={event => { const name = event.target.value.trim(); if (name && name !== entry.name) update({ ...entry, name }); }}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
          <label>Follow group<select aria-label="Follow group" value={entry.follow?.groupId || ''} onChange={event => run(() =>
            update(withFollow({ ...entry, view: resolveWorkbenchDestination(entry, content, getFrame) }, event.target.value)))}>
            <option value="">Fixed view</option>
            {entry.follow && !content.workbenchGroups?.some(group => group.id === entry.follow.groupId) && <option value={entry.follow.groupId}>Removed group</option>}
            {(content.workbenchGroups || []).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select></label>
          {entry.follow && !workbenchDestinationAnchor(content, entry.follow, getFrame) && <p>The linked member is unavailable. This destination uses its saved view; choose a group to reconnect it.</p>}
          <label className="workbench-index__check"><input type="checkbox" checked={entry.visibility === 'PUBLIC'} onChange={event => update({ ...entry, visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
          <div className="workbench-index__row">
            <button type="button" disabled={navigation.moving || navigation.locked} onClick={() => run(() => update(withFollow({ ...entry, view: capture() }, entry.follow?.groupId)))}>Update view</button>
            <button type="button" aria-label="Move destination up" disabled={index.destinations[0].id === entry.id} onClick={() => moveEntry(-1)}>↑</button>
            <button type="button" aria-label="Move destination down" disabled={index.destinations.at(-1).id === entry.id} onClick={() => moveEntry(1)}>↓</button>
            <button type="button" onClick={() => { if (save({ ...index, destinations: index.destinations.filter(item => item.id !== entry.id), landingId: index.landingId === entry.id ? null : index.landingId }, 'Delete destination')) setSelected(null); }}>Delete</button>
          </div>
        </section>}
        <label>Profile starting view<select aria-label="Profile starting view" value={index.landingId || ''} onChange={event => save({ ...index, landingId: event.target.value || null }, 'Set starting view')}>
          <option value="">Default</option>{index.destinations.filter(item => item.visibility === 'PUBLIC').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="workbench-index__check"><input type="checkbox" checked={index.pinned} onChange={event => pin(event.target.checked)} />Pin Index to screen</label>
      </div>}
      {error && <p role="alert">{error}</p>}
    </WorkbenchWindow>
  </div>, hostRef.current);
  return <><button type="button" aria-label="Toggle Index" aria-expanded={open} disabled={navigation.locked} onClick={toggle}>Index</button>{panel}</>;
}
