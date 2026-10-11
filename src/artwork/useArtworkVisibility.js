import { useEffect, useState } from 'react';
import { useArtworkGeometry } from './ArtworkGeometry.jsx';

// A temporary camera projection may cross the viewport while preparing its
// native endpoint. Retain the current document until that projection retires,
// then ask the observer for a fresh result using the settled clipping geometry.
// Genuinely offscreen artwork still releases its executable document.
export function useArtworkVisibility(viewportRef, enabled = true) {
  const [visible, setVisible] = useState(false);
  const geometry = useArtworkGeometry();
  useEffect(() => {
    const node = viewportRef.current;
    setVisible(false);
    if (!enabled || !node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!geometry.isProjected()) setVisible(entry.isIntersecting);
    });
    observer.observe(node);
    const unsubscribe = geometry.subscribe(() => {
      if (geometry.isProjected()) return;
      observer.disconnect(); observer.observe(node);
    });
    return () => { unsubscribe(); observer.disconnect(); };
  }, [viewportRef, enabled, geometry]);
  return enabled && visible;
}
