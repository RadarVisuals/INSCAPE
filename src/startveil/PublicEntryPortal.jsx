import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import useProfileDiscoveryController from '../profileDiscovery/useProfileDiscoveryController.js';
import { usePublishedProfile } from '../profileDocument/state/usePublishedProfile.js';
import { PUBLISHED_PROFILE_STATUS } from '../profileDocument/storage/luksoPublishedProfileRepository.js';
import { selectFeaturedWorld } from './featuredWorld.js';
import '../public/ownerSystemWorkflow/workflowTactile.css';
import '../public/ownerSystemWorkflow/workflowFlat.css';
import './publicEntryPortal.css';

const GridProductionRenderer = lazy(() => import('../profileDocument/components/GridProductionRenderer.jsx'));
const VISIBLE_DOCUMENT_STATES = new Set([PUBLISHED_PROFILE_STATUS.RESOLVED, PUBLISHED_PROFILE_STATUS.STALE]);
const MAX_EXPLORE_RESULTS = 12;
const compactAddress = (address) => address ? `${address.slice(0, 8)}…${address.slice(-5)}` : 'NO PROFILE';
const initials = (value) => String(value || 'UP').split(/\s+/u).filter(Boolean).slice(0, 2)
  .map((part) => part[0]).join('').toUpperCase();

function WorldPreview({ document, grid, priority = false }) {
  if (!document || !grid) return <div className="public-entry-portal__preview-state" data-placeholder="true"><span>INSCAPE</span></div>;
  return <div className="public-entry-portal__world-fit" data-surface={document.appearance.surfaceId}>
    <Suspense fallback={<div className="public-entry-portal__preview-state"><span>Public world</span><small>Preparing preview</small></div>}>
      <GridProductionRenderer document={document} grid={grid} imageLoading={priority ? 'eager' : 'lazy'} />
    </Suspense>
  </div>;
}

function PublishedWorldCard({ compact = false, onVisit, profile, resolutionStore }) {
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
    <button aria-label={canVisit ? `Enter ${identity?.name || 'published world'}` : 'Published world unavailable'}
      className="public-entry-portal__world-action" disabled={!canVisit} onClick={() => onVisit?.(profile.address)} type="button" />
    <div className="public-entry-portal__world-preview" data-surface={document?.appearance?.surfaceId || 'carbon'}>
      <WorldPreview document={document} grid={grid} priority={!compact} />
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

export default function PublicEntryPortal({ connectedProfile, discoveryRepository, embedded = false, menuSurface = 'mist', initialMode = 'landing', mode: controlledMode, onExplore, onHome, onClose,
  onConnect, onDisconnect, onEnterMyWorld, onVisitProfile, resolutionStore }) {
  const [localMode, setMode] = useState(initialMode === 'explore' ? 'explore' : 'landing');
  const mode = controlledMode || localMode;
  const explore = () => { if (mode !== 'explore') onExplore ? onExplore() : setMode('explore'); };
  const [accountOpen, setAccountOpen] = useState(false);
  const [visibleWorlds, setVisibleWorlds] = useState(MAX_EXPLORE_RESULTS);
  const accountRef = useRef(null);
  const searchRef = useRef(null);
  const discovery = useProfileDiscoveryController({ repository: discoveryRepository });
  const featured = selectFeaturedWorld(discovery.profiles);
  const exploreResults = discovery.results.slice(0, visibleWorlds);
  useEffect(() => {
    if (mode === 'explore' && document.activeElement?.matches(':focus-visible')) searchRef.current?.focus({ preventScroll: true });
  }, [mode]);
  useEffect(() => {
    if (mode !== 'explore') return undefined;
    const close = (event) => { if (event.key !== 'Escape' || event.defaultPrevented || accountOpen) return; (onClose || onHome) ? (onClose || onHome)() : setMode('landing'); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [accountOpen, mode, onClose, onHome]);
  useEffect(() => {
    if (!accountOpen) return undefined;
    const close = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
    };
  }, [accountOpen]);

  const returnHome = () => (onClose || onHome) ? (onClose || onHome)() : setMode('landing');
  return <div className="public-entry-portal" data-embedded={embedded || undefined} data-workbench-selection-tools={accountOpen || undefined}
    data-workflow-material="tactile" data-workflow-finish="flat"
    data-lattice-menu-surface data-menu-surface={menuSurface} data-mode={mode}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !accountOpen) return;
      event.preventDefault(); event.stopPropagation(); setAccountOpen(false);
      accountRef.current?.querySelector('button')?.focus({ preventScroll: true });
    }}>
    <header className="public-entry-portal__header">
      <button aria-label={onClose ? 'Return to workspace' : 'Return to INSCAPE landing'} className="public-entry-portal__header-wordmark"
        onClick={returnHome} type="button"><i aria-hidden="true" /></button>
      {mode === 'explore' && <label className="public-entry-portal__header-search">
        <Search aria-hidden="true" size={13} strokeWidth={2} />
        <input aria-label="Search published worlds" ref={searchRef} onChange={(event) => { setVisibleWorlds(MAX_EXPLORE_RESULTS); discovery.setQuery(event.target.value); }}
          placeholder="Search worlds" type="search" value={discovery.query} />
      </label>}
      <nav aria-label="Public entry">
        <button aria-current={mode === 'explore' ? 'page' : undefined} onClick={explore} type="button">Discover</button>
        {connectedProfile ? <div className="public-entry-portal__account" ref={accountRef}>
          <button aria-expanded={accountOpen} className="public-entry-portal__account-trigger"
            onClick={() => setAccountOpen((open) => !open)} type="button">
            <span className="public-entry-portal__account-avatar">{connectedProfile.avatarUrl
              ? <img alt="" referrerPolicy="no-referrer" src={connectedProfile.avatarUrl} />
              : initials(connectedProfile.name)}</span>
            <span>{connectedProfile.name || compactAddress(connectedProfile.address)}</span>
          </button>
          {accountOpen && <div className="public-entry-portal__account-menu">
            <button onClick={() => { setAccountOpen(false); onEnterMyWorld?.(); }} type="button">Enter my world</button>
            <code>{compactAddress(connectedProfile.address)}</code>
            <button onClick={() => { setAccountOpen(false); onDisconnect?.(); }} type="button">Disconnect</button>
          </div>}
        </div> : onConnect && <button onClick={onConnect} type="button">Connect</button>}
      </nav>
    </header>

    {mode === 'landing' ? <main className="public-entry-portal__main">
      <div aria-label="INSCAPE" className="public-entry-portal__wordmark" role="img"><span aria-hidden="true" /></div>
      <p className="public-entry-portal__statement">PUBLISHED WORLDS · SPATIAL STORIES · SHARED SIGNALS</p>
      <PublishedWorldCard onVisit={onVisitProfile} profile={featured}
        resolutionStore={resolutionStore} />
      <div className="public-entry-portal__actions">
        <button className="public-entry-portal__primary" onClick={explore} type="button"><span>Discover</span><b aria-hidden="true">→</b></button>
        {connectedProfile
          ? <button onClick={onEnterMyWorld} type="button"><span>Enter my world</span><b aria-hidden="true">→</b></button>
          : onConnect && <button onClick={onConnect} type="button"><span>Connect profile</span><b aria-hidden="true">→</b></button>}
      </div>
    </main> : <main className="public-entry-portal__explore">
      <section aria-label="Published worlds" className="public-entry-portal__world-grid">
        {exploreResults.map((profile) => <PublishedWorldCard compact
          key={profile.address} onVisit={onVisitProfile} profile={profile} resolutionStore={resolutionStore} />)}
        {!exploreResults.length && <div className="public-entry-portal__empty" role={discovery.status === 'error' ? 'alert' : 'status'}>
          <strong>{discovery.status === 'loading' ? 'Reading public network' : discovery.status === 'error' ? 'Public directory unavailable' : 'No worlds found'}</strong>
          <small>{discovery.status === 'error' ? 'You can retry without connecting a profile.' : discovery.status === 'loading' ? 'Loading published worlds.' : discovery.query ? 'Try another name or profile address.' : 'No published worlds are available yet.'}</small>
          {discovery.status === 'error' && <button onClick={discovery.retry} type="button">Retry Discover</button>}
        </div>}
      </section>
      {discovery.results.length > MAX_EXPLORE_RESULTS && <div className="public-entry-portal__results-rail">
        <span role="status">{exploreResults.length} of {discovery.results.length} worlds</span>
        <button type="button" disabled={exploreResults.length >= discovery.results.length}
          onClick={() => setVisibleWorlds(current => current + MAX_EXPLORE_RESULTS)}>Show more worlds</button>
      </div>}
    </main>}

    <footer className="public-entry-portal__footer"><span>ALPHA · LUKSO MAINNET</span></footer>
  </div>;
}
