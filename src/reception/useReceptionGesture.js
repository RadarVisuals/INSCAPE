import { useEffect, useRef, useState } from 'react';
import { createWorkbenchGestures } from '../public/ownerSystemWorkflow/workbenchGestures.js';

// Reception supplies cell/crop geometry; Workbench's controller owns capture,
// Escape, blur, visibility, lost capture and exactly one completed operation.
export default function useReceptionGesture(version) {
  const host = useRef(null), active = useRef(null), currentVersion = useRef(version);
  currentVersion.current = version;
  const [gestures] = useState(() => createWorkbenchGestures({
    getHost: () => host.current, restoreTransforms: () => active.current?.cancel(),
    finishSnap: () => { active.current = null; }, cancelDrop: () => {}, previewMarquee: () => {},
  }));
  useEffect(() => { gestures.cancel(); }, [version, gestures]);
  useEffect(() => () => gestures.cancel(), [gestures]);
  return { cancel: gestures.cancel, begin(event, operation) {
    if (event.button !== 0) return;
    gestures.cancel(); event.preventDefault(); event.stopPropagation();
    host.current = operation.captureHost || event.currentTarget; active.current = operation;
    const origin = { x: event.clientX, y: event.clientY }, source = host.current;
    gestures.beginResize(event, { beforeTransforms: {},
      valid: () => currentVersion.current === version && source.isConnected,
      preview: delta => operation.update({ clientX: origin.x + delta.x, clientY: origin.y + delta.y }),
      commit: pointer => { operation.update(pointer); operation.commit(); },
    });
  } };
}
