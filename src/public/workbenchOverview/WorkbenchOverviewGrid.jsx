import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { PRESENTATION_EASING } from './useCanvasPresentationMotion.js';
import GridCard from './WorkbenchOverviewCard.jsx';
import './workbenchOverviewGrid.css';

// Bounded visual cycles, one accessible collection. Nearby compositions warm
// every visual copy so a wrap never swaps a painted preview for an empty card.
export default function WorkbenchOverviewGrid({ items, wrap, onOpen, onEdit, onManage, selectedId, hostRef: root, cardSize, arranging, onFinishArrange, onReorder }) {
  const cycle = useRef(null), height = useRef(0), keyboard = useRef(false);
  const [revealed, setRevealed] = useState(null);
  const [repeatRadius, setRepeatRadius] = useState(1);
  const [visibleIds, setVisibleIds] = useState(() => new Set());
  const [drag, setDrag] = useState(null), [announcement, setAnnouncement] = useState('');
  const dragging = useRef(null), previous = useRef(new Map()), motions = useRef([]), dropFrame = useRef(0);
  const looping = wrap && items.length > 1 && !arranging;
  useEffect(() => {
    const intersecting = new Map();
    const observer = new IntersectionObserver(entries => {
      // A scroll normalization can queue several entries for one card. Keep
      // its latest position, then derive visibility across all equivalent copies.
      for (const entry of entries) intersecting.set(entry.target, entry.isIntersecting);
      const next = new Set([...intersecting].filter(([, near]) => near).map(([card]) => card.dataset.cardId));
      setVisibleIds(current => current.size === next.size && [...next].every(id => current.has(id)) ? current : next);
    }, { root: root.current, rootMargin: '160px' });
    root.current.querySelectorAll('.workbench-overview-card').forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [items, looping, repeatRadius, root]);
  const reorder = (id, targetId) => {
    const ids = items.map(item => item.id), from = ids.indexOf(id), to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ...ids.splice(from, 1)); onReorder(ids);
  };
  const move = (id, amount) => {
    const index = items.findIndex(item => item.id === id), next = items[index + amount];
    if (next) reorder(id, next.id);
  };
  const endDrag = (commit, event) => {
    if (event && dragging.current && event.pointerId !== dragging.current.pointer) return;
    const current = dragging.current; dragging.current = null; setDrag(null);
    if (current && event?.target.hasPointerCapture?.(event.pointerId)) event.target.releasePointerCapture(event.pointerId);
    // Finish pointer capture before moving the dragged DOM node.
    if (commit && current) dropFrame.current = requestAnimationFrame(() => reorder(current.id, current.target));
  };
  useLayoutEffect(() => {
    const cards = [...cycle.current.querySelectorAll('.workbench-overview-card')];
    const current = new Map(cards.map(card => [card.dataset.cardId, card.getBoundingClientRect()]));
    motions.current.forEach(animation => animation.cancel()); motions.current = [];
    if (arranging && !matchMedia('(prefers-reduced-motion: reduce)').matches) for (const card of cards) {
      const before = previous.current.get(card.dataset.cardId), after = current.get(card.dataset.cardId);
      if (before && (before.left !== after.left || before.top !== after.top)) motions.current.push(card.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` }, { transform: 'none' },
      ], { duration: 600, easing: PRESENTATION_EASING }));
    }
    previous.current = current;
    if (arranging) setAnnouncement(items.map((item, index) => `${index + 1}. ${item.name}`).join(', '));
  }, [items, arranging, cardSize]);
  useEffect(() => () => { motions.current.forEach(animation => animation.cancel()); cancelAnimationFrame(dropFrame.current); }, []);
  useEffect(() => {
    const node = root.current;
    const claimDrag = event => { if (event.target.closest('.workbench-overview-drag')) event.preventDefault(); };
    node.addEventListener('touchstart', claimDrag, { passive: false });
    return () => node.removeEventListener('touchstart', claimDrag);
  }, [root]);

  useLayoutEffect(() => {
    const measure = () => {
      height.current = cycle.current.getBoundingClientRect().height;
      const radius = Math.min(8, Math.max(1, Math.ceil(root.current.clientHeight / height.current)));
      setRepeatRadius(radius);
      root.current.scrollTop = looping ? height.current * radius : 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cycle.current);
    return () => observer.disconnect();
  }, [looping, items.length, root, repeatRadius]);
  const normalize = () => {
    const host = root.current, size = height.current;
    if (!looping || !size || keyboard.current) return;
    // Keep the viewport centre in the middle cycle. Browser focus scrolling can
    // then centre its first or last card without moving the target to a copy.
    const start = size * repeatRadius - host.clientHeight / 2;
    if (host.scrollTop < start || host.scrollTop >= start + size) {
      host.scrollTop = start + ((host.scrollTop - start) % size + size) % size;
    }
  };
  return <section className="workbench-overview-gallery" aria-label="Workbench gallery" ref={root}
    style={{ '--gallery-count': items.length }} data-card-size={cardSize} data-arranging={arranging || undefined} onScroll={normalize}
    onKeyDown={event => { keyboard.current = true; if (event.key === 'Escape' && arranging) { event.preventDefault(); if (dragging.current) endDrag(false); else onFinishArrange(); } }}
    onPointerMove={event => {
      if (!dragging.current || dragging.current.pointer !== event.pointerId) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-card-id]');
      if (hit && root.current.contains(hit)) dragging.current.target = hit.dataset.cardId;
      const bounds = root.current.getBoundingClientRect();
      if (event.clientY < bounds.top + 60) root.current.scrollTop -= 24;
      if (event.clientY > bounds.bottom - 60) root.current.scrollTop += 24;
      setDrag({ ...dragging.current, x: event.clientX, y: event.clientY });
    }}
    onPointerUp={event => endDrag(true, event)} onPointerCancel={event => endDrag(false, event)} onLostPointerCapture={event => endDrag(false, event)}
    onWheel={() => { keyboard.current = false; setRevealed(null); }} onTouchStart={() => { keyboard.current = false; }} onTouchMove={() => setRevealed(null)}>
    {(looping ? Array.from({ length: repeatRadius * 2 + 1 }, (_, index) => index - repeatRadius) : [0]).map(copy => <div key={copy} ref={copy === 0 ? cycle : undefined}
      className="workbench-overview-cycle" data-gallery-cycle={copy} aria-hidden={copy !== 0 || undefined}>
      {items.map((item, index) => <GridCard key={item.id} item={item} visible={visibleIds.has(item.id)} duplicate={copy !== 0} selected={selectedId === item.id}
        arranging={arranging} index={index} count={items.length} onMove={move} dropTarget={drag?.target === item.id && drag.id !== item.id}
        onDrag={(event, id) => {
          if (event.button !== 0 || !event.isPrimary || dragging.current) return;
          if (event.pointerType === 'mouse') event.preventDefault();
          event.currentTarget.focus(); root.current.setPointerCapture(event.pointerId);
          dragging.current = { id, target: id, pointer: event.pointerId, name: item.name, x: event.clientX, y: event.clientY };
          setDrag(dragging.current);
        }}
        onOpen={onOpen} onEdit={onEdit} onManage={onManage} revealed={revealed === `${copy}:${item.id}`} onReveal={() => setRevealed(`${copy}:${item.id}`)} />)}
    </div>)}
    {arranging && <div className="workbench-overview-arrange-help"><span>Drag to arrange</span><button type="button" onClick={onFinishArrange}><Check size={16} />Done</button></div>}
    {drag && <div className="workbench-overview-drag-label" style={{ left: drag.x + 16, top: drag.y + 12 }}>{drag.name}</div>}
    <p className="workbench-overview-announcement" role="status">{announcement}</p>
  </section>;
}
