import ToolPanel from '../../ui/ToolPanel.jsx';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useSideDock } from './WorkbenchSideDock.jsx';
import { dockSide, sideDockEdge, sideDockFrames } from './workbenchSideDockState.js';

const noSubscription = () => () => {};
const emptySnapshot = () => null;
// One screen shell for tools and utilities. Docking changes geometry only.
export default function WorkbenchToolPanel({ dockId, ...props }) {
  const { navigationTop = 0 } = useWorkbenchView();
  const controller = useSideDock();
  const state = useSyncExternalStore(controller?.subscribe || noSubscription, controller?.getSnapshot || emptySnapshot);
  const id = dockId || props.title;
  const gesture = useRef(null), panel = useRef(null);
  useLayoutEffect(() => {
    if (controller && !props.hidden) return controller.register(id, props.minimumWidth ?? 280, panel.current.closest('main') || panel.current.parentElement);
  }, [controller, id, props.hidden, props.minimumWidth]);
  const frames = state ? sideDockFrames(state.layout, state.windows, state.viewport) : {};
  const attached = frames[id];
  const side = attached ? dockSide(state.layout.items.find(item => item.id === id)) : null;
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
    if (cancelled && drag) { if (drag.layout) controller.restore(drag.layout); props.onFrameChange(drag.frame); }
    else if (drag?.moved && nearEdge(event)) controller?.attach(id, props.frame, event.clientY, nearEdge(event));
    props.onMoveEnd?.(cancelled, event);
  };
  const toggle = target => {
    if (attached) {
      props.onFrameChange({ ...props.frame, left: Math.max(0, attached.left + (side === 'left' ? 32 : -32)), top: attached.top + 24 });
      controller.detach(id);
    } else controller.attach(id, props.frame, Infinity, target);
  };
  const dockControl = controller && (attached ? [side] : ['left', 'right']).map(target => {
    const Icon = target === 'left' ? attached ? PanelLeftOpen : PanelLeftClose : attached ? PanelRightOpen : PanelRightClose;
    return <button key={target} type="button" className="workbench-tool-panel-close" onClick={() => toggle(target)}
    aria-label={`${attached ? 'Undock' : 'Dock'} ${props.title}${attached ? '' : ` on ${target}`}`}
    title={attached ? 'Undock window' : `Dock on ${target}; drag the title to the ${target} edge`}><Icon /></button>;
  });
  const inward = side === 'left' ? 'e' : 'w';
  const last = state?.layout.items.filter(item => dockSide(item) === side && frames[item.id]).at(-1)?.id;
  return <ToolPanel {...props} navigationTop={navigationTop}
    panelRef={node => { panel.current = node; if (typeof props.panelRef === 'function') props.panelRef(node); else if (props.panelRef) props.panelRef.current = node; }}
    edgeMargin={0} data-side-docked={Boolean(attached) || undefined} data-dock-side={side || undefined}
    frame={attached || props.frame} onFrameChange={change} onMoveStart={start} onMove={move} onMoveEnd={finish}
    minimumHeight={attached ? 72 : props.minimumHeight}
    zIndex={state?.active === id ? 88 : props.zIndex}
    onActivate={() => { controller?.activate(id); props.onActivate?.(); }}
    resizeEdges={attached ? [inward, ...(last !== id ? ['s', `s${inward}`] : [])] : undefined}
    headerActions={<>{props.headerActions}{dockControl}</>} />;
}
