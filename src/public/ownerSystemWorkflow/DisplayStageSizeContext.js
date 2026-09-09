import { createContext } from 'react';

// The Display owns the rendered Stage dimensions. Renderers consume them in
// the same commit as the frame resize, avoiding a delayed DOM measurement.
export const DisplayStageSizeContext = createContext(null);
