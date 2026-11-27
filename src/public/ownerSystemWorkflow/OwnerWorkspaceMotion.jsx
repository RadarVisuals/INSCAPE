import { observeInitialArtwork } from '../../navigation/initialArtworkPaint.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GalleryStudioMotion, useGalleryStudioDestination } from '../../navigation/galleryStudioMotion.js';
import { fitCanvasRegion } from '../workbenchOverview/fitCanvasRegion.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import CanvasJourney from '../workbenchOverview/CanvasJourney.jsx';
import { captureOverviewCanvas, overviewCanvasNode } from '../workbenchOverview/overviewCanvasFrame.js';
import '../workbenchOverview/workbenchOverview.css';

// The camera and the lazy artwork modules have separate lifecycles. Release the
// outgoing screen once the fitted plane can paint its visible content or recovery.
function useStudioEntryPaint(hostRef, fitted) {
  const [painted, setPainted] = useState(false);
  useLayoutEffect(() => {
    if (!fitted) { setPainted(false); return; }
    const plane = hostRef.current?.querySelector('.workbench-canvas-content:not([data-suspended])');
    if (!plane) return;
    return observeInitialArtwork(plane, () => setPainted(true));
  }, [hostRef, fitted]);
  return fitted && painted;
}

// A temporary read-only paint surface joins the two existing views. It never
// changes the editor camera, authored geometry, or the overview's crop.
export default function OwnerWorkspaceMotion({ editing, hostRef, motionRef, journey, onComplete }) {
  const { getCamera, entryFramed } = useWorkbenchCamera();
  const entryPainted = useStudioEntryPaint(hostRef, editing && entryFramed);
  useStartupDestinationReady(entryPainted);
  const surface = useRef(null);
  const routeMotion = useContext(GalleryStudioMotion);
  const publicSurface = routeMotion?.surface;
  useEffect(() => {
    const host = hostRef.current;
    if (journey?.direction !== 'overview' || !host) return;
    // The parent attaches its host ref after child layout effects on a remount.
    // Retain the actual outgoing windows for their fade, but remove their input
    // authority immediately. The editor's navigation hooks are disabled too.
    const tools = [...host.querySelectorAll('[data-workbench-toolbar], .workbench-tool-panel, .workbench-tool-window, .workbench-side-dock, .workbench-view-controls')]
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
  useGalleryStudioDestination(routeTrip, entryPainted ? routeTrip : null, hostRef, source => {
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
    targetReady={journey?.direction !== 'editor' || entryPainted}
    resolveTarget={source => journey.direction === 'overview'
      ? captureOverviewCanvas(overviewCanvasNode(hostRef.current, source.id), source.model, source.name, source.id)
      : motionRef.current?.captureEditor(source.model, source.name, source.id)} />;
}
