import { useLayoutEffect, useRef } from 'react';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './workbenchCanvasContent.css';
import { artworkModuleId, layerIds } from '../../systemWorkflow/domain/artworkLayers.js';
import { useEditorCells } from '../../reception/EditorCellsContext.jsx';
import { editorCellClip, transformedCellWindow } from '../../reception/editorCellGeometry.js';

// One clipping plane for authored content. Its projection follows the camera
// paint clock, without reading module rectangles or re-rendering their media.
// Tools and inspection overlays remain in the existing viewport host.
export default function WorkbenchCanvasContent({ children, suspended = false }) {
  const { area, showOutside, setCanvasHost } = useWorkbenchArea();
  const { getCamera, subscribeCameraPaint, registerCameraPlane } = useWorkbenchCamera();
  const { layers, content, entries, editorHiddenIds, subscribe, frames, transforms, presentationTransforms, scale } = useWorkbenchView();
  const cellContext = useEditorCells();
  const node = useRef(null), current = useRef(area); current.current = area;
  const plane = useRef(null);
  useLayoutEffect(() => registerCameraPlane?.(plane.current), [registerCameraPlane]);
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
    const order = layerIds(layers || []);
    const update = () => {
      for (const [id, element] of entries) {
        const moduleId = artworkModuleId(content, id), index = order.indexOf(moduleId);
        if (index < 0 || !node.current?.contains(element)) continue;
        element.setAttribute('data-workbench-artwork', '');
        // At most 64 artwork modules; host controls begin above this band.
        element.style.setProperty('--artwork-order', String(index + 1));
        element.toggleAttribute('data-editor-hidden', editorHiddenIds?.includes(moduleId));
      }
    };
    update(); return subscribe(update);
  }, [layers, content, entries, subscribe, editorHiddenIds]);
  useLayoutEffect(() => {
    const host = node.current;
    const update = () => {
      for (const [id, element] of entries) {
        if (!host?.contains(element)) continue;
        const transform = presentationTransforms?.[id] || transforms[id] || { scale: 1, x: 0, y: 0 };
        const frame = transform.frame || frames.get(id)?.current;
        if (!frame) continue;
        const left = frame.left * transform.scale + transform.x, top = frame.top * transform.scale + transform.y;
        const outside = left >= area.left + area.width || top >= area.top + area.height
          || left + frame.width * transform.scale <= area.left || top + frame.height * transform.scale <= area.top;
        element.toggleAttribute('data-workbench-canvas-hidden', !showOutside && !presentationTransforms?.[id] && outside);
      }
    };
    update();
    const unsubscribe = subscribe(update);
    return () => {
      unsubscribe();
      for (const element of entries.values()) if (host?.contains(element)) element.removeAttribute('data-workbench-canvas-hidden');
    };
  }, [entries, frames, transforms, presentationTransforms, subscribe, area.left, area.top, area.width, area.height, showOutside]);
  useLayoutEffect(() => {
    const cells = cellContext?.cells || [];
    const update = () => {
      const frame = id => transformedCellWindow(frames.get(id)?.current, transforms[id]);
      for (const [id, element] of entries) {
        if (!node.current?.contains(element)) continue;
        const moduleId = artworkModuleId(content, id);
        const cell = cells.find(value => value.members.includes(moduleId));
        // Inspection stays viewport-owned; ordinary cell paint is clipped by
        // its owner's native window, regardless of temporary editor focus.
        const clip = cell && cell.clipContent !== false && !presentationTransforms?.[id] && !element.hasAttribute('data-svg-inspection')
          ? editorCellClip(frame(cell.id), frame(id), cell.radius || 0, scale * (globalThis.devicePixelRatio || 1)) : null;
        if (clip) { element.style.clipPath = clip; element.dataset.editorCell = cell.id; }
        else if (element.hasAttribute('data-editor-cell')) { element.style.removeProperty('clip-path'); element.removeAttribute('data-editor-cell'); }
      }
    };
    update(); const unsubscribe = subscribe(update);
    return () => {
      unsubscribe();
      for (const element of entries.values()) if (element.hasAttribute('data-editor-cell')) {
        element.style.removeProperty('clip-path'); element.removeAttribute('data-editor-cell');
      }
    };
  }, [cellContext?.cells, entries, frames, transforms, presentationTransforms, content, subscribe, scale]);
  return <div ref={node} className="workbench-canvas-content" data-show-outside={showOutside || undefined} data-suspended={suspended || undefined} inert={suspended ? '' : undefined} aria-hidden={suspended || undefined}>
    <div ref={plane} className="workbench-camera-plane">{children}</div>
  </div>;
}
