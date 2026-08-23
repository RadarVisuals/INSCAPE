import { ExternalLink, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { identityDossierViewerLayout } from './identityDossierViewerLayout.js';
import DisclosureModule from './DisclosureModule.jsx';
import { createDisclosureModuleTracks } from './disclosureModuleTracks.js';
import './latticeProductionIdentityDossier.css';

const IDENTITY_TRANSITION_MS = 420;

const SECTIONS = Object.freeze([
  { id: 'profile', label: 'Profile' },
  { id: 'links', label: 'Links' },
  { id: 'technical', label: 'Technical' }
]);

const compactAddress = (address) => {
  const value = String(address || '');
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
};

function ProfileSection({ profile }) {
  const paragraphs = String(profile.description || '').split(/\n{2,}/u).filter(Boolean);
  return <div className="lattice-production-identity-dossier__profile">
    <div aria-hidden="true" className="lattice-production-identity-dossier__identity" />
    {profile.profileImageTokenReference && !profile.avatarUrl && <p className="lattice-production-identity-dossier__notice">
      TOKEN-BACKED PROFILE IMAGE / REFERENCE RETAINED / MEDIA UNRESOLVED
    </p>}
    {paragraphs.length > 0
      ? <div className="lattice-production-identity-dossier__description">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      : <p className="lattice-production-identity-dossier__empty">No profile description authored</p>}
    {profile.tags.length > 0 && <ul className="lattice-production-identity-dossier__tags" aria-label="Profile tags">
      {profile.tags.map((tag) => <li key={tag}>{tag}</li>)}
    </ul>}
  </div>;
}

function LinksSection({ links }) {
  if (!links.length) return <p className="lattice-production-identity-dossier__empty">No visible profile links</p>;
  return <div className="lattice-production-identity-dossier__links">
    <ol>{links.map((link) => <li key={link.id}>
      <a href={link.url} target="_blank" rel="noreferrer">
        <span><strong>{link.label}</strong></span>
        <ExternalLink aria-hidden="true" />
      </a>
    </li>)}</ol>
  </div>;
}

function TechnicalSection({ entries }) {
  const groupFor = (id) => {
    if (['address', 'network', 'type'].includes(id)) return 'contract';
    if (id === 'last-published') return 'publication';
    return 'registers';
  };
  const groups = [
    { id: 'contract', label: 'Profile contract' },
    { id: 'publication', label: 'Publication' },
    { id: 'registers', label: 'Asset registers' }
  ].map((group) => ({
    ...group,
    entries: entries.filter((entry) => entry.id !== 'metadata-integrity' && groupFor(entry.id) === group.id)
  })).filter((group) => group.entries.length);
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
  gridVisible = true,
  inlineCloseControl = false,
  menuSurfaceId,
  model,
  onClosing,
  onClosed,
  onOpening,
  originRectangle,
  persistent = false,
  preloadedProfileImageUrl = null,
  reducedMotion = false,
  returnFocus,
  sourceIdentity = null,
  viewport,
  workspaceSurfaceColor = null
}) {
  const rootRef = useRef(null);
  const dossierRef = useRef(null);
  const closeRef = useRef(null);
  const compactControlRef = useRef(null);
  const returnFocusRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const [activeSection, setActiveSection] = useState('profile');
  const [phase, setPhase] = useState('starting');
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [returnRectangle, setReturnRectangle] = useState(originRectangle);
  const sharedAvatarUrl = sourceIdentity?.avatarUrl || preloadedProfileImageUrl;
  const layout = useMemo(() => identityDossierViewerLayout(originRectangle, viewport), [originRectangle, viewport]);
  const rackRectangle = phase === 'starting' ? originRectangle : phase === 'closing' ? returnRectangle : layout.rack;
  const compact = phase === 'compact';
  const visibleRectangle = compact ? returnRectangle : rackRectangle;
  const moduleTracks = useMemo(() => createDisclosureModuleTracks(
    SECTIONS,
    activeSection,
    layout.rack.height,
    53,
  ), [activeSection, layout.rack.height]);

  useEffect(() => { setActiveSection('profile'); }, [model?.key]);
  useEffect(() => setProfileImageFailed(false), [sharedAvatarUrl]);
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
    if (compact) return undefined;
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
  }, [compact, returnFocus]);

  useEffect(() => {
    if (!compact) return undefined;
    const updateReturnRectangle = () => {
      const liveRectangle = getReturnRectangle?.();
      if (liveRectangle) setReturnRectangle(liveRectangle);
    };
    window.addEventListener('resize', updateReturnRectangle);
    return () => window.removeEventListener('resize', updateReturnRectangle);
  }, [compact, getReturnRectangle]);

  useEffect(() => {
    if (phase !== 'open') return;
    closeRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const finishClose = useCallback(() => {
    if (!persistent) { onClosed?.(); return; }
    setPhase('compact');
    onClosed?.();
  }, [onClosed, persistent]);
  useEffect(() => {
    if (phase !== 'compact') return;
    compactControlRef.current?.focus({ preventScroll: true });
  }, [phase]);
  const requestOpen = useCallback(() => {
    if (!persistent || phase !== 'compact') return;
    const liveRectangle = getReturnRectangle?.();
    if (liveRectangle) setReturnRectangle(liveRectangle);
    setActiveSection('profile');
    onOpening?.();
    setPhase('opening');
  }, [getReturnRectangle, onOpening, persistent, phase]);
  const requestClose = useCallback(() => {
    if (phase === 'closing' || phase === 'compact') return;
    onClosing?.();
    const liveRectangle = getReturnRectangle?.();
    if (liveRectangle) setReturnRectangle(liveRectangle);
    if (reducedMotion) { finishClose(); return; }
    setPhase('closing');
  }, [finishClose, getReturnRectangle, onClosing, phase, reducedMotion]);
  useEffect(() => {
    if (phase !== 'closing') return undefined;
    phaseTimerRef.current = window.setTimeout(finishClose, IDENTITY_TRANSITION_MS + 120);
    return () => window.clearTimeout(phaseTimerRef.current);
  }, [finishClose, phase]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || phase === 'compact') return;
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
  return createPortal(<section
    ref={rootRef}
    aria-labelledby={compact ? undefined : 'lattice-production-identity-dossier-title'}
    aria-modal={compact ? undefined : 'true'}
    className="lattice-production-identity-viewer"
    data-layout={layout.mode}
    data-grid-visible={gridVisible}
    data-menu-surface={menuSurfaceId}
    data-phase={phase}
    data-profile-active={activeSection === 'profile' || undefined}
    data-persistent={persistent || undefined}
    data-source-compact={originRectangle.width <= 56 || undefined}
    data-system-workflow-overlay={persistent || undefined}
    id="lattice-profile-dossier"
    style={{ ...(gridVariables || {}), ...(workspaceSurfaceColor ? { '--lattice-identity-workspace-surface': workspaceSurfaceColor } : {}) }}
    onKeyDown={handleKeyDown}
    onPointerDown={(event) => { if (phase === 'open' && event.target === event.currentTarget) requestClose(); }}
    onWheel={(event) => {
      if (event.target.closest?.('[data-identity-dossier-scroll]')) { event.stopPropagation(); return; }
      event.preventDefault(); event.stopPropagation();
    }}
    role={compact ? undefined : 'dialog'}
  >
    <div aria-hidden="true" className="lattice-production-identity-viewer__veil" />
    <div className="lattice-production-identity-dossier" ref={dossierRef} onTransitionEnd={(event) => {
      if (phase === 'closing' && event.target === dossierRef.current && event.propertyName === 'left') finishClose();
    }} style={{
      left: visibleRectangle.left, top: visibleRectangle.top, width: visibleRectangle.width, height: visibleRectangle.height
    }}>
      <h1 className="lattice-production-identity-dossier__accessible-title" id="lattice-production-identity-dossier-title">{model.profile.displayName} identity rack</h1>
      <span className="lattice-production-identity-dossier__shared-avatar" aria-hidden="true">
        {sharedAvatarUrl && !profileImageFailed
          ? <img src={sharedAvatarUrl} alt="" onError={() => setProfileImageFailed(true)} />
          : <UserRound />}
        <svg aria-hidden="true" className="inscape-profile-avatar-ring" focusable="false" viewBox="0 0 36 36"><circle cx="18" cy="18" fill="none" r="17.5" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" /></svg>
      </span>
      <button aria-label={compact ? `Open ${sourceIdentity?.displayName || model.profile.displayName} identity rack` : undefined}
        className="lattice-production-identity-dossier__source-summary" disabled={!compact} onClick={requestOpen}
        ref={compactControlRef} tabIndex={compact ? 0 : -1} type="button">
        <span className="lattice-production-identity-dossier__source-copy">
          <b>{sourceIdentity?.displayName || model.profile.displayName}</b>
          <small>{sourceIdentity?.secondaryLabel || compactAddress(model.address)}</small>
        </span>
      </button>
      <div className="lattice-production-identity-dossier__frame">
      <div className="lattice-production-identity-dossier__modules" data-identity-dossier-scroll>
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return <DisclosureModule active={active}
            className="lattice-production-identity-dossier__module lattice-inspection-rack__module"
            contentClassName="lattice-production-identity-dossier__panel lattice-inspection-rack__panel"
            headerAction={inlineCloseControl && section.id === 'profile' ? <button aria-label="Close profile"
              onClick={requestClose} ref={closeRef} type="button"><X aria-hidden="true" /></button> : null}
            id={`identity-dossier-${section.id}`} key={section.id} label={section.label}
            onToggle={() => setActiveSection(section.id)}
            style={moduleTracks.get(section.id)}>
              <div>
                    {section.id === 'profile' && <ProfileSection profile={model.profile} />}
                {section.id === 'links' && <LinksSection links={model.links} />}
                {section.id === 'technical' && <TechnicalSection entries={model.technical} />}
              </div>
          </DisclosureModule>;
        })}
      </div>
    </div>
    </div>
    {!inlineCloseControl && <button
      ref={closeRef}
      className="lattice-production-identity-viewer__close-control"
      type="button"
      onClick={requestClose}
      aria-label="Close Identity Rack"
    ><span>Close profile</span><X aria-hidden="true" /></button>}
  </section>, document.body);
}
