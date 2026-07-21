import React, { useId, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import PublishedHomeWorld from '../src/profileDocument/components/PublishedHomeWorld.jsx';
import '../src/index.css';
import '../src/public/moduleGrid.css';
import '../src/library/collection.css';
import '../src/profileDocument/profileDocument.css';
import '../src/public/canvasObjects.css';
import './public-rack-prototype.css';
import './identity-rack-prototype.css';

// Deterministic, fictional fixture-only identity. None of these labels,
// addresses, links, or verification statements come from production data.
const IDENTITY = Object.freeze({
  displayLabel: 'VESPER NULL#0042',
  address: '0x7a91c64d2780ff52004239da0b40420a66b42420',
  displayAddress: '0x7a91c64d…b42420',
  avatarUrl: '/fixtures/profile-identity-radar.svg',
  bio: 'I collect the signals that remain after the source has disappeared. The archive is not a history. It is a map of what still answers.',
  linkedAccounts: Object.freeze([
    { label: 'PRIMARY UNIVERSAL PROFILE', address: '0x7a91…b42420', verification: 'VERIFIED LINK — FIXTURE ONLY' },
    { label: 'FIELD ARCHIVE', address: '0x0042…c091ae', verification: 'VERIFIED LINK — FIXTURE ONLY' },
    { label: 'SIGNAL RELAY', address: '@vesper-null', verification: 'VERIFIED LINK — FIXTURE ONLY' }
  ]),
  links: Object.freeze(['FIELD RECORD', 'SIGNAL INDEX', 'PUBLIC TRANSMISSIONS']),
  tags: Object.freeze(['ARCHIVIST', 'SOUND', 'MOTION', 'DARK AMBIENT'])
});

const WORLD_DOCUMENT = Object.freeze({
  version: 4,
  profile: { address: IDENTITY.address, cachedIdentity: { name: IDENTITY.displayLabel } },
  presentation: { keeperId: 'abyssal_eye', stageId: 'void', environment: null },
  spaces: Object.freeze([]),
  canvasObjects: Object.freeze([])
});

const MODULES = Object.freeze([
  { id: 'profile', label: 'PROFILE' },
  { id: 'bio', label: 'BIO' },
  { id: 'links-tags', label: 'LINKS / TAGS' }
]);

function ProfileBody() {
  return <div className="identity-rack-profile">
    <header>
      <strong>{IDENTITY.displayLabel}</strong>
      <code title={IDENTITY.address}>{IDENTITY.displayAddress}</code>
    </header>
    <div className="identity-rack-profile__projection">
      <img src={IDENTITY.avatarUrl} alt="" draggable="false" />
      <section aria-label="Verified linked accounts fixture">
        <h3>VERIFIED LINKED ACCOUNTS <span>/ FIXTURE DATA</span></h3>
        <ul>{IDENTITY.linkedAccounts.map((account) => <li key={account.label}>
          <strong>{account.label}</strong><code>{account.address}</code><small>{account.verification}</small>
        </li>)}</ul>
      </section>
    </div>
  </div>;
}

function BioBody() {
  return <div className="identity-rack-bio">
    <span aria-hidden="true">“</span>
    <p>{IDENTITY.bio}</p>
    <small>PUBLIC STATEMENT / FICTIONAL FIXTURE</small>
  </div>;
}

function LinksTagsBody() {
  return <div className="identity-rack-links-tags">
    <nav aria-label="Fixture public links">
      {IDENTITY.links.map((label) => <a href="#fixture-link" onClick={(event) => event.preventDefault()} key={label}><span aria-hidden="true">↗</span>{label}</a>)}
    </nav>
    <ul aria-label="Fixture public tags">{IDENTITY.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
  </div>;
}

function ModuleBody({ id }) {
  if (id === 'profile') return <ProfileBody />;
  if (id === 'bio') return <BioBody />;
  return <LinksTagsBody />;
}

function IdentityRack() {
  const [order, setOrder] = useState(MODULES.map(({ id }) => id));
  const [openIds, setOpenIds] = useState(() => new Set());
  const [arranging, setArranging] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const listRef = useRef(null);
  const rackId = useId();

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
    const next = [...current];
    next.splice(from, 1); next.splice(to, 0, id);
    setAnnouncement(`${MODULES.find((module) => module.id === id).label} moved to position ${to + 1}`);
    return next;
  });

  const handleNameKey = (event, id) => {
    if (arranging && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); move(id, event.key === 'ArrowUp' ? -1 : 1); return;
    }
    if (!arranging && ['Enter', ' '].includes(event.key)) { event.preventDefault(); toggle(id); }
  };

  const beginDrag = (event, id) => {
    if (!arranging || event.button !== 0 || event.target.closest('.rack-module__signal-control')) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
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

  return <aside className="public-rack identity-rack" data-arranging={arranging || undefined} aria-label="Public identity rack" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="public-rack__master">
      <div className="public-rack__mark identity-rack__mark" aria-hidden="true"><img src="/assets/logo/underneath_os.svg" alt="" draggable="false" /></div>
      <div className="public-rack__brand"><strong>IDENTITY</strong><small>PUBLIC PROFILE</small></div>
      <button type="button" onClick={() => setOpenIds(new Set())}>COLLAPSE ALL</button>
      <button type="button" aria-pressed={arranging} onClick={() => setArranging((value) => !value)}>{arranging ? 'DONE' : 'ARRANGE'}</button>
    </header>
    <div className="public-rack__list" ref={listRef}>
      {order.map((id, index) => {
        const module = MODULES.find((candidate) => candidate.id === id);
        const open = openIds.has(id);
        const contentId = `${rackId}-${id}`;
        return <section className="rack-module" data-rack-module={id} data-open={open || undefined} data-dragging={draggingId === id || undefined} data-drop-before={draggingId && dropIndex === index || undefined} key={id} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); collapse(id); } }}>
          <div className="rack-module__bar" onPointerDown={(event) => beginDrag(event, id)} onPointerMove={trackDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
            <button className="rack-module__name" type="button" aria-expanded={open} aria-controls={contentId} aria-keyshortcuts={arranging ? 'Alt+ArrowUp Alt+ArrowDown' : undefined} onClick={() => !arranging && toggle(id)} onKeyDown={(event) => handleNameKey(event, id)}><strong>{module.label}</strong>{arranging && <small>ALT + ↑↓</small>}</button>
            <span className="rack-module__control-spacer" aria-hidden="true" />
            <button className="rack-module__signal-control" type="button" aria-expanded={open} aria-controls={contentId} aria-label={`${open ? 'Collapse' : 'Expand'} ${module.label}`} onClick={() => toggle(id)}><span className="rack-module__signal" aria-hidden="true" /></button>
          </div>
          <div className="rack-module__body" id={contentId} hidden={!open}><ModuleBody id={id} /></div>
        </section>;
      })}
    </div>
    <output className="public-rack__announcement" aria-live="polite">{announcement}</output>
  </aside>;
}

function Prototype() {
  const [moves, setMoves] = useState(0);
  window.__identityRackFixture = { get keeperMoves() { return moves; } };
  return <div className="application-root public-rack-page identity-rack-page" data-browser-fixture data-application-mode="public">
    <div className="application-world" data-visible><img className="public-rack-page__keeper" src="/assets/actors/abyssal_eye/full.webp" alt="" draggable="false" /></div>
    <div className="application-interface" data-visible><PublishedHomeWorld document={WORLD_DOCUMENT} onMoveKeeper={() => setMoves((value) => value + 1)} /><IdentityRack /></div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Prototype />);
