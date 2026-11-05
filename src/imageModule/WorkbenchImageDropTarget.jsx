import { useWorkbenchArea } from '../public/ownerSystemWorkflow/WorkbenchAreaContext.jsx';
import { useLayoutEffect, useRef } from 'react';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { isWorkbenchBackground } from '../public/ownerSystemWorkflow/useWorkbenchPan.js';
import { imageDropGeometry } from './imageDropGeometry.js';
import { resolveImageLibrarySide } from './imageLibrarySide.js';
import { addImageModule } from './imageModuleSession.js';
import { useEditorCells } from '../reception/EditorCellsContext.jsx';

function cellAt(hit, context) {
  const surface = hit?.closest?.('[data-editor-cell-surface], [data-editor-cell], [data-cell-owner], [data-workbench-view-id]');
  const id = surface?.dataset.editorCellSurface || surface?.dataset.editorCell || surface?.dataset.cellOwner || surface?.dataset.workbenchViewId;
  return context?.cells.find(cell => cell.id === id || cell.members.includes(id))?.id || null;
}

// A scoped fallback destination. Existing module targets keep priority; the
// Workbench supplies camera/layout inputs while Image owns creation and media.
export default function WorkbenchImageDropTarget({ targetRef, hostRef, suspended, onCreated, onError }) {
  const { bounds: areaBounds } = useWorkbenchArea();
  const view = useWorkbenchView(), camera = useWorkbenchCamera();
  const cells = useEditorCells();
  const latest = useRef(null);
  latest.current = { view, camera, suspended, onCreated, onError, areaBounds, cells };
  useLayoutEffect(() => {
    let live = true, request = 0;
    const target = {
      targetAt(point) {
        const { camera, suspended, cells, view } = latest.current;
        const host = hostRef.current;
        const hit = document.elementFromPoint(point.x, point.y);
        const cellId = cellAt(hit, cells), editingCell = cells?.editingCellId;
        if (!live || suspended || camera.locked || !host || (editingCell ? cellId !== editingCell : !cellId && !isWorkbenchBackground(hit, host))) return null;
        const generation = view.store.getGeneration();
        const current = () => live && !latest.current.suspended && !latest.current.camera.locked
          && view.store.getGeneration() === generation && editingCell === latest.current.cells?.editingCellId
          && (!cellId || latest.current.cells?.cells.some(cell => cell.id === cellId));
        const destinationTarget = {
          // At cell level an artwork-covered cell still receives a new layer.
          // Inside a cell, registered Image/Text targets keep their own actions.
          acceptsModuleSurface: Boolean(cellId && !editingCell),
          isCurrent: current,
          previewAt(point, dimensions) {
            if (!current()) return null;
            const { view, camera } = latest.current;
            const frame = cellId && !editingCell ? view.getPresentation().shapes.find(item => item.id === cellId)?.window : null;
            const preview = imageDropGeometry(dimensions, point, host.getBoundingClientRect(), view.scale, camera.offset,
              devicePixelRatio || 1, latest.current.areaBounds, frame);
            return preview && { ...preview, kind: 'workbench-image', target: destinationTarget };
          },
          async placeAsset(input, dimensions, destination, isCurrent) {
            const token = ++request;
            const active = () => request === token && current() && isCurrent();
            if (!destination || !active()) return false;
            try {
              const side = await resolveImageLibrarySide(input, dimensions, Boolean(cellId));
              if (!active()) return false;
              const store = cellId ? { ...view.store, commitCompletedOperation: (candidate, opts) => view.store.commitInCell(cellId, candidate, opts) } : view.store;
              const id = addImageModule(store, view.profileAddress, { ...destination, side, workbench: view.getPresentation() });
              latest.current.onCreated(id);
              return true;
            } catch (error) { if (active()) latest.current.onError(error.message); return false; }
          },
        };
        return destinationTarget;
      },
    };
    targetRef.current = target;
    return () => { live = false; request++; if (targetRef.current === target) targetRef.current = null; };
  }, [targetRef, hostRef, view.store, view.profileAddress]);
  return null;
}
