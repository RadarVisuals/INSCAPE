import { useEffect, useRef, useState } from 'react';
import WorkbenchOverviewCard from './WorkbenchOverviewCard.jsx';
import './workbenchOverview.css';
import './workbenchOverviewGrid.css';

// Finite content in the parent's flow. No page navigation, fixed positioning,
// scroll normalization, editor session or duplicated interactive canvases.
export default function CanvasGallerySection({ items, selectedId, onOpen, scrollRoot, cardSize = 2 }) {
  const host = useRef(null);
  const [visible, setVisible] = useState(new Set()), [revealed, setRevealed] = useState(null);
  useEffect(() => {
    const intersecting = new Map();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) intersecting.set(entry.target.dataset.cardId, entry.isIntersecting);
      setVisible(new Set([...intersecting].filter(([, near]) => near).map(([id]) => id)));
    }, { root: scrollRoot?.current || null, rootMargin: '160px' });
    host.current.querySelectorAll('[data-card-id]').forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [items, scrollRoot]);
  return <section ref={host} className="canvas-gallery-section" aria-label="Canvases" data-card-size={cardSize}>
    <div className="workbench-overview-cycle">
      {items.map(item => <WorkbenchOverviewCard key={item.id} item={item} visible={visible.has(item.id)}
        selected={item.id === selectedId} onOpen={onOpen} revealed={revealed === item.id} onReveal={() => setRevealed(item.id)} />)}
    </div>
  </section>;
}
