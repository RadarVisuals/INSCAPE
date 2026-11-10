import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import RackMenu from '../menus/RackMenu.jsx';
import { nextWorkbenchObject, workbenchObjectsAtPoint } from './workbenchObjectPicking.js';
import { artworkModuleId, artworkRecords } from '../../systemWorkflow/domain/artworkLayers.js';
import { editArtworkLayers } from '../../systemWorkflow/artworkLayerSession.js';
import { useEditorCells } from '../../reception/EditorCellsContext.jsx';

const controls = 'input,textarea,select,[contenteditable="true"],button:not([data-workbench-selectable]),a,[role="separator"],[data-workbench-toolbar],[data-workbench-selection-tools],[data-system-workflow-panel],[data-context-tools],[role="menu"],[data-immersive]';

const noSubscription = () => () => {}, noSnapshot = () => 0;
const order = [['front', 'Bring to front'], ['forward', 'Move forward'], ['backward', 'Move backward'], ['back', 'Send to back']];

export default function useWorkbenchObjectPicker({ hostRef, view, disabled, locked, isBusy, historyBlocked }) {
  const cells = useEditorCells();
  useSyncExternalStore(view.subscribeTools || noSubscription, view.toolsSnapshot || noSnapshot);
  const current = useRef(null), [menu, setMenu] = useState(null), [preview, setPreview] = useState(null), [error, setError] = useState('');
  current.current = { view, cells, isBusy, historyBlocked, enabled: Boolean(view.store) && !disabled && !locked && view.interactionTool === 'select' };
  const close = useCallback(() => { setMenu(null); setPreview(null); }, []);
  const choose = useCallback(id => {
    const { view, enabled } = current.current, node = view.entries.get(id);
    if (!enabled || current.current.isBusy?.() || !node?.isConnected || node.hasAttribute('data-workbench-group-hidden') || view.presentationTransforms?.[id]) return;
    view.setSelection([id]);
    // Focus activates the module's own editing tools without lifting its paint.
    (node.querySelector('[data-workbench-selectable]') || hostRef.current)?.focus({ preventScroll: true });
    close();
  }, [hostRef, close]);
  const pick = useCallback(event => {
    if (!current.current.enabled || event.button !== 0 || !(event.ctrlKey || event.metaKey)
      || event.shiftKey || event.altKey || event.target.closest?.(controls)) return false;
    const { view } = current.current;
    const hits = workbenchObjectsAtPoint(view, hostRef.current, { x: event.clientX, y: event.clientY });
    const id = nextWorkbenchObject(hits, view.selection);
    if (!id) return false;
    event.preventDefault(); event.stopPropagation(); choose(id); return true;
  }, [hostRef, choose]);
  const targetFor = id => {
    const { view, cells } = current.current, moduleId = artworkModuleId(view.content, id);
    const cell = cells?.cells.find(cell => cell.id === moduleId || cell.members.includes(moduleId));
    return cell && cells.editingCellId !== cell.id ? cell.id : moduleId;
  };
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const open = event => {
      if (!current.current.enabled || current.current.isBusy?.()
        || event.target.closest?.(controls) && !event.target.matches?.('[data-editor-cell-surface]')) return;
      const keyboard = event.type === 'keydown';
      const object = event.target.closest?.('[data-workbench-view-id],[data-editor-cell-surface]');
      const objectId = object?.dataset.editorCellSurface || object?.dataset.workbenchViewId;
      // Object headers can live outside the artwork in the viewport overlay.
      // Keyboard actions use the registered artwork's bounds, not its toolbar.
      const focused = keyboard ? current.current.view.entries.get(objectId || current.current.view.selection[0]) || object
        : object || current.current.view.entries.get(current.current.view.selection[0]);
      const rect = focused?.getBoundingClientRect();
      const anchor = !keyboard ? { x: event.clientX, y: event.clientY }
        : { x: rect ? rect.left + rect.width / 2 : 0, y: rect ? rect.top + rect.height / 2 : 0 };
      const hits = workbenchObjectsAtPoint(current.current.view, host, anchor);
      if (!hits.length) return;
      const { view } = current.current;
      const selected = view.selection.length === 1 ? view.selection[0] : null;
      const preferred = keyboard ? object?.dataset.editorCellSurface || object?.dataset.workbenchViewId || selected
        : event.target.closest?.('.workbench-selection') ? selected : null;
      const target = targetFor(hits.find(item => item.id === preferred)?.id || hits[0].id);
      if (keyboard && !view.toolSources.get(target)?.current.actions) return;
      event.preventDefault(); event.stopPropagation();
      view.setSelection([target]);
      const trigger = document.activeElement, entry = view.entries.get(target);
      // Selecting an object can move its header into viewport controls and
      // replace the focused DOM node. Resolve that header within this host;
      // a removed/replaced artwork must never return focus into another scene.
      const returnFocus = { focus() {
        if (!host.isConnected || entry && (!entry.isConnected || view.entries.get(target) !== entry)) return;
        const live = trigger?.isConnected ? trigger : [...host.querySelectorAll('header[data-workbench-view-id]')]
          .find(node => node.dataset.workbenchViewId === target);
        (live || host).focus({ preventScroll: true });
      } };
      setMenu({ anchor, hits, target, generation: view.store.getGeneration(), returnFocus }); setPreview(null); setError('');
    };
    const key = event => {
      if ((event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')
        && event.target.closest?.('[data-workbench-view-id],.workbench-selection,[data-editor-cell-surface]')) open(event);
    };
    host.addEventListener('contextmenu', open, true);
    host.addEventListener('keydown', key, true);
    host.addEventListener('wheel', close, true);
    globalThis.addEventListener('resize', close); globalThis.addEventListener('blur', close);
    return () => { host.removeEventListener('contextmenu', open, true); host.removeEventListener('keydown', key, true); host.removeEventListener('wheel', close, true);
      globalThis.removeEventListener('resize', close); globalThis.removeEventListener('blur', close); };
  }, [hostRef, close]);
  useEffect(() => { close(); setError(''); }, [disabled, locked, view.store, view.profileAddress, view.interactionTool, close]);
  const target = menu && artworkRecords(view.content).find(item => item.id === menu.target);
  const actions = target && view.toolSources.get(target.id)?.current.actions;
  const owner = cells?.cells.find(cell => cell.members.includes(target?.id));
  const blocked = Boolean(historyBlocked || actions?.disabled || owner?.lockedMembers?.includes(target?.id));
  const candidates = menu?.hits.map(item => ({ id: `pick:${item.id}`, label: item.label, selected: view.selection.includes(item.id) })) || [];
  const commands = actions ? [
    { id: 'duplicate', label: 'Duplicate', disabled: blocked || actions.duplicate.disabled, reason: historyBlocked || actions.duplicate.reason },
    { id: 'order', label: 'Layer order', disabled: blocked },
    { id: 'delete', label: 'Delete', disabled: blocked, reason: historyBlocked || undefined },
    ...(actions.items || []).map(item => ({ ...item, disabled: blocked || item.disabled })),
    ...(candidates.length > 1 ? [{ id: 'pick', label: 'Select object here' }] : []),
  ] : candidates;
  const command = id => {
    if (id.startsWith('pick:')) {
      const windowId = id.slice(5);
      if (!actions) { choose(windowId); return; }
      const target = targetFor(windowId);
      view.setSelection([target]); setPreview(null); setMenu(value => ({ ...value, target })); return;
    }
    try {
      const latest = current.current, source = latest.view.toolSources.get(menu.target)?.current.actions;
      if (!latest.enabled || latest.isBusy?.() || latest.historyBlocked || source?.disabled
        || latest.view.store.getGeneration() !== menu.generation) throw new Error('The artwork changed. Reopen its menu and try again.');
      if (blocked) return;
      if (id === 'duplicate') { if (source.duplicate.disabled) return; source.duplicate.run(); }
      else if (id === 'delete' || order.some(([direction]) => direction === id)) {
        editArtworkLayers(view.store, view.profileAddress, { type: id === 'delete' ? 'delete' : 'order', ids: [menu.target], direction: id }, menu.generation, view.getPresentation());
        if (id === 'delete') view.clearSelection();
      } else {
        const group = source.items?.find(item => item.children?.some(child => child.id === id));
        const action = group?.children?.find(item => item.id === id) || source.items?.find(item => item.id === id);
        if (group?.disabled || !action || action.disabled || !action.run) return;
        action.run();
      }
      close();
      requestAnimationFrame(() => {
        const selected = current.current.view.entries.get(current.current.view.selection[0]);
        (selected?.querySelector('[data-workbench-selectable]') || hostRef.current)?.focus({ preventScroll: true });
      });
    } catch (failure) { close(); setError(failure.message); }
  };
  const previewNode = preview && view.entries.get(preview);
  const frame = previewNode?.isConnected ? previewNode.getBoundingClientRect() : null;
  return { pick, element: hostRef.current && createPortal(<div data-workbench-selection-tools>
    {error && <p className="workbench-move-error" role="alert" onClick={() => setError('')}>{error}</p>}
    {frame && <div className="workbench-object-preview" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }} />}
    {menu && <RackMenu key={menu.target} palette="editor" anchor={menu.anchor} label={actions ? `${target.name} actions` : 'Select object here'} className={`workbench-object-menu${actions ? '' : ' workbench-object-menu--picker'}`}
      commands={commands} getSubmenuCommands={id => {
        if (id === 'order') return order.map(([id, label]) => ({ id, label, disabled: blocked }));
        if (id === 'pick') return candidates;
        const group = actions?.items?.find(item => item.id === id);
        return group?.children?.map(item => ({ ...item, disabled: blocked || group.disabled || item.disabled })) || [];
      }}
      returnFocus={menu.returnFocus} onPreviewCommand={id => setPreview(id?.startsWith('pick:') ? id.slice(5) : null)} onCommand={command} onClose={close} />}
  </div>, hostRef.current) };
}
