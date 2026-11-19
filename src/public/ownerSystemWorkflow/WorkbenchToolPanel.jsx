import ToolPanel from '../../ui/ToolPanel.jsx';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MoreHorizontal } from 'lucide-react';
import RackMenu from '../menus/RackMenu.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useSideDock } from './WorkbenchSideDock.jsx';
import { dockSide, sideDockEdge, sideDockFrames } from './workbenchSideDockState.js';

const noSubscription = () => () => {};
const emptySnapshot = () => null;
// One screen shell for tools and utilities. Docking changes geometry only.
export default function WorkbenchToolPanel({ dockId, commitFloatingFrameOnRelease = false, locationCommands = [], onLocationCommand, ...props }) {
  const { navigationTop = 0 } = useWorkbenchView();
  const controller = useSideDock();
  const state = useSyncExternalStore(controller?.subscribe || noSubscription, controller?.getSnapshot || emptySnapshot);
  const id = dockId || props.title;
  const gesture = useRef(null), panel = useRef(null);
  const [menu, setMenu] = useState(null);
  useLayoutEffect(() => {
    if (controller && !props.hidden) return controller.register(id, props.minimumWidth ?? 280, panel.current.closest('main') || panel.current.parentElement);
  }, [controller, id, props.hidden, props.minimumWidth]);
  useLayoutEffect(() => {
    // An explicitly opened/activated tool joins the same foreground owner as a
    // pointer-activated tool; its first control must not sit behind Navigator.
    if (props.active && !props.hidden) controller?.activate(id);
  }, [controller, id, props.active, props.hidden]);
  const frames = state ? sideDockFrames(state.layout, state.windows, state.viewport) : {};
  const attached = frames[id];
  const side = attached ? dockSide(state.layout.items.find(item => item.id === id)) : null;
  const collapsed = Boolean(side && state.layout.collapsed?.[side]);
  const column = state?.layout.items.filter(item => dockSide(item) === side && frames[item.id]);
  const nearEdge = event => state && sideDockEdge(event, state.viewport);
  const change = frame => {
    const next = typeof frame === 'function' ? frame(attached || props.frame) : frame;
    if (attached && !gesture.current) controller.resize(id, next);
    else props.onFrameChange(next);
  };
  const start = event => {
    gesture.current = { layout: state?.layout, frame: props.frame, moved: false, x: event.clientX, y: event.clientY };
    props.onMoveStart?.(event);
  };
  const move = event => {
    const drag = gesture.current;
    if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 6) {
      drag.moved = true;
      if (attached) controller.detach(id);
      controller?.preview(nearEdge(event));
    }
    props.onMove?.(event);
  };
  const finish = (cancelled, event) => {
    const drag = gesture.current; gesture.current = null;
    controller?.preview(null);
    const target = !cancelled && drag?.moved && nearEdge(event);
    if (cancelled && drag) {
      if (drag.layout && controller.getSnapshot().layout !== drag.layout) controller.restore(drag.layout);
      if (!commitFloatingFrameOnRelease) props.onFrameChange(drag.frame);
    } else if (target) controller.attach(id, props.frame, event.clientY, target);
    props.onMoveEnd?.(cancelled, event);
    return Boolean(target);
  };
  const toggle = target => {
    if (target === 'floating' && attached) {
      if (!commitFloatingFrameOnRelease) props.onFrameChange({ ...props.frame, left: Math.max(0, attached.left + (side === 'left' ? 32 : -32)), top: attached.top + 24 });
      controller.detach(id);
    } else controller.attach(id, props.frame, Infinity, target);
  };
  const openMenu = event => {
    if (!controller || event.defaultPrevented || !event.target.closest('.workbench-tool-panel-header')) return;
    event.preventDefault(); event.stopPropagation();
    const target = event.target.closest('button') || panel.current.querySelector('.workbench-tool-panel-grip');
    const rect = target.getBoundingClientRect();
    setMenu({ target, anchor: { x: event.type === 'contextmenu' ? event.clientX : rect.left, y: event.type === 'contextmenu' ? event.clientY : rect.bottom } });
  };
  const dockControl = controller && <button type="button" className="workbench-tool-panel-close" aria-label={props.title + ' window options'}
    aria-haspopup="menu" aria-expanded={Boolean(menu)} title="Window options" onClick={openMenu}><MoreHorizontal size={16} strokeWidth={1.5} /></button>;
  const inward = side === 'left' ? 'e' : 'w';
  const last = column?.at(-1)?.id;
  return <><ToolPanel {...props} hidden={props.hidden || collapsed} navigationTop={navigationTop}
    onContextMenu={openMenu} onKeyDown={event => {
      props.onKeyDown?.(event);
      if (!event.defaultPrevented && (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) openMenu(event);
    }}
    panelRef={node => { panel.current = node; if (typeof props.panelRef === 'function') props.panelRef(node); else if (props.panelRef) props.panelRef.current = node; }}
    edgeMargin={0} data-side-docked={Boolean(attached) || undefined} data-dock-side={side || undefined}
    frame={attached || props.frame} onFrameChange={change} onMoveStart={start} onMove={move} onMoveEnd={finish}
    deferFrameChange={commitFloatingFrameOnRelease ? edge => !edge || !attached : undefined}
    floatingFrame={commitFloatingFrameOnRelease && attached ? props.frame : undefined}
    minimumHeight={attached ? 72 : props.minimumHeight}
    preservePreferredFrame={Boolean(attached) || !props.fitContentHeight}
    fitContentHeight={attached ? false : props.fitContentHeight}
    zIndex={state?.active === id ? 88 : props.zIndex}
    onActivate={() => { controller?.activate(id); props.onActivate?.(); }}
    resizeEdges={attached ? [inward, ...(last !== id ? ['s', `s${inward}`] : [])] : undefined}
    headerActions={<>{props.headerActions}{dockControl}</>} />
    {menu && !collapsed && !props.hidden && <RackMenu label={props.title + ' window options'} palette="editor"
      anchor={menu.anchor} returnFocus={menu.target} onClose={() => setMenu(null)}
      commands={[{ id: 'floating', label: 'Floating', checkable: true, selected: !attached },
        { id: 'left', label: 'Dock on left', checkable: true, selected: side === 'left' },
        { id: 'right', label: 'Dock on right', checkable: true, selected: side === 'right' }, ...locationCommands]}
      onCommand={target => { setMenu(null);
        if (['left', 'right'].includes(target) || target === 'floating' && attached) toggle(target);
        else if (target !== 'floating') { onLocationCommand?.(target); return; }
        requestAnimationFrame(() => panel.current?.querySelector('.workbench-tool-panel-grip')?.focus()); }} />}
  </>;
}
