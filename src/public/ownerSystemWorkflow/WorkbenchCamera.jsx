import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

const Camera = createContext({ offset: { x: 0, y: 0 } });
const CameraScale = createContext({ scale: 1 });
export const useWorkbenchCamera = () => useContext(Camera);
export const useWorkbenchCameraScale = () => useContext(CameraScale);
// An inspector retains its source coordinates until its return has finished.
// Tokens keep simultaneous module lifetimes independent; nothing is persisted.
export function useWorkbenchInspectionLock() {
  const { lock } = useWorkbenchCamera();
  useLayoutEffect(() => lock?.(), [lock]);
}
// One owner for the session camera. Scale-only readers do not subscribe to pan,
// so translating the viewport cannot render every module's editor.
export function WorkbenchCameraProvider({ children }) {
  const [camera, setCamera] = useState({ scale: 1, offset: { x: 0, y: 0 } });
  const current = useRef(camera);
  const getCamera = useCallback(() => current.current, []);
  const updateCamera = useCallback(update => {
    const previous = current.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (next.scale === previous.scale && next.offset.x === previous.offset.x && next.offset.y === previous.offset.y) return;
    current.current = next;
    setCamera(next);
  }, []);
  const setScale = useCallback(update => updateCamera(previous => ({ ...previous,
    scale: typeof update === 'function' ? update(previous.scale) : update,
  })), [updateCamera]);
  const setOffset = useCallback(update => updateCamera(previous => ({ ...previous,
    offset: typeof update === 'function' ? update(previous.offset) : update,
  })), [updateCamera]);
  const scale = useMemo(() => ({ scale: camera.scale, setScale }), [camera.scale, setScale]);
  const [locks, setLocks] = useState(() => new Set());
  const lock = useCallback(() => {
    const token = Symbol();
    setLocks(current => new Set(current).add(token));
    return () => setLocks(current => { const next = new Set(current); next.delete(token); return next; });
  }, []);
  return <Camera.Provider value={{ ...camera, getCamera, updateCamera, setOffset, locked: locks.size > 0, lock }}>
    <CameraScale.Provider value={scale}>{children}</CameraScale.Provider>
  </Camera.Provider>;
}
