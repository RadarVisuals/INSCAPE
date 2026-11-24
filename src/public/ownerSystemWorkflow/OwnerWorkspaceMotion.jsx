import { useContext, useLayoutEffect, useRef } from 'react';
import { GalleryStudioMotion, useGalleryStudioDestination } from '../../navigation/galleryStudioMotion.js';
import { fitCanvasRegion } from '../workbenchOverview/fitCanvasRegion.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import CanvasJourney from '../workbenchOverview/CanvasJourney.jsx';
import { captureOverviewCanvas, overviewCanvasNode } from '../workbenchOverview/overviewCanvasFrame.js';
import '../workbenchOverview/workbenchOverview.css';

// A temporary read-only paint surface joins the two existing views. It never
// changes the editor camera, authored geometry, or the overview's crop.
export default function OwnerWorkspaceMotion({ hostRef, motionRef, journey, onComplete }) {
  const { getCamera, entryFramed } = useWorkbenchCamera();
  const surface = useRef(null);
  const routeMotion = useContext(GalleryStudioMotion);
  const publicSurface = routeMotion?.surface;
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
    const captureActive = (model, name, id) => {
      const active = publicSurface?.current || surface.current;
      return active?.dataset.canvasId === id ? captureOverviewCanvas(active, model, name, id) : null;
    };
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
  }, [getCamera, hostRef, motionRef, publicSurface]);
  const routeTrip = journey?.address ? journey : null;
  const layers = () => hostRef.current.querySelectorAll('.workbench-canvas-content:not([data-suspended])');
  useGalleryStudioDestination(routeTrip, entryFramed ? routeTrip : null, hostRef, source => {
    const plane = hostRef.current.querySelector('.workbench-canvas-content:not([data-suspended])');
    if (!plane) return null;
    const style = plane.style, host = hostRef.current.getBoundingClientRect();
    const size = key => parseFloat(style.getPropertyValue('--canvas-' + key));
    const frame = { left: host.left + size('left'), top: host.top + size('top'), width: size('width'), height: size('height') };
    if (!(frame.width > 0 && frame.height > 0)) return null;
    return { frame, paint: fitCanvasRegion(source.model.area, source.model.area, frame, 0), radius: 0,
      background: getComputedStyle(hostRef.current).backgroundColor };
  }, layers);
  if (routeTrip) return null;
  return <CanvasJourney journey={journey} hostRef={hostRef} surface={surface} onComplete={onComplete}
    targetReady={journey?.direction !== 'editor' || entryFramed}
    resolveTarget={source => journey.direction === 'overview'
      ? captureOverviewCanvas(overviewCanvasNode(hostRef.current, source.id), source.model, source.name, source.id)
      : motionRef.current?.captureEditor(source.model, source.name, source.id)} />;
}
