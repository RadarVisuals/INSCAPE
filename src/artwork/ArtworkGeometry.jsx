import { createContext, useContext } from 'react';

// The containing view announces committed geometry, including transform-only
// changes that ResizeObserver cannot see. Projected motion retains the pixels
// prepared at its start; subscribers measure again when that motion settles.
export const ArtworkGeometry = createContext({ subscribe: () => () => {}, isProjected: () => false });
export const useArtworkGeometry = () => useContext(ArtworkGeometry);
