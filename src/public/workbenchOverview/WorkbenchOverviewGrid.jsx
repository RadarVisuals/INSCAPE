import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, GripVertical, Check } from 'lucide-react';
import { PRESENTATION_EASING } from './useCanvasPresentationMotion.js';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import './workbenchOverviewGrid.css';

function GridCard({ item, duplicate, selected, root, onOpen, onEdit, onManage, revealed, onReveal, arranging, index, count, onMove, onDrag, dropTarget }) {
  const host = useRef(null), [visible, setVisible] = useState(false);
  const [information, setInformation] = useState(false);
  useEffect(() => {
    // A resize plus wrap normalization can queue several entries for this card.
    // Use the newest one; the first may describe its position before the jump.
    const observer = new IntersectionObserver(entries => setVisible(entries.at(-1).isIntersecting), { root: root.current, rootMargin: '160px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [root]);
  return <article className="workbench-overview-card" ref={host} data-revealed={revealed || undefined} data-card-id={item.id} data-drop-target={dropTarget || undefined}
    onPointerLeave={event => { if (event.pointerType === 'mouse' && !host.current.matches(':has(:focus-visible)')) setInformation(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInformation(false); }}>
    {visible && <WorkbenchOverviewPreview model={item.model} name={item.name} surfaceId={item.draft.appearance.surfaceId} thumbnail crop={item.thumbnailCrop} />}
    <button type="button" className="workbench-overview-card-open" disabled={arranging} tabIndex={duplicate ? -1 : 0}
      data-workbench-id={item.id} data-previewed={!duplicate && selected} onClick={event => {
        if (event.nativeEvent.pointerType === 'touch' && !revealed) { onReveal(); return; }
        onOpen(item.id, event.currentTarget);
      }} aria-label={`Open ${item.name}`} />
    <div className="workbench-overview-card-reveal" inert={arranging ? '' : undefined}>
      <span className="workbench-overview-card-title">{item.name}</span>
      <div className="workbench-overview-card-actions">
        <button type="button" className="workbench-overview-card-view" tabIndex={duplicate ? -1 : 0}
          onClick={event => onOpen(item.id, event.currentTarget)}>View</button>
        <button type="button" tabIndex={duplicate ? -1 : 0} onClick={() => onEdit(item.id)} aria-label={`Edit ${item.name}`}>Edit</button>
        <button type="button" tabIndex={duplicate ? -1 : 0} onClick={event => onManage(item.id, 'crop', event.currentTarget)} aria-label={`Crop ${item.name}`}>Crop</button>
        <button type="button" tabIndex={duplicate ? -1 : 0} aria-expanded={information} onClick={() => setInformation(!information)}
          aria-label={`Information for ${item.name}`}>Information</button>
      </div>
      {information && <div className="workbench-overview-card-information">
        {item.introduction && <p>{item.introduction}</p>}
        <button type="button" tabIndex={duplicate ? -1 : 0} onClick={event => onManage(item.id, 'details', event.currentTarget)}>Edit details</button>
      </div>}
    </div>
    {arranging && <div className="workbench-overview-card-arrange">
      <span>{item.name}</span>
      <div><button type="button" aria-label={`Move ${item.name} earlier`} disabled={index === 0} onClick={() => onMove(item.id, -1)}><ArrowLeft size={16} /></button>
        <button type="button" className="workbench-overview-drag" aria-label={`Drag ${item.name} to reorder`} onPointerDown={event => onDrag(event, item.id)}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onMove(item.id, event.key === 'ArrowLeft' ? -1 : 1); } }}><GripVertical size={18} /></button>
        <button type="button" aria-label={`Move ${item.name} later`} disabled={index === count - 1} onClick={() => onMove(item.id, 1)}><ArrowRight size={16} /></button></div>
    </div>}
  </article>;
}

// Bounded visual cycles, one accessible collection. Only cards near the
// viewport mount preview content; repeated tiles never create new saved records.
export default function WorkbenchOverviewGrid({ items, wrap, onOpen, onEdit, onManage, selectedId, hostRef: root, cardSize, arranging, onFinishArrange, onReorder }) {
  const cycle = useRef(null), height = useRef(0), keyboard = useRef(false);
  const [revealed, setRevealed] = useState(null);
  const [repeatRadius, setRepeatRadius] = useState(1);
  const [drag, setDrag] = useState(null), [announcement, setAnnouncement] = useState('');
  const dragging = useRef(null), previous = useRef(new Map()), motions = useRef([]), dropFrame = useRef(0);
  const looping = wrap && items.length > 1 && !arranging;
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
    setRevealed(null);
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
    onWheel={() => { keyboard.current = false; }} onTouchStart={() => { keyboard.current = false; }}>
    {(looping ? Array.from({ length: repeatRadius * 2 + 1 }, (_, index) => index - repeatRadius) : [0]).map(copy => <div key={copy} ref={copy === 0 ? cycle : undefined}
      className="workbench-overview-cycle" data-gallery-cycle={copy} aria-hidden={copy !== 0 || undefined}>
      {items.map((item, index) => <GridCard key={item.id} item={item} root={root} duplicate={copy !== 0} selected={selectedId === item.id}
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
