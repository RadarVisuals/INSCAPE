import { useEffect, useId, useMemo, useRef, useState } from 'react';
import AssetGrid from '../../library/components/AssetGrid.jsx';
import AssetPreview from '../../library/components/AssetPreview.jsx';
import { projectDocumentSpace } from '../domain/documentProjection.js';
import PublishedImage from './PublishedImage.jsx';

const EMPTY_WORKSPACE = Object.freeze({ favorites: [], folders: [] });

function CollapseAllIcon() {
  return <svg className="published-rack-master-control__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10M5 2l3 3 3-3M3 11h10M5 14l3-3 3 3" /></svg>;
}

function ArrangeIcon() {
  return <svg className="published-rack-master-control__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2v12M2 5l3-3 3 3M11 14V2M8 11l3 3 3-3" /></svg>;
}

function InventoryModuleBody({ module }) {
  const [selectedId, setSelectedId] = useState(null);
  const assets = useMemo(() => projectDocumentSpace(module.space), [module.space]);
  const selected = assets.find((asset) => asset.id === selectedId) || null;
  return <div className="published-inventory-rack__space" data-published-document-only>
    <AssetGrid assets={assets} workspace={EMPTY_WORKSPACE} onSelect={setSelectedId} emptyMessage={`${module.label} is empty.`} renderImage={(props) => <PublishedImage {...props} />} />
    <AssetPreview asset={selected} workspace={EMPTY_WORKSPACE} onClose={() => setSelectedId(null)} renderImage={(props) => <PublishedImage {...props} />} />
  </div>;
}

export default function PublishedInventoryRack({ rack }) {
  const [order, setOrder] = useState(() => rack.modules.map(({ id }) => id));
  const [openIds, setOpenIds] = useState(() => new Set(rack.modules.filter((module) => module.startOpen).map(({ id }) => id)));
  const [arranging, setArranging] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const rackId = useId();
  const listRef = useRef(null);

  const toggle = (id) => setOpenIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const move = (id, delta) => setOrder((current) => {
    const from = current.indexOf(id);
    const to = Math.max(0, Math.min(current.length - 1, from + delta));
    if (from === to) return current;
    const next = [...current]; next.splice(from, 1); next.splice(to, 0, id);
    setAnnouncement(`${rack.modules.find((module) => module.id === id)?.label || 'Module'} moved to position ${to + 1}`);
    return next;
  });
  const handleKey = (event, id) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpenIds((current) => { const next = new Set(current); next.delete(id); return next; }); }
    if (!arranging || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); move(id, event.key === 'ArrowUp' ? -1 : 1);
  };
  const beginDrag = (event, id) => {
    if (!arranging || event.button !== 0 || event.target.closest('.published-rack-module__signal-control')) return;
    setDraggingId(id); setDropIndex(order.indexOf(id)); event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault();
  };
  const trackDrag = (event) => {
    if (!draggingId) return;
    const rows = [...listRef.current.querySelectorAll('[data-rack-module]')];
    const nextIndex = rows.findIndex((row) => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
    setDropIndex(nextIndex < 0 ? rows.length - 1 : nextIndex);
  };
  const finishDrag = () => {
    if (draggingId && Number.isInteger(dropIndex)) setOrder((current) => {
      const from = current.indexOf(draggingId); if (from === dropIndex) return current;
      const next = [...current]; next.splice(from, 1); next.splice(dropIndex, 0, draggingId); return next;
    });
    setDraggingId(null); setDropIndex(null);
  };
  useEffect(() => () => setDraggingId(null), []);

  return <aside className="published-inventory-rack" data-arranging={arranging || undefined} aria-label="Public inventory rack" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="published-inventory-rack__master">
      <div className="published-inventory-rack__mark" aria-hidden="true"><img src="/assets/logo/underneath_os.svg" alt="" draggable="false" /></div>
      <div className="published-inventory-rack__brand"><strong>{rack.label}</strong><small>{rack.subtitle}</small></div>
      <button className="published-rack-master-control" type="button" aria-label="Collapse all inventory modules" onClick={() => setOpenIds(new Set())}><CollapseAllIcon /><span>COLLAPSE ALL</span></button>
      <button className="published-rack-master-control" type="button" aria-label={arranging ? 'Finish arranging inventory modules' : 'Arrange inventory modules'} aria-pressed={arranging} onClick={() => setArranging((value) => !value)}><ArrangeIcon /><span>{arranging ? 'DONE' : 'ARRANGE'}</span></button>
    </header>
    <div className="published-inventory-rack__list" ref={listRef}>
      {order.map((id, index) => {
        const module = rack.modules.find((candidate) => candidate.id === id);
        if (!module) return null;
        const open = openIds.has(id);
        const contentId = `${rackId}-${id}`;
        return <section className="published-rack-module" data-rack-module={id} data-open={open || undefined} data-dragging={draggingId === id || undefined} data-drop-before={Boolean(draggingId && dropIndex === index) || undefined} key={id} onKeyDown={(event) => handleKey(event, id)}>
          <div className="published-rack-module__bar" onPointerDown={(event) => beginDrag(event, id)} onPointerMove={trackDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
            <button className="published-rack-module__name" type="button" aria-expanded={open} aria-controls={contentId} aria-keyshortcuts={arranging ? 'Alt+ArrowUp Alt+ArrowDown' : undefined} onClick={() => !arranging && toggle(id)}><strong>{module.label}</strong><small>{module.space.assets.length}</small></button>
            <span className="published-rack-module__control-spacer" aria-hidden="true" />
            <button className="published-rack-module__signal-control" type="button" aria-expanded={open} aria-controls={contentId} aria-label={`${open ? 'Collapse' : 'Expand'} ${module.label}`} onClick={() => toggle(id)}><span className="published-rack-module__signal" aria-hidden="true" /></button>
          </div>
          <div className="published-rack-module__body" id={contentId} hidden={!open}><InventoryModuleBody module={module} /></div>
        </section>;
      })}
    </div>
    <output className="published-inventory-rack__announcement" aria-live="polite">{announcement}</output>
  </aside>;
}
