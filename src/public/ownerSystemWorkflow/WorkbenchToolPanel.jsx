import ToolPanel from '../../ui/ToolPanel.jsx';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useSideDock } from './WorkbenchSideDock.jsx';
import { dockSide, sideDockEdge, sideDockFrames } from './workbenchSideDockState.js';

const noSubscription = () => () => {};
const emptySnapshot = () => null;
// One screen shell for tools and utilities. Docking changes geometry only.
export default function WorkbenchToolPanel({ dockId, fitWhenDocked = false, commitFloatingFrameOnRelease = false, ...props }) {
  const { navigationTop = 0 } = useWorkbenchView();
  const controller = useSideDock();
  const state = useSyncExternalStore(controller?.subscribe || noSubscription, controller?.getSnapshot || emptySnapshot);
  const id = dockId || props.title;
  const gesture = useRef(null), panel = useRef(null);
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
  const column = state?.layout.items.filter(item => dockSide(item) === side && frames[item.id]);
  const compact = Boolean(attached && fitWhenDocked && column.length === 1);
  const nearEdge = event => state && sideDockEdge(event, state.viewport);
  const change = frame => {
    const next = typeof frame === 'function' ? frame(attached || props.frame) : frame;
    if (attached && !gesture.current) controller.resize(id, compact ? { ...next, height: attached.height } : next);
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
    if (attached) {
      if (!commitFloatingFrameOnRelease) props.onFrameChange({ ...props.frame, left: Math.max(0, attached.left + (side === 'left' ? 32 : -32)), top: attached.top + 24 });
      controller.detach(id);
    } else controller.attach(id, props.frame, Infinity, target);
  };
  const dockControl = controller && (attached ? [side] : ['left', 'right']).map(target => {
    const Icon = target === 'left' ? attached ? PanelLeftOpen : PanelLeftClose : attached ? PanelRightOpen : PanelRightClose;
    return <button key={target} type="button" className="workbench-tool-panel-close workbench-tool-panel-dock" onClick={() => toggle(target)}
    aria-label={`${attached ? 'Undock' : 'Dock'} ${props.title}${attached ? '' : ` on ${target}`}`}
    title={attached ? 'Undock window' : `Dock on ${target}; drag the title to the ${target} edge`}><Icon /></button>;
  });
  const inward = side === 'left' ? 'e' : 'w';
  const last = column?.at(-1)?.id;
  return <ToolPanel {...props} navigationTop={navigationTop}
    panelRef={node => { panel.current = node; if (typeof props.panelRef === 'function') props.panelRef(node); else if (props.panelRef) props.panelRef.current = node; }}
    edgeMargin={0} data-side-docked={Boolean(attached) || undefined} data-dock-side={side || undefined}
    frame={attached || props.frame} onFrameChange={change} onMoveStart={start} onMove={move} onMoveEnd={finish}
    deferFrameChange={commitFloatingFrameOnRelease ? edge => !edge || !attached : undefined}
    floatingFrame={commitFloatingFrameOnRelease && attached ? props.frame : undefined}
    minimumHeight={attached ? 72 : props.minimumHeight}
    preservePreferredFrame={Boolean(attached) || !props.fitContentHeight} data-content-height={compact || undefined}
    fitContentHeight={attached ? compact : props.fitContentHeight}
    zIndex={state?.active === id ? 88 : props.zIndex}
    onActivate={() => { controller?.activate(id); props.onActivate?.(); }}
    resizeEdges={attached ? [inward, ...(last !== id ? ['s', `s${inward}`] : [])] : undefined}
    headerActions={<>{props.headerActions}{dockControl}</>} />;
}
