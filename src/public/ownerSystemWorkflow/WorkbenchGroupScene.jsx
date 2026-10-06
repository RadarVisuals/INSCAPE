import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import WorkbenchGroupStack from './WorkbenchGroupStack.jsx';
import { workbenchGroupWindowIds, workbenchGroupModules, WORKBENCH_GROUP_STACK_SIZE } from '../../systemWorkflow/domain/workbenchGroups.js';
import { editWorkbenchGroups } from '../../systemWorkflow/workbenchGroupSession.js';
import { workbenchSelectionBounds } from './workbenchViewScale.js';
import { clampWorkbenchPosition } from './workbenchSpace.js';
import { workbenchGroupLayout, compactWorkbenchGroupRectangles } from './workbenchGroupLayout.js';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';

// Group browsing owns temporary presentation geometry and visibility. Registered modules stay mounted, keep
// their authored frames, and continue to own their content and editing state.
export function useWorkbenchGroupScene({ view, draft, hostRef, navigation, sceneRef, disabled }) {
  const [openId, setOpenId] = useState(null), [error, setError] = useState(''), [focusedId, setFocusedId] = useState('');
  const revision = useSyncExternalStore(view.subscribe, view.snapshot);
  const latest = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(innerWidth);
  useEffect(() => { const resize = () => setViewportWidth(innerWidth); addEventListener('resize', resize); return () => removeEventListener('resize', resize); }, []);
  const groups = draft.workbenchGroups || [];
  const active = groups.find(group => group.id === openId) || null;
  const ids = group => workbenchGroupWindowIds(draft, group).filter(id => view.entries.has(id));
  const authoredRectangles = group => Object.fromEntries(ids(group).flatMap(id => {
    const local = view.transforms[id] || { scale: 1, x: 0, y: 0 };
    const frame = local.frame || view.frames.get(id)?.current;
    return frame ? [[id, { left: frame.left * local.scale + local.x, top: frame.top * local.scale + local.y, width: frame.width * local.scale, height: frame.height * local.scale }]] : [];
  }));
  const authoredBounds = group => workbenchSelectionBounds(Object.values(authoredRectangles(group)));
  const layout = group => workbenchGroupLayout(ids(group).flatMap(id => {
    const frame = view.frames.get(id)?.current; return frame ? [{ id, frame }] : [];
  }), group.position || authoredBounds(group) || { left: 8, top: 8 }, viewportWidth);
  const bounds = group => layout(group).bounds;
  const spread = active && !disabled ? layout(active) : { transforms: {}, rectangles: {} };
  const spreadKey = JSON.stringify(spread.transforms);
  useLayoutEffect(() => { view.setPresentationTransforms(current => JSON.stringify(current) === spreadKey ? current : spread.transforms); }, [spreadKey, view.setPresentationTransforms]);
  useLayoutEffect(() => () => { view.setPresentationTransforms({}); view.setHiddenModuleIds([]); }, [view.setPresentationTransforms, view.setHiddenModuleIds]);
  latest.current = { groups, active, ids, bounds, authoredBounds, authoredRectangles, spread, focusedId, navigation, view, disabled };
  useLayoutEffect(() => {
    const api = { capture: () => latest.current.active ? { id: latest.current.active.id, itemId: latest.current.focusedId } : null,
      restore: context => {
        const id = context?.id || context;
        setOpenId(latest.current.groups.some(group => group.id === id) ? id : null);
        setFocusedId(latest.current.view.entries.has(context?.itemId) ? context.itemId : '');
      },
      returnTargets: context => {
        const id = context?.id || context;
        const current = latest.current, group = current.active;
        if (!group || group.id === id) return;
        if (group.position) return compactWorkbenchGroupRectangles(current.ids(group), group.position);
        return current.authoredRectangles(group);
      } };
    sceneRef.current = api;
    return () => { if (sceneRef.current === api) sceneRef.current = null; };
  }, [sceneRef]);
  useEffect(() => { if (disabled || openId && !active) setOpenId(null); }, [disabled, openId, active]);
  useLayoutEffect(() => {
    const hidden = new Set(disabled ? [] : groups.filter(group => group.position && group.id !== active?.id).flatMap(ids));
    view.setHiddenModuleIds(current => JSON.stringify(current) === JSON.stringify([...hidden]) ? current : [...hidden]);
    // Membership drops can hide the current selection without using Stack.
    // Remove it at the visibility boundary so tools and Keeper receive the same truth.
    view.setSelection(current => current.some(id => hidden.has(id)) ? current.filter(id => !hidden.has(id)) : current);
    const focused = new Set(active ? ids(active) : []), nodes = [...view.entries];
    for (const [id, node] of nodes) {
      node.toggleAttribute('data-workbench-group-presented', !disabled && focused.has(id));
      node.toggleAttribute('data-workbench-group-hidden', !disabled && hidden.has(id));
      node.toggleAttribute('data-workbench-group-muted', !disabled && Boolean(active) && !focused.has(id));
      // Inert is owned only while this presentation hides a registered window.
      if (!disabled && hidden.has(id) && !node.inert) { node.inert = true; node.dataset.groupOwnsInert = ''; }
      else if ((disabled || !hidden.has(id)) && node.hasAttribute('data-group-owns-inert')) { node.inert = false; delete node.dataset.groupOwnsInert; }
    }
    return () => { for (const [, node] of nodes) {
      node.removeAttribute('data-workbench-group-presented'); node.removeAttribute('data-workbench-group-hidden'); node.removeAttribute('data-workbench-group-muted');
      if (node.hasAttribute('data-group-owns-inert')) { node.inert = false; delete node.dataset.groupOwnsInert; }
    } };
  }, [groups, active, revision, disabled, view.entries, view.selection, view.setSelection]);
  const open = useCallback(group => {
    const current = latest.current, target = current.groups.find(item => item.id === group.id);
    if (!target || current.disabled || !current.bounds(target)) return false;
    return current.navigation.focusDestination({ remember: current.active?.id !== target.id,
      origins: target.position ? compactWorkbenchGroupRectangles(current.ids(target), target.position) : current.authoredRectangles(target),
      prepare: () => flushSync(() => { setOpenId(target.id); setFocusedId(''); current.view.setSelection([]); }),
      getBounds: () => { const next = latest.current.groups.find(item => item.id === target.id); return next && latest.current.bounds(next); } });
  }, []);
  const stack = group => {
    const rect = authoredBounds(group), camera = navigation.getCamera();
    const position = clampWorkbenchPosition(rect || { left: (innerWidth / 2 - camera.offset.x) / camera.scale, top: (innerHeight / 2 - camera.offset.y) / camera.scale }, WORKBENCH_GROUP_STACK_SIZE);
    try {
      editWorkbenchGroups(view.store, view.profileAddress, { type: 'position', id: group.id, expected: group, position });
      view.setSelection([]); setOpenId(null); setError('');
    } catch (failure) { setError(failure.message); }
  };
  const focusItem = id => { if (navigation.focusDestination({ replaceHistory: Boolean(focusedId), getBounds: () => latest.current.spread.rectangles[id] || null })) setFocusedId(id); };
  return { active, open, stack, bounds, error, setError, back: navigation.goBack, focusItem, focusedId, ids: active ? ids(active) : [] };
}

export function WorkbenchGroupStacks({ view, draft, hostRef, scene, locked, dropTarget, onManage, onError }) {
  const groups = draft.workbenchGroups || [], names = workbenchGroupModules(draft);
  const itemIndex = scene.ids.indexOf(scene.focusedId);
  if (!hostRef.current) return null;
  const previews = group => group.memberIds.flatMap(id => {
    const image = draft.imageModules?.find(item => item.id === id)?.sides?.[0]?.asset;
    const keeper = draft.keeperDocks?.find(item => item.id === id)?.asset;
    const asset = image || keeper;
    return asset?.media?.url ? [resolvePublishedAssetUrl(asset.media.url)] : [];
  }).slice(0, 3);
  return createPortal(<>
    {groups.filter(group => group.position && group.id !== scene.active?.id).map(group => <WorkbenchGroupStack key={group.id} {...{ group, view, scene, locked, dropTarget, onManage, onError }} previews={previews(group)} />)}
    {groups.length > 0 && <nav className="workbench-group-browsing" data-workbench-navigation-obstacle data-workbench-group-tools aria-label="Workbench destinations">
      <div className="workbench-group-routes" aria-label="Named groups">{groups.map(group => <button key={group.id} type="button" disabled={locked}
        aria-current={scene.active?.id === group.id ? 'location' : undefined} title={group.name} onClick={() => { if (!scene.open(group)) onManage(group); }}>{group.name}</button>)}</div>
      {scene.active && <div className="workbench-group-reading" role="group" aria-label="Open Workbench group">
      <label>Item<select aria-label="Group item" disabled={locked} value={scene.focusedId} onChange={event => scene.focusItem(event.target.value)}><option value="" disabled>Choose an item</option>
        {scene.ids.map((id, index) => <option key={id} value={id}>{names.get(id) || 'Text frame ' + (index + 1)}</option>)}</select></label>
      <button type="button" aria-label="Previous group item" disabled={locked || itemIndex <= 0} onClick={() => scene.focusItem(scene.ids[itemIndex - 1])}>←</button>
      <button type="button" aria-label="Next group item" disabled={locked || itemIndex >= scene.ids.length - 1} onClick={() => scene.focusItem(scene.ids[itemIndex + 1])}>→</button><button type="button" disabled={locked} onClick={scene.back}>Back</button></div>}
    </nav>}
    {scene.error && <p className="workbench-move-error" role="alert">{scene.error}</p>}
  </>, hostRef.current);
}
