import { createContext, useContext, useEffect, useState } from 'react';

const ArtworkPreparation = createContext(false);
export const useArtworkPreparation = () => useContext(ArtworkPreparation);

// Display supplies only its existing five rail slots. Preparing their live
// documents before they intersect avoids restarting SVGs in the visible swipe.
// This is temporary readiness, not a source/document cache. Hidden modules
// release it, and removing a rail slot destroys its own isolated documents.
export function ArtworkPreparationProvider({ viewportRef, enabled = true, children }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (!enabled || !viewportRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [enabled, viewportRef]);
  return <ArtworkPreparation.Provider value={enabled && visible}>{children}</ArtworkPreparation.Provider>;
}
