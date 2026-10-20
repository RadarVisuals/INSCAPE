import { useLayoutEffect, useRef } from 'react';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './workbenchCanvasContent.css';

// One clipping plane for authored content. Its projection follows the camera
// paint clock, without reading module rectangles or re-rendering their media.
// Tools and inspection overlays remain in the existing viewport host.
export default function WorkbenchCanvasContent({ children }) {
  const { area, showOutside, setCanvasHost } = useWorkbenchArea();
  const { getCamera, subscribeCameraPaint } = useWorkbenchCamera();
  const view = useWorkbenchView();
  const node = useRef(null), current = useRef(area); current.current = area;
  const paint = useRef(null);
  useLayoutEffect(() => {
    const element = node.current;
    const update = ({ scale, offset }) => {
      element.style.setProperty('--canvas-left', `${offset.x + current.current.left * scale}px`);
      element.style.setProperty('--canvas-top', `${offset.y + current.current.top * scale}px`);
      element.style.setProperty('--canvas-width', `${current.current.width * scale}px`);
      element.style.setProperty('--canvas-height', `${current.current.height * scale}px`);
    };
    paint.current = update; update(getCamera()); setCanvasHost?.(element);
    const unsubscribe = subscribeCameraPaint(update);
    return () => { unsubscribe(); paint.current = null; setCanvasHost?.(null); };
  }, [getCamera, subscribeCameraPaint, setCanvasHost]);
  useLayoutEffect(() => { paint.current?.(getCamera()); });
  useLayoutEffect(() => {
    const update = () => {
      for (const [id, element] of view.entries) {
        if (!node.current?.contains(element)) continue;
        const transform = view.presentationTransforms?.[id] || view.transforms[id] || { scale: 1, x: 0, y: 0 };
        const frame = transform.frame || view.frames.get(id)?.current;
        if (!frame) continue;
        const left = frame.left * transform.scale + transform.x, top = frame.top * transform.scale + transform.y;
        const outside = left >= area.left + area.width || top >= area.top + area.height
          || left + frame.width * transform.scale <= area.left || top + frame.height * transform.scale <= area.top;
        element.toggleAttribute('data-workbench-canvas-hidden', !showOutside && !view.presentationTransforms?.[id] && outside);
      }
    };
    update();
    const unsubscribe = view.subscribe(update);
    return () => {
      unsubscribe();
      for (const element of view.entries.values()) if (node.current?.contains(element)) element.removeAttribute('data-workbench-canvas-hidden');
    };
  }, [view.entries, view.frames, view.transforms, view.presentationTransforms, view.subscribe, area.left, area.top, area.width, area.height, showOutside]);
  return <div ref={node} className="workbench-canvas-content" data-show-outside={showOutside || undefined}>{children}</div>;
}
