import { createContext, useCallback, useContext, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ArtworkGeometry } from '../../artwork/ArtworkGeometry.jsx';

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
  const projection = useRef(null), painters = useRef(new Set());
  const geometryListeners = useRef(new Set());
  const artworkGeometry = useMemo(() => ({
    subscribe(listener) { geometryListeners.current.add(listener); return () => geometryListeners.current.delete(listener); },
    isProjected: () => Boolean(projection.current),
  }), []);
  const getCamera = useCallback(() => current.current, []);
  const subscribeCameraPaint = useCallback(listener => { painters.current.add(listener); return () => painters.current.delete(listener); }, []);
  const prepareCamera = useCallback(rasterCamera => setCamera(rasterCamera), []);
  const projectCamera = useCallback(surface => { projection.current = surface; }, []);
  const previewCamera = useCallback((next, progress) => {
    current.current = next;
    painters.current.forEach(paint => paint(next));
    projection.current?.paint(next, progress);
  }, []);
  const updateCamera = useCallback(update => {
    const previous = current.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (!projection.current && next.scale === previous.scale && next.offset.x === previous.offset.x && next.offset.y === previous.offset.y) return;
    current.current = next;
    setCamera({ ...next });
  }, []);
  // Temporary style overrides retire before layout effects read the settled
  // DOM. The camera reference remains authoritative throughout the projection.
  useInsertionEffect(() => { projection.current?.dispose(); projection.current = null; }, [camera]);
  // Runs after module layout and retiring temporary transforms, both when
  // preparing the largest surface and when finishing/cancelling a journey.
  useLayoutEffect(() => { geometryListeners.current.forEach(update => update()); }, [camera]);
  useLayoutEffect(() => () => { projection.current?.dispose(); projection.current = null; }, []);
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
  return <Camera.Provider value={{ ...camera, getCamera, updateCamera, prepareCamera, projectCamera, previewCamera, subscribeCameraPaint, setOffset, locked: locks.size > 0, lock }}>
    <CameraScale.Provider value={scale}><ArtworkGeometry.Provider value={artworkGeometry}>{children}</ArtworkGeometry.Provider></CameraScale.Provider>
  </Camera.Provider>;
}
