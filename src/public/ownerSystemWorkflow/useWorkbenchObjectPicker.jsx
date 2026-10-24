import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RackMenu from '../menus/RackMenu.jsx';
import { nextWorkbenchObject, workbenchObjectsAtPoint } from './workbenchObjectPicking.js';

const controls = 'input,textarea,select,[contenteditable="true"],button:not([data-workbench-selectable]),a,[role="separator"],[data-workbench-toolbar],[data-workbench-selection-tools],[data-system-workflow-panel],[data-context-tools],[role="menu"],[data-immersive]';

export default function useWorkbenchObjectPicker({ hostRef, view, disabled, locked, isBusy }) {
  const current = useRef(null), [menu, setMenu] = useState(null), [preview, setPreview] = useState(null);
  current.current = { view, isBusy, enabled: Boolean(view.store) && !disabled && !locked && view.interactionTool === 'select' };
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
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const open = event => {
      if (!current.current.enabled || current.current.isBusy?.() || event.target.closest?.(controls)) return;
      const focused = current.current.view.entries.get(current.current.view.selection[0]);
      const rect = focused?.getBoundingClientRect();
      const anchor = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY }
        : { x: rect ? rect.left + rect.width / 2 : 0, y: rect ? rect.top + rect.height / 2 : 0 };
      const hits = workbenchObjectsAtPoint(current.current.view, host, anchor);
      if (!hits.length) return;
      event.preventDefault(); event.stopPropagation();
      setMenu({ anchor, hits, returnFocus: document.activeElement }); setPreview(null);
    };
    host.addEventListener('contextmenu', open, true);
    host.addEventListener('wheel', close, true);
    globalThis.addEventListener('resize', close); globalThis.addEventListener('blur', close);
    return () => { host.removeEventListener('contextmenu', open, true); host.removeEventListener('wheel', close, true);
      globalThis.removeEventListener('resize', close); globalThis.removeEventListener('blur', close); };
  }, [hostRef, close]);
  useEffect(close, [disabled, locked, view.store, view.profileAddress, view.interactionTool, close]);
  const previewNode = preview && view.entries.get(preview);
  const frame = previewNode?.isConnected ? previewNode.getBoundingClientRect() : null;
  return { pick, element: menu && hostRef.current && createPortal(<div data-workbench-selection-tools>
    {frame && <div className="workbench-object-preview" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }} />}
    <RackMenu anchor={menu.anchor} label="Select object here" className="workbench-object-menu"
      commands={menu.hits.map(item => ({ id: item.id, label: item.label, selected: view.selection.includes(item.id) }))}
      returnFocus={menu.returnFocus} onPreviewCommand={setPreview} onCommand={choose} onClose={close} />
  </div>, hostRef.current) };
}
