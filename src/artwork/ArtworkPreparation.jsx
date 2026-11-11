import { createContext, useContext } from 'react';
import { useArtworkVisibility } from './useArtworkVisibility.js';

const ArtworkPreparation = createContext(false);
export const useArtworkPreparation = () => useContext(ArtworkPreparation);

// Display supplies only its existing five rail slots. Preparing their live
// documents before they intersect avoids restarting SVGs in the visible swipe.
// This is temporary readiness, not a source/document cache. Hidden modules
// release it, and removing a rail slot destroys its own isolated documents.
export function ArtworkPreparationProvider({ viewportRef, enabled = true, children }) {
  const visible = useArtworkVisibility(viewportRef, enabled);
  return <ArtworkPreparation.Provider value={enabled && visible}>{children}</ArtworkPreparation.Provider>;
}
