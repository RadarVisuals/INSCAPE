import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';

const Camera = createContext({ offset: { x: 0, y: 0 } });
export const useWorkbenchCamera = () => useContext(Camera);
// An inspector retains its source coordinates until its return has finished.
// Tokens keep simultaneous module lifetimes independent; nothing is persisted.
export function useWorkbenchInspectionLock() {
  const { lock } = useWorkbenchCamera();
  useLayoutEffect(() => lock?.(), [lock]);
}
// Kept separate from module view context: panning does not render editors.
export function WorkbenchCameraProvider({ children }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [locks, setLocks] = useState(() => new Set());
  const lock = useCallback(() => {
    const token = Symbol();
    setLocks(current => new Set(current).add(token));
    return () => setLocks(current => { const next = new Set(current); next.delete(token); return next; });
  }, []);
  return <Camera.Provider value={{ offset, setOffset, locked: locks.size > 0, lock }}>{children}</Camera.Provider>;
}
