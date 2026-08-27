import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import useProfileDiscoveryController from '../profileDiscovery/useProfileDiscoveryController.js';
import { usePublishedProfile } from '../profileDocument/state/usePublishedProfile.js';
import { PUBLISHED_PROFILE_STATUS } from '../profileDocument/storage/luksoPublishedProfileRepository.js';
import './publicEntryPortal.css';

const GridProductionRenderer = lazy(() => import('../profileDocument/components/GridProductionRenderer.jsx'));
const VISIBLE_DOCUMENT_STATES = new Set([PUBLISHED_PROFILE_STATUS.RESOLVED, PUBLISHED_PROFILE_STATUS.STALE]);
const MAX_EXPLORE_RESULTS = 12;
const compactAddress = (address) => address ? `${address.slice(0, 8)}…${address.slice(-5)}` : 'NO PROFILE';
const initials = (value) => String(value || 'UP').split(/\s+/u).filter(Boolean).slice(0, 2)
  .map((part) => part[0]).join('').toUpperCase();

function WorldPreview({ canonical = false, document, grid, priority = false }) {
  const frameRef = useRef(null);
  const [fit, setFit] = useState(null);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !document || !grid || canonical) return undefined;
    let animationFrame = 0;
    const update = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const placements = [...frame.querySelectorAll('.lattice-production-placement')];
        const width = frame.clientWidth;
        const height = frame.clientHeight;
        if (!placements.length || !width || !height) { setFit(null); return; }
        const bounds = placements.reduce((current, placement) => ({
          left: Math.min(current.left, placement.offsetLeft),
          top: Math.min(current.top, placement.offsetTop),
          right: Math.max(current.right, placement.offsetLeft + placement.offsetWidth),
          bottom: Math.max(current.bottom, placement.offsetTop + placement.offsetHeight),
        }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
        const contentWidth = Math.max(1, bounds.right - bounds.left);
        const contentHeight = Math.max(1, bounds.bottom - bounds.top);
        const scale = Math.max(width / contentWidth, height / contentHeight);
        setFit({ x: (width - contentWidth * scale) / 2 - bounds.left * scale,
          y: (height - contentHeight * scale) / 2 - bounds.top * scale, scale });
      });
    };
    const mutations = new MutationObserver(update);
    const resize = new ResizeObserver(update);
    mutations.observe(frame, { childList: true, subtree: true });
    resize.observe(frame);
    update();
    return () => { window.cancelAnimationFrame(animationFrame); mutations.disconnect(); resize.disconnect(); };
  }, [canonical, document, grid]);
  if (!document || !grid) return <div className="public-entry-portal__preview-state" data-placeholder="true"><span>INSCAPE</span></div>;
  return <div className="public-entry-portal__world-fit" data-fitted={fit ? '' : undefined}
    data-canonical={canonical || undefined}
    data-surface={document.appearance.surfaceId} ref={frameRef}
    style={fit ? { '--portal-preview-scale': fit.scale, '--portal-preview-x': `${fit.x}px`, '--portal-preview-y': `${fit.y}px` } : undefined}>
    <Suspense fallback={<div className="public-entry-portal__preview-state"><span>PUBLIC WORLD</span><small>PREPARING GRID</small></div>}>
      <GridProductionRenderer document={document} grid={grid} imageLoading={priority ? 'eager' : 'lazy'} />
    </Suspense>
  </div>;
}

function PublishedWorldCard({ compact = false, discoveryStatus, onVisit, profile, resolutionStore }) {
  const cardRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(!compact);
  useEffect(() => {
    if (!compact || nearViewport) return undefined;
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver !== 'function') { setNearViewport(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setNearViewport(true); observer.disconnect();
    }, { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact, nearViewport]);
  const [resolution] = usePublishedProfile(nearViewport ? profile?.address || null : null, resolutionStore);
  const document = VISIBLE_DOCUMENT_STATES.has(resolution?.status) ? resolution.document : null;
  const grid = document?.metadata?.worldCover?.grid || null;
  const identity = document?.profile?.cachedIdentity || profile;
  const canVisit = Boolean(profile?.address && document);
  return <article aria-busy={resolution?.busy || undefined} className="public-entry-portal__world-card" ref={cardRef}
    data-empty={!profile || undefined} data-variant={compact ? 'compact' : 'feature'}>
    <button aria-label={canVisit ? `Enter ${profile.name || 'published world'}` : 'Published world unavailable'}
      className="public-entry-portal__world-action" disabled={!canVisit} onClick={() => onVisit?.(profile.address)} type="button" />
    <div className="public-entry-portal__world-preview" data-surface={document?.appearance?.surfaceId || 'carbon'}>
      <WorldPreview canonical document={document} grid={grid} priority={!compact} />
    </div>
    <footer>
      <span className="public-entry-portal__publisher-avatar">
        {identity?.avatarUrl ? <img alt="" referrerPolicy="no-referrer" src={identity.avatarUrl} /> : initials(identity?.name)}
      </span>
      <span className="public-entry-portal__publisher"><strong>{identity?.name || 'INSCAPE PUBLIC NETWORK'}</strong>
        <code>{compactAddress(profile?.address)}</code></span>
    </footer>
  </article>;
}

export default function PublicEntryPortal({ connectedProfile, discoveryRepository, embedded = false, initialMode = 'landing', onClose,
  onConnect, onDisconnect, onEnterMyWorld, onVisitProfile, resolutionStore }) {
  const [mode, setMode] = useState(initialMode === 'explore' ? 'explore' : 'landing');
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const discovery = useProfileDiscoveryController({ repository: discoveryRepository });
  const featured = discovery.results[0] || null;
  const exploreResults = discovery.results.slice(0, MAX_EXPLORE_RESULTS);
  useEffect(() => {
    if (mode !== 'explore') return undefined;
    const close = (event) => { if (event.key !== 'Escape' || accountOpen) return; onClose ? onClose() : setMode('landing'); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [accountOpen, mode, onClose]);
  useEffect(() => {
    if (!accountOpen) return undefined;
    const close = (event) => {
      if (event.key === 'Escape' || !accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [accountOpen]);

  const returnHome = () => onClose ? onClose() : setMode('landing');
  return <div className="public-entry-portal" data-embedded={embedded || undefined}
    data-lattice-menu-surface data-menu-surface="mist" data-mode={mode}>
    <header className="public-entry-portal__header">
      <button aria-label={onClose ? 'Return to workspace' : 'Return to INSCAPE landing'} className="public-entry-portal__header-wordmark"
        onClick={returnHome} type="button"><i aria-hidden="true" /></button>
      {mode === 'explore' && <label className="public-entry-portal__header-search">
        <Search aria-hidden="true" size={13} strokeWidth={2} />
        <input aria-label="Search published worlds" autoFocus onChange={(event) => discovery.setQuery(event.target.value)}
          placeholder="SEARCH WORLDS" type="search" value={discovery.query} />
      </label>}
      <nav aria-label="Public entry">
        <button aria-current={mode === 'explore' ? 'page' : undefined} onClick={() => setMode('explore')} type="button">EXPLORE WORLDS</button>
        {connectedProfile ? <div className="public-entry-portal__account" ref={accountRef}>
          <button aria-expanded={accountOpen} className="public-entry-portal__account-trigger"
            onClick={() => setAccountOpen((open) => !open)} type="button">
            <span className="public-entry-portal__account-avatar">{connectedProfile.avatarUrl
              ? <img alt="" referrerPolicy="no-referrer" src={connectedProfile.avatarUrl} />
              : initials(connectedProfile.name)}</span>
            <span>{connectedProfile.name || compactAddress(connectedProfile.address)}</span>
          </button>
          {accountOpen && <div className="public-entry-portal__account-menu">
            <button onClick={() => { setAccountOpen(false); onEnterMyWorld?.(); }} type="button">ENTER MY WORLD</button>
            <code>{compactAddress(connectedProfile.address)}</code>
            <button onClick={() => { setAccountOpen(false); onDisconnect?.(); }} type="button">DISCONNECT</button>
          </div>}
        </div> : onConnect && <button onClick={onConnect} type="button">CONNECT</button>}
      </nav>
    </header>

    {mode === 'landing' ? <main className="public-entry-portal__main">
      <div aria-label="INSCAPE" className="public-entry-portal__wordmark" role="img"><span aria-hidden="true" /></div>
      <p className="public-entry-portal__statement">PUBLISHED WORLDS · SPATIAL STORIES · SHARED SIGNALS</p>
      <PublishedWorldCard discoveryStatus={discovery.status} onVisit={onVisitProfile} profile={featured}
        resolutionStore={resolutionStore} />
      <div className="public-entry-portal__actions">
        <button className="public-entry-portal__primary" onClick={() => setMode('explore')} type="button"><span>EXPLORE WORLDS</span><b aria-hidden="true">→</b></button>
        {connectedProfile
          ? <button onClick={onEnterMyWorld} type="button"><span>ENTER MY WORLD</span><b aria-hidden="true">→</b></button>
          : onConnect && <button onClick={onConnect} type="button"><span>CONNECT PROFILE</span><b aria-hidden="true">→</b></button>}
      </div>
    </main> : <main className="public-entry-portal__explore">
      <section aria-label="Published worlds" className="public-entry-portal__world-grid">
        {exploreResults.map((profile) => <PublishedWorldCard compact discoveryStatus={discovery.status}
          key={profile.address} onVisit={onVisitProfile} profile={profile} resolutionStore={resolutionStore} />)}
        {!exploreResults.length && <div className="public-entry-portal__empty">
          <strong>{discovery.status === 'loading' ? 'READING PUBLIC NETWORK' : discovery.status === 'error' ? 'PUBLIC DIRECTORY UNAVAILABLE' : 'NO WORLDS FOUND'}</strong>
          <small>{discovery.status === 'error' ? 'THE DIRECTORY CAN BE RETRIED WITHOUT CONNECTING A PROFILE.' : 'TRY ANOTHER NAME OR PROFILE ADDRESS.'}</small>
          {discovery.status === 'error' && <button onClick={discovery.retry} type="button">RETRY DIRECTORY</button>}
        </div>}
      </section>
    </main>}

    <footer className="public-entry-portal__footer"><span>ALPHA · LUKSO MAINNET</span></footer>
  </div>;
}
