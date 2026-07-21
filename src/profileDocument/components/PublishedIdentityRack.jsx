import { useEffect, useId, useMemo, useRef, useState } from 'react';
import PublishedImage from './PublishedImage.jsx';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import { PUBLISHED_IDENTITY_RACK_MODULES as MODULES } from '../domain/publishedIdentityRack.js';
import './publishedIdentityRack.css';

const SCRAMBLE_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#:/.-';

function ScrambledLabel({ value }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const update = (next) => { displayRef.current = next; setDisplay(next); };
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || displayRef.current === value) { update(value); return undefined; }
    const from = displayRef.current;
    const startedAt = performance.now();
    let frame = 0;
    let animationFrame = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / 320);
      const length = Math.max(1, Math.round(from.length + ((value.length - from.length) * progress)));
      const settled = Math.floor(value.length * Math.max(0, (progress - .22) / .78));
      const next = Array.from({ length }, (_, index) => {
        if (index < settled && index < value.length) return value[index];
        return SCRAMBLE_GLYPHS[(frame * 7 + index * 11) % SCRAMBLE_GLYPHS.length];
      }).join('');
      update(progress === 1 ? value : next);
      frame += 1;
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return <span aria-hidden="true">{display}</span>;
}

function CopyIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="3" width="8" height="8" /><path d="M3 5v8h8" /></svg>;
}

function ExternalIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4h6v6M12 4 4 12" /></svg>;
}

function CollapseAllIcon() {
  return <svg className="published-rack-master-control__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10M5 2l3 3 3-3M3 11h10M5 14l3-3 3 3" /></svg>;
}

function ArrangeIcon() {
  return <svg className="published-rack-master-control__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2v12M2 5l3-3 3 3M11 14V2M8 11l3 3 3-3" /></svg>;
}

function BioBody({ rack }) {
  return <div className="published-identity-rack__bio">
    <span aria-hidden="true">“</span>
    {rack.identity.description ? <p>{rack.identity.description}</p> : <p className="published-identity-rack__empty">No public statement.</p>}
  </div>;
}

function LinksTagsBody({ rack }) {
  const links = rack.identity.links || [];
  const tags = rack.identity.tags || [];
  return <div className="published-identity-rack__links-tags">
    {links.length > 0 && <nav aria-label="Public profile links">{links.map((link) => <a href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" key={link.url}><span aria-hidden="true">↗</span>{link.label}</a>)}</nav>}
    {tags.length > 0 && <ul aria-label="Public profile tags">{tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
    {!links.length && !tags.length && <p className="published-identity-rack__empty">No public links or tags.</p>}
  </div>;
}

function ModuleBody({ id, rack }) {
  if (id === 'bio') return <BioBody rack={rack} />;
  return <LinksTagsBody rack={rack} />;
}

export default function PublishedIdentityRack({ rack, onOrderChange }) {
  const avatarUrl = resolvePublishedAssetUrl(rack.identity.avatarUrl);
  const initialOrder = useMemo(() => rack.modules.map(({ id }) => id), [rack]);
  const [order, setOrder] = useState(initialOrder);
  const [openIds, setOpenIds] = useState(() => new Set(rack.modules.filter((module) => module.id !== 'profile' && module.startOpen).map(({ id }) => id)));
  const [arranging, setArranging] = useState(false);
  const [profileShowsAddress, setProfileShowsAddress] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const listRef = useRef(null);
  const rackId = useId();

  useEffect(() => {
    if (!arranging) setOrder(initialOrder);
  }, [arranging, initialOrder]);

  const copyProfileAddress = async () => {
    try {
      await navigator.clipboard.writeText(rack.address);
      setAnnouncement('Profile address copied');
    } catch {
      setAnnouncement('Profile address could not be copied');
    }
  };

  const toggle = (id) => setOpenIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const collapse = (id) => setOpenIds((current) => {
    if (!current.has(id)) return current;
    const next = new Set(current); next.delete(id); return next;
  });
  const move = (id, delta) => setOrder((current) => {
    const from = current.indexOf(id);
    const to = Math.max(0, Math.min(current.length - 1, from + delta));
    if (from === to) return current;
    const next = [...current]; next.splice(from, 1); next.splice(to, 0, id);
    setAnnouncement(`${MODULES[id].label} moved to position ${to + 1}`);
    return next;
  });
  const beginDrag = (event, id) => {
    if (!arranging || event.button !== 0 || event.target.closest('.published-rack-module__signal-control,.published-rack-module__copy,.published-rack-module__official')) return;
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingId(id); setDropIndex(order.indexOf(id));
  };
  const trackDrag = (event) => {
    if (!draggingId) return;
    const rows = [...listRef.current.querySelectorAll('[data-rack-module]')];
    const next = rows.findIndex((row) => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
    setDropIndex(next < 0 ? rows.length - 1 : next);
  };
  const finishDrag = () => {
    if (draggingId && Number.isInteger(dropIndex)) {
      setOrder((current) => {
        const from = current.indexOf(draggingId);
        if (from === dropIndex) return current;
        const next = [...current]; next.splice(from, 1); next.splice(dropIndex, 0, draggingId); return next;
      });
    }
    setDraggingId(null); setDropIndex(null);
  };
  const toggleArranging = () => {
    if (arranging) {
      setArranging(false);
      onOrderChange?.([...order]);
      return;
    }
    setOrder(initialOrder);
    setArranging(true);
  };

  return <aside className="published-identity-rack" data-arranging={arranging || undefined} aria-label="Public identity rack" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="published-identity-rack__master">
      <div className="published-identity-rack__mark" aria-hidden="true">
        {avatarUrl ? <PublishedImage src={avatarUrl} alt="" fallback={<span>UP</span>} /> : <span>UP</span>}
      </div>
      <div className="published-identity-rack__brand"><strong>IDENTITY</strong><small>PUBLIC PROFILE</small></div>
      <button className="published-rack-master-control" type="button" aria-label="Collapse all identity modules" onClick={() => { setOpenIds(new Set()); setProfileShowsAddress(false); }}><CollapseAllIcon /><span>COLLAPSE ALL</span></button>
      <button className="published-rack-master-control" type="button" aria-label={arranging ? 'Finish arranging identity modules' : 'Arrange identity modules'} aria-pressed={arranging} onClick={toggleArranging}><ArrangeIcon /><span>{arranging ? 'DONE' : 'ARRANGE'}</span></button>
    </header>
    <div className="published-identity-rack__list" ref={listRef}>
      {order.map((id, index) => {
        const module = rack.modules.find((candidate) => candidate.id === id);
        if (!module) return null;
        const fixedProfile = id === 'profile';
        const open = !fixedProfile && openIds.has(id); const contentId = `${rackId}-${id}`;
        return <section className="published-rack-module" data-rack-module={id} data-profile={fixedProfile || undefined} data-open={open || undefined} data-dragging={draggingId === id || undefined} data-drop-before={Boolean(draggingId && dropIndex === index) || undefined} key={id} onKeyDown={(event) => { if (!fixedProfile && event.key === 'Escape') { event.preventDefault(); collapse(id); } }}>
          <div className="published-rack-module__bar" onPointerDown={(event) => beginDrag(event, id)} onPointerMove={trackDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
            <button className="published-rack-module__name" type="button" aria-expanded={fixedProfile ? undefined : open} aria-controls={fixedProfile ? undefined : contentId} aria-keyshortcuts={arranging ? 'Alt+ArrowUp Alt+ArrowDown' : undefined} aria-label={fixedProfile ? `${profileShowsAddress ? `Profile address ${rack.address}` : rack.displayName}. Show ${profileShowsAddress ? 'profile name' : 'profile address'}` : undefined} onClick={() => {
              if (arranging) return;
              if (fixedProfile) setProfileShowsAddress((value) => !value); else toggle(id);
            }} onKeyDown={(event) => {
              if (arranging && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); move(id, event.key === 'ArrowUp' ? -1 : 1); }
            }}><strong>{fixedProfile ? <ScrambledLabel value={profileShowsAddress ? rack.displayAddress : rack.displayName} /> : module.label}</strong>{arranging && <small>ALT + ↑↓</small>}</button>
            {fixedProfile ? <>
              <button className="published-rack-module__copy" type="button" onClick={copyProfileAddress} aria-label={`Copy ${rack.displayName} profile address`}><CopyIcon /></button>
              <a className="published-rack-module__official" href={rack.officialProfileUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`View ${rack.displayName} on Universal Everything`}><ExternalIcon /></a>
            </> : <>
              <span className="published-rack-module__control-spacer" aria-hidden="true" />
              <button className="published-rack-module__signal-control" type="button" aria-expanded={open} aria-controls={contentId} aria-label={`${open ? 'Collapse' : 'Expand'} ${module.label}`} onClick={() => toggle(id)}><span className="published-rack-module__signal" aria-hidden="true" /></button>
            </>}
          </div>
          {!fixedProfile && <div className="published-rack-module__body" id={contentId} hidden={!open}><ModuleBody id={id} rack={rack} /></div>}
        </section>;
      })}
    </div>
    <output className="published-identity-rack__announcement" aria-live="polite">{announcement}</output>
  </aside>;
}
