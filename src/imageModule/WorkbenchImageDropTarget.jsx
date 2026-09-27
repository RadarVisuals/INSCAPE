import { useLayoutEffect, useRef } from 'react';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { isWorkbenchBackground } from '../public/ownerSystemWorkflow/useWorkbenchPan.js';
import { imageDropGeometry } from './imageDropGeometry.js';
import { resolveImageLibrarySide } from './imageLibrarySide.js';
import { addImageModule } from './imageModuleSession.js';

// A scoped fallback destination. Existing module targets keep priority; the
// Workbench supplies camera/layout inputs while Image owns creation and media.
export default function WorkbenchImageDropTarget({ targetRef, hostRef, suspended, onCreated, onError }) {
  const view = useWorkbenchView(), camera = useWorkbenchCamera();
  const latest = useRef(null);
  latest.current = { view, camera, suspended, onCreated, onError };
  useLayoutEffect(() => {
    let live = true, request = 0;
    const target = {
      previewAt(point, dimensions) {
        const { view, camera, suspended } = latest.current;
        const host = hostRef.current;
        if (!live || suspended || camera.locked || !host || !isWorkbenchBackground(document.elementFromPoint(point.x, point.y), host)) return null;
        const preview = imageDropGeometry(dimensions, point, host.getBoundingClientRect(), view.scale, camera.offset, devicePixelRatio || 1);
        return preview && { ...preview, kind: 'workbench-image', target };
      },
      async placeAsset(input, dimensions, destination, isCurrent) {
        const { view } = latest.current, generation = view.store.getGeneration(), token = ++request;
        const current = () => live && request === token && !latest.current.suspended && !latest.current.camera.locked
          && isCurrent() && view.store.getGeneration() === generation;
        if (!destination || !current()) return false;
        try {
          const side = await resolveImageLibrarySide(input, dimensions);
          if (!current()) return false;
          const id = addImageModule(view.store, view.profileAddress, { ...destination, side, workbench: view.getPresentation() });
          latest.current.onCreated(id);
          return true;
        } catch (error) { if (current()) latest.current.onError(error.message); return false; }
      },
    };
    targetRef.current = target;
    return () => { live = false; request++; if (targetRef.current === target) targetRef.current = null; };
  }, [targetRef, hostRef, view.store, view.profileAddress]);
  return null;
}
