import { useLayoutEffect, useRef, useState } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import WorkbenchOverviewPreview from '../workbenchOverview/WorkbenchOverviewPreview.jsx';
import { captureOverviewCanvas, overviewCanvasNode } from '../workbenchOverview/overviewCanvasFrame.js';
import '../workbenchOverview/workbenchOverview.css';

// A temporary read-only paint surface joins the two existing views. It never
// changes the editor camera, authored geometry, or the overview's crop.
export default function OwnerWorkspaceMotion({ hostRef, motionRef, journey, onComplete }) {
  const { getCamera } = useWorkbenchCamera();
  const surface = useRef(null), [plan, setPlan] = useState(null);
  const latest = useRef(null); latest.current = { onComplete };
  useLayoutEffect(() => {
    if (journey?.direction !== 'overview') return;
    // Retain the actual outgoing windows for their fade, but remove their input
    // authority immediately. The editor's navigation hooks are disabled too.
    const tools = [...hostRef.current.querySelectorAll('[data-workbench-toolbar], .workbench-tool-panel, .workbench-tool-window, .workbench-side-dock, .workbench-view-controls')]
      .map(node => ({ node, inert: node.inert }));
    tools.forEach(({ node }) => { node.inert = true; });
    return () => tools.forEach(({ node, inert }) => { node.inert = inert; });
  }, [journey, hostRef]);
  useLayoutEffect(() => {
    const captureActive = (model, name, id) => surface.current?.dataset.canvasId === id
      ? captureOverviewCanvas(surface.current, model, name, id) : null;
    const capture = (model, name, id) => {
      const host = hostRef.current.getBoundingClientRect(), camera = getCamera();
      // Close the preview's empty margins around the actual canvas. A full-screen
      // destination would stretch those margins over the prepared editor tools.
      const frame = { left: host.left + camera.offset.x + model.area.left * camera.scale,
        top: host.top + camera.offset.y + model.area.top * camera.scale,
        width: model.area.width * camera.scale, height: model.area.height * camera.scale };
      return { model, name, id, frame, radius: 0, background: 'var(--interface-environment)',
        paint: { scale: camera.scale, left: 0, top: 0 } };
    };
    motionRef.current = { capture: (...args) => captureActive(...args) || capture(...args), captureEditor: capture, captureActive };
    return () => { motionRef.current = null; };
  }, [getCamera, hostRef, motionRef]);
  useLayoutEffect(() => {
    setPlan(null);
    if (!journey) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { latest.current.onComplete(); return; }
    let frame = 0, attempts = 0;
    const prepare = () => {
      const source = journey.source;
      const node = overviewCanvasNode(hostRef.current, source.id);
      const target = journey.direction === 'editor' ? motionRef.current?.captureEditor(source.model, source.name, source.id)
        : captureOverviewCanvas(node, source.model, source.name, source.id);
      if (!target && attempts++ < 120) { frame = requestAnimationFrame(prepare); return; }
      if (!target) { latest.current.onComplete(); return; }
      setPlan({ from: source, to: target, scale: Math.max(source.paint.scale, target.paint.scale) });
    };
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(prepare); });
    return () => cancelAnimationFrame(frame);
  }, [journey, hostRef, motionRef]);
  useLayoutEffect(() => {
    if (!plan) return;
    const node = surface.current, canvas = node.querySelector('.workbench-overview-canvas');
    const density = devicePixelRatio || 1;
    const frame = value => ({ left: `${value.frame.left}px`, top: `${value.frame.top}px`, width: `${value.frame.width}px`,
      height: `${value.frame.height}px`, borderRadius: `${value.radius}px`, backgroundColor: value.background });
    const paint = value => ({ transform: `translate(${value.paint.left}px, ${value.paint.top}px) scale(${value.paint.scale / (plan.scale * density)})` });
    const options = { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' };
    const animations = [node.animate([frame(plan.from), frame(plan.to)], options), canvas.animate([paint(plan.from), paint(plan.to)], options)];
    let current = true;
    const finish = () => { if (current) { setPlan(null); latest.current.onComplete();
      if (document.activeElement === document.body) hostRef.current?.focus({ preventScroll: true });
    } };
    Promise.all(animations.map(animation => animation.finished)).then(finish, () => {});
    addEventListener('resize', finish);
    return () => { current = false; animations.forEach(animation => animation.cancel()); removeEventListener('resize', finish); };
  }, [plan, hostRef]);
  if (!journey) return null;
  const source = journey.source, { model, name } = source;
  const scale = plan?.scale || source.paint.scale;
  return <div className="owner-canvas-journey" ref={surface} aria-hidden="true" inert="" data-direction={journey.direction} data-canvas-id={source.id}
    style={{ left: source.frame.left, top: source.frame.top, width: source.frame.width, height: source.frame.height, borderRadius: source.radius, background: source.background }}>
    <WorkbenchOverviewPreview model={model} name={name} viewport={plan?.to.frame || source.frame}
      camera={{ scale, offset: { x: source.paint.left - model.area.left * scale, y: source.paint.top - model.area.top * scale } }} presenting />
  </div>;
}
