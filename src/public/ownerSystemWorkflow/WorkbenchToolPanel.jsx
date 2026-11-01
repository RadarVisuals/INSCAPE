import ToolPanel from '../../ui/ToolPanel.jsx';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useSideDock } from './WorkbenchSideDock.jsx';
import { sideDockFrames } from './workbenchSideDockState.js';

const noSubscription = () => () => {};
const emptySnapshot = () => null;
// One screen shell for tools and utilities. Docking changes geometry only.
export default function WorkbenchToolPanel({ dockId, ...props }) {
  const { navigationInset = 0, navigationTop = 0 } = useWorkbenchView();
  const controller = useSideDock();
  const state = useSyncExternalStore(controller?.subscribe || noSubscription, controller?.getSnapshot || emptySnapshot);
  const id = dockId || props.title;
  const gesture = useRef(null), panel = useRef(null);
  useLayoutEffect(() => {
    if (controller && !props.hidden) return controller.register(id, props.minimumWidth ?? 280, panel.current.closest('main') || panel.current.parentElement);
  }, [controller, id, props.hidden, props.minimumWidth]);
  const frames = state ? sideDockFrames(state.layout, state.windows, state.viewport) : {};
  const attached = frames[id];
  const nearEdge = event => event && event.clientX >= innerWidth - 32 && event.clientY >= navigationTop;
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
      controller?.preview(nearEdge(event) ? { x: event.clientX, y: event.clientY } : null);
    }
    props.onMove?.(event);
  };
  const finish = (cancelled, event) => {
    const drag = gesture.current; gesture.current = null;
    controller?.preview(null);
    if (cancelled && drag) { if (drag.layout) controller.restore(drag.layout); props.onFrameChange(drag.frame); }
    else if (drag?.moved && nearEdge(event)) controller?.attach(id, props.frame, event.clientY);
    props.onMoveEnd?.(cancelled, event);
  };
  const toggle = () => {
    if (attached) {
      props.onFrameChange({ ...props.frame, left: Math.max(navigationInset, attached.left - 32), top: attached.top + 24 });
      controller.detach(id);
    } else controller.attach(id, props.frame);
  };
  const dockControl = controller && <button type="button" className="workbench-tool-panel-close" onClick={toggle}
    aria-label={`${attached ? 'Undock' : 'Dock'} ${props.title}${attached ? '' : ' on right'}`}
    title={attached ? 'Undock window' : 'Dock on right; drag the title to the right edge'}>
    {attached ? <PanelRightOpen /> : <PanelRightClose />}
  </button>;
  return <ToolPanel {...props} navigationInset={navigationInset} navigationTop={navigationTop}
    panelRef={node => { panel.current = node; if (typeof props.panelRef === 'function') props.panelRef(node); else if (props.panelRef) props.panelRef.current = node; }}
    edgeMargin={0} data-side-docked={Boolean(attached) || undefined}
    frame={attached || props.frame} onFrameChange={change} onMoveStart={start} onMove={move} onMoveEnd={finish}
    minimumHeight={attached ? 72 : props.minimumHeight}
    zIndex={state?.active === id ? 88 : props.zIndex}
    onActivate={() => { controller?.activate(id); props.onActivate?.(); }}
    resizeEdges={attached ? ['w', ...(Object.keys(frames).at(-1) !== id ? ['s', 'sw'] : [])] : undefined}
    headerActions={<>{props.headerActions}{dockControl}</>} />;
}
