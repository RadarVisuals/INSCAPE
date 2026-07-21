import React, { useEffect, useId, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import PublishedHomeWorld from '../src/profileDocument/components/PublishedHomeWorld.jsx';
import '../src/index.css';
import '../src/public/moduleGrid.css';
import '../src/library/collection.css';
import '../src/profileDocument/profileDocument.css';
import '../src/public/canvasObjects.css';
import './public-rack-prototype.css';

// Deliberately invented, fixture-only content. This is a visual and interaction
// prototype, not a production identity projection or publication-format proposal.
const PROFILE = Object.freeze({
  name: 'VXCTXR#F3C1',
  address: '0xf3c189819fd5b042f692983bfbfd57ab607ee709',
  displayAddress: '0xf3c18981…ee709',
  avatarUrl: '/fixtures/profile-identity-radar.svg',
  bio: 'Turning feeling into form. Building a memory beneath the visible world.',
  tags: Object.freeze(['Artist', 'Music', 'Motion']),
  links: Object.freeze(['VXCTXR // X', 'RADAR // X', 'RADAR // UP']),
  officialUrl: 'https://example.com/universal-profile'
});

const WORLD_DOCUMENT = Object.freeze({
  version: 4,
  profile: { address: PROFILE.address, cachedIdentity: { name: PROFILE.name } },
  presentation: { keeperId: 'abyssal_eye', stageId: 'void', environment: null },
  spaces: Object.freeze([]),
  canvasObjects: Object.freeze([])
});

const MODULES = Object.freeze([
  { id: 'identity', label: PROFILE.name, type: 'identity' },
  { id: 'archive', label: 'FIRST PUBLIC TEST', type: 'gallery' },
  { id: 'field-notes', label: 'FIELD NOTES / CAVE 42', type: 'notes' },
  { id: 'signals', label: 'RECOVERED SIGNALS', type: 'signals' }
]);

function IdentityBody() {
  return <div className="rack-identity">
    <code title={PROFILE.address}>{PROFILE.displayAddress}</code>
    <div className="rack-identity__person">
      <img src={PROFILE.avatarUrl} alt="" draggable="false" />
      <p>{PROFILE.bio}</p>
    </div>
    <ul aria-label="Public profile tags">{PROFILE.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
    <nav aria-label="Public profile links">{PROFILE.links.map((label) => <a key={label} href="https://example.com" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><span aria-hidden="true">↗</span>{label}</a>)}</nav>
  </div>;
}

function GalleryBody() {
  return <div className="rack-gallery">
    {['MEMORY FRAGMENT', 'SIGNAL STUDY', 'KEEPER RECORD'].map((label, index) => <article key={label}>
      <div className={`rack-gallery__image rack-gallery__image--${index + 1}`} aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span></div>
      <strong>{label}</strong><small>PUBLIC OBJECT / 0{index + 1}</small>
    </article>)}
  </div>;
}

function NotesBody() {
  return <div className="rack-notes">
    <p><time>03:17</time><span>The ground answered before the receiver did.</span></p>
    <p><time>03:26</time><span>Keeper returned with a pattern it could not classify.</span></p>
    <p><time>04:02</time><span>Memory remains intact. Origin remains absent.</span></p>
  </div>;
}

function SignalsBody() {
  return <div className="rack-signals">
    {['IDENTITY CARRIER', 'GRID RELAY', 'ARCHIVE PULSE', 'DISTANT CONTACT'].map((label, index) => <div key={label}><span className={index === 3 ? 'is-quiet' : ''} aria-hidden="true" /><strong>{label}</strong><small>{index === 3 ? 'DORMANT' : 'RECEIVED'}</small></div>)}
  </div>;
}

function ModuleBody({ module }) {
  if (module.type === 'identity') return <IdentityBody />;
  if (module.type === 'gallery') return <GalleryBody />;
  if (module.type === 'notes') return <NotesBody />;
  return <SignalsBody />;
}

function PublicRack() {
  const [order, setOrder] = useState(MODULES.map(({ id }) => id));
  const [openIds, setOpenIds] = useState(() => new Set());
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
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, id);
    setAnnouncement(`${MODULES.find((module) => module.id === id).label} moved to position ${to + 1}`);
    return next;
  });

  const handleKey = (event, id) => {
    if (event.key === 'Escape' && openIds.has(id)) {
      event.preventDefault();
      setOpenIds((current) => { const next = new Set(current); next.delete(id); return next; });
      return;
    }
    if (arranging && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      move(id, event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (!arranging && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      toggle(id);
    }
  };

  const beginDrag = (event, id) => {
    if (!arranging || event.button !== 0 || event.target.closest('.rack-module__official, .rack-module__signal-control')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(id);
    setDropIndex(order.indexOf(id));
  };

  const trackDrag = (event) => {
    if (!draggingId) return;
    const rows = [...listRef.current.querySelectorAll('[data-rack-module]')];
    const nextIndex = rows.findIndex((row) => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
    setDropIndex(nextIndex < 0 ? rows.length - 1 : nextIndex);
  };

  const finishDrag = () => {
    if (draggingId && Number.isInteger(dropIndex)) {
      setOrder((current) => {
        const from = current.indexOf(draggingId);
        if (from === dropIndex) return current;
        const next = [...current];
        next.splice(from, 1);
        next.splice(dropIndex, 0, draggingId);
        return next;
      });
    }
    setDraggingId(null);
    setDropIndex(null);
  };

  useEffect(() => () => setDraggingId(null), []);

  return <aside className="public-rack" data-arranging={arranging || undefined} aria-label="Public profile rack" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="public-rack__master">
      <div className="public-rack__mark" aria-hidden="true"><span>HU</span></div>
      <div className="public-rack__brand"><strong>HUMAN UNDERNEATH</strong><small>PUBLIC MEMORY RACK</small></div>
      <button type="button" onClick={() => setOpenIds(new Set())}>COLLAPSE ALL</button>
      <button type="button" aria-pressed={arranging} onClick={() => setArranging((value) => !value)}>{arranging ? 'DONE' : 'ARRANGE'}</button>
    </header>
    <div className="public-rack__list" ref={listRef}>
      {order.map((id, index) => {
        const module = MODULES.find((candidate) => candidate.id === id);
        const open = openIds.has(id);
        const contentId = `${rackId}-${id}`;
        return <section className="rack-module" data-rack-module={id} data-open={open || undefined} data-dragging={draggingId === id || undefined} data-drop-before={draggingId && dropIndex === index || undefined} key={id} onKeyDown={(event) => event.key === 'Escape' && handleKey(event, id)}>
          <div className="rack-module__bar" onPointerDown={(event) => beginDrag(event, id)} onPointerMove={trackDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
            <button className="rack-module__name" type="button" aria-expanded={open} aria-controls={contentId} aria-keyshortcuts={arranging ? 'Alt+ArrowUp Alt+ArrowDown' : undefined} onClick={() => !arranging && toggle(id)} onKeyDown={(event) => handleKey(event, id)}><strong>{module.label}</strong>{arranging && <small>ALT + ↑↓</small>}</button>
            {module.type === 'identity' ? <a className="rack-module__official" href={PROFILE.officialUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="Open official Universal Profile">↗</a> : <span className="rack-module__control-spacer" aria-hidden="true" />}
            <button className="rack-module__signal-control" type="button" aria-expanded={open} aria-controls={contentId} aria-label={`${open ? 'Collapse' : 'Expand'} ${module.label}`} onClick={() => toggle(id)} onKeyDown={(event) => event.key === 'Escape' && handleKey(event, id)}><span className="rack-module__signal" aria-hidden="true" /></button>
          </div>
          <div className="rack-module__body" id={contentId} hidden={!open}><ModuleBody module={module} /></div>
        </section>;
      })}
    </div>
    <output className="public-rack__announcement" aria-live="polite">{announcement}</output>
  </aside>;
}

function Prototype() {
  const [moves, setMoves] = useState(0);
  useEffect(() => { window.__rackFixture = { get keeperMoves() { return moves; } }; }, [moves]);
  return <div className="application-root public-rack-page" data-browser-fixture data-application-mode="public">
    <div className="application-world" data-visible><img className="public-rack-page__keeper" src="/assets/actors/abyssal_eye/full.webp" alt="" draggable="false" /></div>
    <div className="application-interface" data-visible><PublishedHomeWorld document={WORLD_DOCUMENT} onMoveKeeper={() => setMoves((value) => value + 1)} /><PublicRack /></div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Prototype />);
