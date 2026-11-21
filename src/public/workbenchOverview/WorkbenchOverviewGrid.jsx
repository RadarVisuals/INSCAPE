import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { PRESENTATION_EASING } from './useCanvasPresentationMotion.js';
import GridCard from './WorkbenchOverviewCard.jsx';
import './workbenchOverviewGrid.css';

// Bounded visual cycles, one accessible collection. Nearby compositions warm
// every visual copy so a wrap never swaps a painted preview for an empty card.
export default function WorkbenchOverviewGrid({ horizontalWrap, items, wrap, onOpen, onEdit, selection, onManage, selectedId, hostRef: root, cardSize, arranging, onFinishArrange, onReorder, memory, movingCanvasId }) {
  const cycle = useRef(null), cycleSize = useRef(0), keyboard = useRef(false);
  const [revealed, setRevealed] = useState(null);
  const [repeatRadius, setRepeatRadius] = useState(1);
  const [visibleIds, setVisibleIds] = useState(() => new Set());
  const [drag, setDrag] = useState(null), [announcement, setAnnouncement] = useState('');
  const dragging = useRef(null), previous = useRef(new Map()), motions = useRef([]), dropFrame = useRef(0);
  const looping = wrap && items.length > 1 && !arranging && !selection;
  const horizontal = horizontalWrap && looping;
  const offset = horizontal ? 'scrollLeft' : 'scrollTop';
  const scrollKey = horizontal ? 'gridHorizontal' : 'grid';
  const dimension = horizontal ? 'width' : 'height';
  const viewport = horizontal ? 'clientWidth' : 'clientHeight';
  const initialSelection = useRef(selectedId);
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

  useEffect(() => {
    if (!horizontal) return;
    const host = root.current;
    const wheel = event => {
      if (event.ctrlKey || event.shiftKey || event.deltaX || !event.deltaY) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientWidth : 1;
      host.scrollLeft += event.deltaY * unit;
    };
    host.addEventListener('wheel', wheel, { passive: false });
    return () => host.removeEventListener('wheel', wheel);
  }, [horizontal, root]);

  useLayoutEffect(() => {
    const measure = () => {
      const host = root.current;
      const size = cycle.current.getBoundingClientRect()[dimension];
      if (!size) return;
      cycleSize.current = size;
      const radius = Math.min(16, Math.max(1, Math.ceil(host[viewport] / size)));
      if (looping && repeatRadius !== radius) {
        setRepeatRadius(radius);
        return;
      }
      host[offset] = (looping ? size * radius : 0) + (memory?.scroll?.[scrollKey] || 0);
      if (initialSelection.current && horizontalWrap) {
        const id = CSS.escape(initialSelection.current);
        const bounds = host.getBoundingClientRect();
        const visible = [...host.querySelectorAll(`[data-card-id="${id}"]`)].some(card => {
          const box = card.getBoundingClientRect();
          return box.left >= bounds.left - 1 && box.right <= bounds.right + 1 && box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1;
        });
        if (!visible) cycle.current.querySelector(`[data-card-id="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (memory) memory.scroll = { ...memory.scroll, [scrollKey]: host[offset] - (looping ? size * radius : 0) };
        initialSelection.current = null;
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cycle.current);
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [looping, items.length, root, repeatRadius, memory, offset, dimension, viewport, horizontalWrap, scrollKey]);
  useLayoutEffect(() => {
    const intersecting = new Map();
    const updateVisible = () => {
      const next = new Set([...intersecting].filter(([, near]) => near).map(([card]) => card.dataset.cardId));
      setVisibleIds(current => current.size === next.size && [...next].every(id => current.has(id)) ? current : next);
    };
    const observer = new IntersectionObserver(entries => {
      // A scroll normalization can queue several entries for one card. Keep
      // its latest position, then derive visibility across all equivalent copies.
      for (const entry of entries) intersecting.set(entry.target, entry.isIntersecting);
      updateVisible();
    }, { root: root.current, rootMargin: '160px' });
    // The first observer delivery can follow a paint. Seed only the cards in
    // the restored viewport so switching layouts never exposes empty tiles.
    const bounds = root.current.getBoundingClientRect();
    for (const card of root.current.querySelectorAll('.workbench-overview-card')) {
      const box = card.getBoundingClientRect();
      intersecting.set(card, box.right > bounds.left && box.left < bounds.right && box.bottom > bounds.top && box.top < bounds.bottom);
      observer.observe(card);
    }
    updateVisible();
    return () => observer.disconnect();
  }, [items, looping, repeatRadius, root]);
  const normalize = () => {
    const host = root.current, size = cycleSize.current;
    if (memory) memory.scroll = { ...memory.scroll, [scrollKey]: host[offset] - (looping ? size * repeatRadius : 0) };
    if (!looping || !size || keyboard.current) return;
    // Keep the viewport centre in the middle cycle. Browser focus scrolling can
    // then centre its first or last card without moving the target to a copy.
    const start = size * repeatRadius - host[viewport] / 2;
    if (host[offset] < start || host[offset] >= start + size) {
      host[offset] = start + ((host[offset] - start) % size + size) % size;
      if (memory) memory.scroll[scrollKey] = host[offset] - size * repeatRadius;
    }
  };
  return <section className="workbench-overview-gallery" aria-label="Workbench gallery" ref={root} data-horizontal={horizontal || undefined}
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
      {items.map((item, index) => <GridCard key={item.id} item={item} visible={visibleIds.has(item.id)} duplicate={copy !== 0} selected={selectedId === item.id} moving={movingCanvasId === item.id}
        arranging={arranging} index={index} count={items.length} onMove={move} dropTarget={drag?.target === item.id && drag.id !== item.id}
        onDrag={(event, id) => {
          if (event.button !== 0 || !event.isPrimary || dragging.current) return;
          if (event.pointerType === 'mouse') event.preventDefault();
          event.currentTarget.focus(); root.current.setPointerCapture(event.pointerId);
          dragging.current = { id, target: id, pointer: event.pointerId, name: item.name, x: event.clientX, y: event.clientY };
          setDrag(dragging.current);
        }}
        onOpen={onOpen} onEdit={onEdit} selection={selection} onManage={onManage} revealed={revealed === `${copy}:${item.id}`} onReveal={() => setRevealed(`${copy}:${item.id}`)} />)}
    </div>)}
    {arranging && <div className="workbench-overview-arrange-help"><span>Drag to arrange</span><button type="button" onClick={onFinishArrange}><Check size={16} />Done</button></div>}
    {drag && <div className="workbench-overview-drag-label" style={{ left: drag.x + 16, top: drag.y + 12 }}>{drag.name}</div>}
    <p className="workbench-overview-announcement" role="status">{announcement}</p>
  </section>;
}
