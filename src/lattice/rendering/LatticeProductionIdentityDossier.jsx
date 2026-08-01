import { ExternalLink, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { identityDossierViewerLayout } from './identityDossierViewerLayout.js';
import './latticeProductionIdentityDossier.css';

const IDENTITY_TRANSITION_MS = 420;

const SECTIONS = Object.freeze([
  { id: 'profile', label: 'PROFILE MODULE' },
  { id: 'links', label: 'LINK MODULE' },
  { id: 'technical', label: 'TECHNICAL MODULE' }
]);

const compactAddress = (address) => {
  const value = String(address || '');
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
};

function ProfileAvatar({ failed, profile, profileImageUrl, onError }) {
  return <span className="lattice-production-identity-dossier__avatar" data-shape={profile.avatarShape} aria-hidden="true">
    {profileImageUrl && !failed ? <img src={profileImageUrl} alt="" onError={onError} /> : <UserRound />}
  </span>;
}

function ProfileSection({ address, imageFailed, onImageError, profile, profileImageUrl }) {
  const paragraphs = String(profile.description || '').split(/\n{2,}/u).filter(Boolean);
  return <div className="lattice-production-identity-dossier__profile">
    <div className="lattice-production-identity-dossier__identity">
      <ProfileAvatar failed={imageFailed} profile={profile} profileImageUrl={profileImageUrl} onError={onImageError} />
      <span><small>PROFILE IDENTITY</small><h2>{profile.displayName}</h2><code>{compactAddress(address)}</code></span>
    </div>
    <small>DESCRIPTION</small>
    {profile.profileImageTokenReference && !profile.avatarUrl && <p className="lattice-production-identity-dossier__notice">
      TOKEN-BACKED PROFILE IMAGE / REFERENCE RETAINED / MEDIA UNRESOLVED
    </p>}
    {paragraphs.length > 0
      ? <div className="lattice-production-identity-dossier__description">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      : <p className="lattice-production-identity-dossier__empty">NO PROFILE DESCRIPTION AUTHORED</p>}
    {profile.tags.length > 0 && <ul className="lattice-production-identity-dossier__tags" aria-label="Profile tags">
      {profile.tags.map((tag) => <li key={tag}>{tag}</li>)}
    </ul>}
    <footer>SOURCE / {profile.nameProvenance === 'LSP3_NAME' ? 'UNIVERSAL PROFILE' : 'INSCAPE PROFILE'}</footer>
  </div>;
}

function LinksSection({ links }) {
  if (!links.length) return <p className="lattice-production-identity-dossier__empty">NO VISIBLE PROFILE LINKS</p>;
  const groups = [
    { id: 'authored', label: 'PROFILE AUTHORED', links: links.filter((link) => link.kind === 'AUTHORED') },
    { id: 'system', label: 'SYSTEM ROUTES', links: links.filter((link) => link.kind === 'SYSTEM') }
  ].filter((group) => group.links.length);
  return <div className="lattice-production-identity-dossier__links">{groups.map((group) => <section key={group.id}>
    <small>{group.label}</small>
    <ol>{group.links.map((link) => <li key={link.id}>
      <a href={link.url} target="_blank" rel="noreferrer">
        <span><strong>{link.label}</strong><small>{link.kind === 'AUTHORED' ? 'LSP3 / AUTHORED / UNVERIFIED' : 'SYSTEM / CANONICAL ROUTE'}</small></span>
        <ExternalLink aria-hidden="true" />
      </a>
    </li>)}</ol>
  </section>)}</div>;
}

function TechnicalSection({ entries }) {
  const groupFor = (id) => {
    if (['address', 'network', 'type'].includes(id)) return 'contract';
    if (id === 'metadata-integrity') return 'metadata';
    if (id === 'last-published') return 'publication';
    return 'registers';
  };
  const groups = [
    { id: 'contract', label: 'PROFILE CONTRACT' },
    { id: 'metadata', label: 'METADATA' },
    { id: 'publication', label: 'PUBLICATION' },
    { id: 'registers', label: 'ASSET REGISTERS' }
  ].map((group) => ({ ...group, entries: entries.filter((entry) => groupFor(entry.id) === group.id) })).filter((group) => group.entries.length);
  return <div className="lattice-production-identity-dossier__technical">{groups.map((group) => <section key={group.id}>
    <small>{group.label}</small>
    <dl>{group.entries.map((entry) => <div key={entry.id}>
      <dt>{entry.label}</dt>
      <dd>{entry.url ? <a href={entry.url} target="_blank" rel="noreferrer">{entry.value}<ExternalLink aria-hidden="true" /></a> : entry.value}</dd>
      <small>{entry.provenance.replaceAll('_', ' ')}</small>
    </div>)}</dl>
  </section>)}</div>;
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

export default function LatticeProductionIdentityDossier({
  getReturnRectangle,
  gridVariables = null,
  menuSurfaceId,
  model,
  onClosing,
  onClosed,
  originRectangle,
  preloadedProfileImageUrl = null,
  reducedMotion = false,
  returnFocus,
  sourceIdentity = null,
  viewport
}) {
  const rootRef = useRef(null);
  const closeRef = useRef(null);
  const returnFocusRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const [activeSection, setActiveSection] = useState('profile');
  const [phase, setPhase] = useState('starting');
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [returnRectangle, setReturnRectangle] = useState(originRectangle);
  const layout = useMemo(() => identityDossierViewerLayout(originRectangle, viewport), [originRectangle, viewport]);
  const rackRectangle = phase === 'starting' ? originRectangle : phase === 'closing' ? returnRectangle : layout.rack;

  useEffect(() => { setActiveSection('profile'); }, [model?.key]);
  useEffect(() => setProfileImageFailed(false), [preloadedProfileImageUrl]);
  useLayoutEffect(() => {
    if (reducedMotion) { setPhase('open'); return undefined; }
    rootRef.current?.getBoundingClientRect();
    const frame = requestAnimationFrame(() => setPhase('opening'));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);
  useEffect(() => {
    window.clearTimeout(phaseTimerRef.current);
    if (phase === 'opening') phaseTimerRef.current = window.setTimeout(() => setPhase('open'), IDENTITY_TRANSITION_MS);
    return () => window.clearTimeout(phaseTimerRef.current);
  }, [phase]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const isolated = [...document.body.children].filter((node) => node !== root).map((node) => ({
      node, hadInert: node.hasAttribute('inert'), inertValue: node.inert
    }));
    isolated.forEach(({ node }) => { node.inert = true; });
    returnFocusRef.current = returnFocus || document.querySelector('[data-identity-dossier-source="true"]');
    return () => {
      window.clearTimeout(phaseTimerRef.current);
      isolated.forEach(({ node, hadInert, inertValue }) => {
        if (hadInert) node.inert = inertValue;
        else node.removeAttribute('inert');
      });
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
    };
  }, [returnFocus]);

  useEffect(() => {
    if (phase !== 'open') return;
    closeRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const finishClose = useCallback(() => onClosed?.(), [onClosed]);
  const requestClose = useCallback(() => {
    if (phase === 'closing') return;
    onClosing?.();
    const liveRectangle = getReturnRectangle?.();
    if (liveRectangle) setReturnRectangle(liveRectangle);
    if (reducedMotion) { finishClose(); return; }
    setPhase('closing');
  }, [finishClose, getReturnRectangle, onClosing, phase, reducedMotion]);
  useEffect(() => {
    if (phase !== 'closing') return undefined;
    phaseTimerRef.current = window.setTimeout(finishClose, IDENTITY_TRANSITION_MS);
    return () => window.clearTimeout(phaseTimerRef.current);
  }, [finishClose, phase]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); requestClose();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [requestClose]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...rootRef.current.querySelectorAll(FOCUSABLE_SELECTOR)].filter((node) => !node.closest('[inert]'));
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const collapsedRackHeight = (SECTIONS.length - 1) * 53 + (SECTIONS.length - 1) * 5;
  const expandedModuleHeight = Math.round(Math.max(53, layout.rack.height - collapsedRackHeight));
  let moduleTop = 0;
  const moduleTracks = new Map(SECTIONS.map(({ id }) => {
    const height = id === activeSection ? expandedModuleHeight : 53;
    const track = { height, '--lattice-identity-module-y': `${Math.round(moduleTop)}px` };
    moduleTop += height + 5;
    return [id, track];
  }));
  return createPortal(<section
    ref={rootRef}
    aria-labelledby="lattice-production-identity-dossier-title"
    aria-modal="true"
    className="lattice-production-identity-viewer"
    data-layout={layout.mode}
    data-menu-surface={menuSurfaceId}
    data-phase={phase}
    data-source-compact={originRectangle.width <= 56 || undefined}
    id="lattice-profile-dossier"
    style={gridVariables || undefined}
    onKeyDown={handleKeyDown}
    onPointerDown={(event) => { if (phase === 'open' && event.target === event.currentTarget) requestClose(); }}
    onWheel={(event) => {
      if (event.target.closest?.('[data-identity-dossier-scroll]')) { event.stopPropagation(); return; }
      event.preventDefault(); event.stopPropagation();
    }}
    role="dialog"
  >
    <div aria-hidden="true" className="lattice-production-identity-viewer__veil" />
    <div className="lattice-production-identity-dossier" style={{
      left: rackRectangle.left, top: rackRectangle.top, width: rackRectangle.width, height: rackRectangle.height
    }}>
      <h1 className="lattice-production-identity-dossier__accessible-title" id="lattice-production-identity-dossier-title">{model.profile.displayName} identity rack</h1>
      <div className="lattice-production-identity-dossier__source-summary" aria-hidden="true">
        <span className="lattice-profile-rail__avatar">
          {sourceIdentity?.avatarUrl ? <img src={sourceIdentity.avatarUrl} alt="" /> : <UserRound />}
        </span>
        <span className="lattice-profile-rail__identity-copy">
          <strong>{sourceIdentity?.displayName || model.profile.displayName}</strong>
          <small>{sourceIdentity?.secondaryLabel || compactAddress(model.address)}</small>
        </span>
      </div>
      <div className="lattice-production-identity-dossier__frame">
      <div className="lattice-production-identity-dossier__modules" data-identity-dossier-scroll>
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return <section key={section.id} className="lattice-production-identity-dossier__module" data-active={active || undefined} style={moduleTracks.get(section.id)}>
            <button type="button" aria-expanded={active} aria-controls={`identity-dossier-${section.id}`} onClick={() => setActiveSection(section.id)}>
              <i aria-hidden="true" /><strong>{section.label}</strong><b aria-hidden="true">{active ? '\u2212' : '+'}</b>
            </button>
            <div id={`identity-dossier-${section.id}`} className="lattice-production-identity-dossier__panel" inert={!active ? '' : undefined} data-identity-dossier-scroll>
              <div>
                {section.id === 'profile' && <ProfileSection address={model.address} imageFailed={profileImageFailed} onImageError={() => setProfileImageFailed(true)} profile={model.profile} profileImageUrl={preloadedProfileImageUrl} />}
                {section.id === 'links' && <LinksSection links={model.links} />}
                {section.id === 'technical' && <TechnicalSection entries={model.technical} />}
              </div>
            </div>
          </section>;
        })}
      </div>
    </div>
    </div>
    <button
      ref={closeRef}
      className="lattice-production-identity-viewer__close-control"
      type="button"
      onClick={requestClose}
      aria-label="Close Identity Rack"
    ><span>CLOSE PROFILE</span><X aria-hidden="true" /></button>
  </section>, document.body);
}
