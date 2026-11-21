import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Minimize2, Pencil } from 'lucide-react';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import WallPerspective from './WallPerspective.jsx';
import { canvasDestinations } from './canvasPresentationModel.js';
import './galleryWall.css';

export default function GalleryWall({ items, selected, onSelect, onEdit, memory, selection }) {
  const scroll = useRef(null), room = useRef(null), gesture = useRef(null), dragged = useRef(false);
  const [inspectId, setInspectId] = useState(null), [point, setPoint] = useState(null);
  const [visible, setVisible] = useState(() => new Set([selected.id]));
  const inspected = !selection.active && items.find(item => item.id === inspectId);
  const destinations = inspected ? canvasDestinations(inspected.draft).filter(entry => entry.view) : [];
  const find = id => scroll.current?.querySelector(`[data-card-id="${CSS.escape(id)}"]`);
  const close = () => {
    find(inspectId)?.querySelector('.wall-open')?.focus({ preventScroll: true });
    setInspectId(null); setPoint(null);
  };
  const inspect = id => {
    if (selection.active) { selection.toggle(id); return; }
    onSelect(id); setInspectId(id); setPoint(null);
  };
  useEffect(() => { if (selection.active) { setInspectId(null); setPoint(null); } }, [selection.active]);
  useLayoutEffect(() => {
    const host = scroll.current;
    host.scrollLeft = memory?.wallOffset || 0;
    if (document.activeElement === document.body) host.focus({ preventScroll: true });
    return () => { if (memory) memory.wallOffset = host.scrollLeft; };
  }, [memory]);
  useLayoutEffect(() => {
    const host = scroll.current;
    const observer = new IntersectionObserver(entries => setVisible(previous => {
      const next = new Set(previous);
      for (const entry of entries) {
        const id = entry.target.dataset.cardId;
        if (entry.isIntersecting) next.add(id); else next.delete(id);
      }
      return next;
    }), { root: host, rootMargin: '0px 75%' });
    host.querySelectorAll('[data-card-id]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);
  useLayoutEffect(() => {
    if (!inspected) return;
    const node = find(inspected.id), host = scroll.current;
    function fit() {
      const w = host.clientWidth, h = host.clientHeight;
      const scale = Math.min(w * .89 / node.offsetWidth, h * .81 / node.offsetHeight);
      const x = w/2 - scale*(node.offsetLeft - host.scrollLeft + node.offsetWidth/2);
      const y = h*.46 - scale*(node.offsetTop + node.offsetHeight/2);
      room.current.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    }
    fit();
    const observer = new ResizeObserver(fit); observer.observe(host); observer.observe(node);
    return () => { observer.disconnect(); room.current.style.removeProperty('transform'); };
  }, [inspected?.id]);
  useEffect(() => {
    const host = scroll.current;
    function wheel(e) {
      if (e.ctrlKey || e.metaKey || inspected || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      host.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.clientWidth : 1);
    }
    host.addEventListener('wheel', wheel, { passive: false });
    return () => host.removeEventListener('wheel', wheel);
  }, [inspected]);
  const move = direction => scroll.current.scrollBy({ left: direction * scroll.current.clientWidth * .52,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  function keyDown(e) {
    if (e.altKey || e.metaKey || e.ctrlKey || e.target.matches('input, select, textarea')) return;
    if (inspected && (e.key === 'Escape' || e.key.toLowerCase() === 'f')) { e.preventDefault(); close(); }
    else if (!inspected && e.key.toLowerCase() === 'f' && !selection.active) {
      const host = scroll.current, centre = host.scrollLeft + host.clientWidth/2;
      const nearest = [...host.querySelectorAll('[data-card-id]')].sort((a,b) =>
        Math.abs(a.offsetLeft+a.offsetWidth/2-centre) - Math.abs(b.offsetLeft+b.offsetWidth/2-centre))[0];
      e.preventDefault(); inspect(e.target.closest('[data-card-id]')?.dataset.cardId || nearest.dataset.cardId);
    } else if (!inspected && ['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); move(e.key === 'ArrowLeft' ? -1 : 1); }
  }
  return <section className="gallery-wall" aria-label="Gallery wall" onKeyDown={keyDown} data-inspecting={inspected ? '' : undefined}>
    <div className="wall-camera" ref={room}>
      <WallPerspective scroll={scroll}/>
      <div className="wall-scroll" ref={scroll} tabIndex={0} aria-label="Browse the gallery wall"
        onDragStart={e => e.preventDefault()}
        onPointerDown={e => {
          dragged.current = false;
          if (inspected || e.button !== 0 || e.pointerType === 'touch') return;
          gesture.current = { x:e.clientX, left:e.currentTarget.scrollLeft, id:e.pointerId };
        }}
        onPointerMove={e => {
          const start = gesture.current;
          if (!start || e.pointerId !== start.id || !e.buttons) return;
          const dx = e.clientX-start.x;
          if (!dragged.current && Math.abs(dx) < 5) return;
          dragged.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.scrollLeft = start.left-dx;
        }}
        onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }}
        onClickCapture={e => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false; } }}>
        <div className="wall-hang">
          {items.map(item => {
            const active = inspected?.id === item.id, ratio = item.model.area.width/item.model.area.height;
            return <article key={item.id} data-card-id={item.id} className="wall-piece" style={{ '--ratio':ratio }}
              inert={inspected && !active ? '' : undefined}>
              {(visible.has(item.id) || active) && <WorkbenchOverviewPreview model={item.model} name={item.name}
                region={active ? point?.view : undefined} sidePreview={!active} presenting measureLayout />}
              <button type="button" className="wall-open" aria-label={`${selection.active ? 'Select' : 'Inspect'} ${item.name}`}
                aria-pressed={selection.active ? selection.checked.has(item.id) : undefined}
                tabIndex={active ? -1 : 0} onClick={() => !active && inspect(item.id)}/>
              <span className="wall-caption">{item.name}</span>
            </article>;
          })}
        </div>
      </div>
    </div>
    <div className="wall-controls">
      {inspected ? <><button type="button" autoFocus aria-label="Return to wall" title="Return to wall (F or Escape)" onClick={close}><Minimize2 size={16}/> {inspected.name}</button>
        {destinations.length > 0 && <select aria-label="Camera point" value={point?.id || ''} onChange={e => setPoint(destinations.find(entry => entry.id === e.target.value) || null)}>
          <option value="">Whole composition</option>{destinations.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>}
        {onEdit && <button type="button" aria-label={`Edit ${inspected.name} in Studio`} title="Edit in Studio" onClick={() => onEdit(inspected.id, find(inspected.id))}><Pencil size={15}/></button>}</> :
        <><button type="button" aria-label="Browse left" onClick={() => move(-1)}><ArrowLeft size={16}/></button>
        <span>Drag to explore · F to inspect</span>
        <button type="button" aria-label="Browse right" onClick={() => move(1)}><ArrowRight size={16}/></button></>}
    </div>
  </section>;
}
