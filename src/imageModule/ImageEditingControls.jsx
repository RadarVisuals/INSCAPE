import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { workbenchResizeControl } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';

// Editing chrome belongs to the viewport, not the clipped artwork. Keep the
// native Image resize handlers; only project their controls outside the crop.
export default function ImageEditingControls({ host, id, frame, viewport, navigationTop = 0, editable, tools, handles }) {
  const root = useRef(null), toolbar = useRef(null), focused = useRef(null);
  const { getCamera, subscribeCameraPaint } = useWorkbenchCamera();
  useLayoutEffect(() => {
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body)
      toolbar.current?.querySelector('button:not(:disabled), input:not(:disabled)')?.focus({ preventScroll: true });
  });
  useLayoutEffect(() => {
    const element = root.current, bar = toolbar.current;
    if (!element) return;
    let barWidth = bar?.offsetWidth || 0, barHeight = bar?.offsetHeight || 0;
    const paint = ({ scale, offset }) => {
      const screen = { left: frame.left * scale + offset.x, top: frame.top * scale + offset.y,
        width: frame.width * scale, height: frame.height * scale };
      for (const [key, value] of Object.entries(screen)) element.style[key] = `${value}px`;
      for (const handle of element.querySelectorAll('[data-image-resize]')) {
        const style = workbenchResizeControl(handle.dataset.imageResize, screen, viewport, devicePixelRatio || 1);
        handle.style.left = `${style.left}px`; handle.style.top = `${style.top}px`;
        handle.style.setProperty('--resize-mark-x', style['--resize-mark-x']);
        handle.style.setProperty('--resize-mark-y', style['--resize-mark-y']);
      }
      if (!bar) return;
      const above = screen.top - barHeight - 20;
      bar.style.left = `${Math.max(8, Math.min(screen.left, viewport.width - barWidth - 8)) - screen.left}px`;
      bar.style.top = `${Math.max(navigationTop + 8, Math.min(above >= navigationTop + 8 ? above
        : screen.top + screen.height + 20, viewport.height - barHeight - 8)) - screen.top}px`;
    };
    const measure = () => { barWidth = bar?.offsetWidth || 0; barHeight = bar?.offsetHeight || 0; paint(getCamera()); };
    const observer = new ResizeObserver(measure);
    if (bar) observer.observe(bar);
    measure(); const unsubscribe = subscribeCameraPaint(paint);
    return () => { observer.disconnect(); unsubscribe(); };
  }, [host, frame.left, frame.top, frame.width, frame.height, viewport.width, viewport.height, navigationTop, editable, tools, handles, getCamera, subscribeCameraPaint]);
  return createPortal(<div ref={root} className="image-module__editing-controls" data-workbench-view-id={id} data-workbench-selection-tools
    onFocusCapture={event => { focused.current = event.target; }}
    onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    {editable && <div className="image-module__bounds" aria-hidden="true" />}
    {handles}
    {tools && <div ref={toolbar} className="image-module__quick-tools workbench-tool-controls" data-window-chrome="flat"
      data-workflow-material="tactile" data-workflow-finish="flat" role="toolbar" aria-label="Selected image actions">{tools}</div>}
  </div>, host);
}
