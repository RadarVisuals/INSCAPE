import { createContext, useContext, useState } from 'react';

const Camera = createContext({ offset: { x: 0, y: 0 } });
export const useWorkbenchCamera = () => useContext(Camera);
// Kept separate from module view context: panning does not render editors.
export function WorkbenchCameraProvider({ children }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  return <Camera.Provider value={{ offset, setOffset }}>{children}</Camera.Provider>;
}
