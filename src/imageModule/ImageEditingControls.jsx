import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { paintWorkbenchResizeControls } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
import { avoidWorkbenchControl } from '../public/ownerSystemWorkflow/avoidWorkbenchControl.js';
import '../public/ownerSystemWorkflow/workbenchWindowChrome.css';

// Editing chrome belongs to the viewport, not the clipped artwork. Keep the
// native Image resize handlers; only project their controls outside the crop.
export default function ImageEditingControls({ host, source, id, frame, viewport, navigationTop = 0, editable, tools, moveHandle, handles }) {
  const root = useRef(null), toolbar = useRef(null), focused = useRef(null);
  const { getCamera, subscribeCameraPaint } = useWorkbenchCamera();
  useLayoutEffect(() => {
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body)
      toolbar.current?.querySelector('button:not(:disabled), input:not(:disabled)')?.focus({ preventScroll: true });
  });
  useLayoutEffect(() => {
    const element = root.current, bar = toolbar.current;
    if (!element) return;
    let barHeight = bar?.offsetHeight || 0;
    const paint = ({ scale, offset }) => {
      const screen = { left: frame.left * scale + offset.x, top: frame.top * scale + offset.y,
        width: frame.width * scale, height: frame.height * scale };
      for (const [key, value] of Object.entries(screen)) element.style[key] = `${value}px`;
      paintWorkbenchResizeControls(element, screen, viewport);
      if (!bar) return;
      const above = screen.top - barHeight - 20;
      bar.style.setProperty('--toolbar-screen-x', `${screen.left}px`);
      bar.style.top = `${Math.max(navigationTop + 8, Math.min(above >= navigationTop + 8 ? above
        : screen.top + screen.height + 20, viewport.height - barHeight - 8)) - screen.top}px`;
      const controls = [...(source?.current?.querySelectorAll('[data-workbench-recovery-control]') || [])]
        .map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
      if (controls.length) {
        const rect = bar.getBoundingClientRect();
        const avoided = avoidWorkbenchControl({ left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          { left: Math.min(...controls.map(rect => rect.left)), right: Math.max(...controls.map(rect => rect.right)),
            top: Math.min(...controls.map(rect => rect.top)), bottom: Math.max(...controls.map(rect => rect.bottom)) },
          { left: rect.left, right: rect.right, top: navigationTop + 8, bottom: viewport.height - 8 }, 8, rect.height);
        bar.style.top = `${avoided.top - screen.top}px`;
      }
    };
    const measure = () => { barHeight = bar?.offsetHeight || 0; paint(getCamera()); };
    const observer = new ResizeObserver(measure);
    if (bar) observer.observe(bar);
    const recoveryObserver = new MutationObserver(measure);
    if (source?.current) recoveryObserver.observe(source.current, { childList: true, subtree: true });
    measure(); const unsubscribe = subscribeCameraPaint(paint);
    return () => { observer.disconnect(); recoveryObserver.disconnect(); unsubscribe(); };
  }, [host, source, frame.left, frame.top, frame.width, frame.height, viewport, navigationTop, editable, tools, handles, getCamera, subscribeCameraPaint]);
  return createPortal(<div ref={root} className="image-module__editing-controls" data-workbench-view-id={id} data-workbench-selection-tools
    onFocusCapture={event => { focused.current = event.target; }}
    onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    {editable && <div className="image-module__bounds" aria-hidden="true" />}
    {handles}
    {tools && <div ref={toolbar} className="image-module__quick-tools editor-object-toolbar workbench-tool-controls" data-window-chrome="flat"
      data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" role="toolbar" aria-label="Selected image actions">{moveHandle}{tools}</div>}
  </div>, host);
}
