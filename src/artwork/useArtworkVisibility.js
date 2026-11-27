import { intersectsViewport } from '../navigation/initialArtworkPaint.js';
import { useEffect, useState } from 'react';
import { useArtworkGeometry } from './ArtworkGeometry.jsx';

// A temporary camera projection may cross the viewport while preparing its
// native endpoint. Retain the current document until that projection retires,
// then ask the observer for a fresh result using the settled clipping geometry.
// This reports visibility only; the placement owns retention and disposal.
export function useArtworkVisibility(viewportRef, enabled = true) {
  const [visible, setVisible] = useState(false);
  const geometry = useArtworkGeometry();
  useEffect(() => {
    const node = viewportRef.current;
    setVisible(false);
    if (!enabled || !node) return;
    // Native snapshots suspend intersection notifications while Studio is mounting.
    // Seed just its intersecting artwork so the isolated document can report ready.
    const entry = document.activeViewTransition && node.closest('.workbench-canvas-content:not([data-suspended]), .owner-canvas-journey');
    if (entry && !geometry.isProjected() && !node.closest('[data-editor-hidden], [data-workbench-canvas-hidden]'))
      setVisible(intersectsViewport(node, entry.getBoundingClientRect()));
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
