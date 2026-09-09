import { ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { identityDossierViewerLayout } from '../../lattice/rendering/identityDossierViewerLayout.js';
import './ownerShellSystemIdentityDossier.css';

const TRANSITION_MS = 420;
const MODULE_HEADER_HEIGHT = 53;
const PROFILE_HEADER_HEIGHT = 92;
const MODULE_GAP = 5;
const MODULES = Object.freeze(['profile', 'links', 'technical']);
const MODULE_COLLAPSED_HEIGHTS = Object.freeze({
  links: MODULE_HEADER_HEIGHT,
  profile: PROFILE_HEADER_HEIGHT,
  technical: MODULE_HEADER_HEIGHT,
});
const SHELL_DOCK_HEIGHT = 52;

const initials = (name) => String(name || 'PROFILE').split(/\s+/u).filter(Boolean)
  .slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const compactAddress = (address) => String(address || '').length > 18
  ? `${String(address).slice(0, 10)}…${String(address).slice(-6)}` : String(address || '');

function ModuleHeader({ active, label, onClick }) {
  return <button aria-expanded={active} className="owner-shell-system-identity__module-header" onClick={onClick} type="button">
    <i aria-hidden="true" /><strong>{label}</strong>
  </button>;
}

function ProfileBody({ model }) {
  return <div className="owner-shell-system-identity__profile-body">
    <small>DESCRIPTION</small>
    <p>{model.profile.description || 'NO PROFILE DESCRIPTION AUTHORED'}</p>
    {model.profile.tags.length > 0 && <ul>{model.profile.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
    <footer>SOURCE / {model.profile.nameProvenance === 'LSP3_NAME' ? 'UNIVERSAL PROFILE' : 'INSCAPE PROFILE'}</footer>
  </div>;
}

function LinksBody({ links }) {
  return <div className="owner-shell-system-identity__list-body">
    {links.length ? <ol>{links.map((link) => <li key={link.id}><a href={link.url} rel="noreferrer" target="_blank">
      <span><strong>{link.label}</strong><small>{link.url}</small></span><ExternalLink aria-hidden="true" />
    </a></li>)}</ol> : <p>NO VISIBLE PROFILE LINKS</p>}
  </div>;
}

function TechnicalBody({ entries }) {
  return <div className="owner-shell-system-identity__technical-body"><dl>{entries.map((entry) => <div key={entry.id}>
    <dt>{entry.label}</dt><dd>{entry.value}</dd><small>{entry.provenance.replaceAll('_', ' ')}</small>
  </div>)}</dl></div>;
}

export default function OwnerShellSystemIdentityDossier({
  getReturnRectangle,
  menuSurfaceId,
  model,
  onClosed,
  originRectangle,
  returnFocus,
  sourceIdentity,
  viewport,
}) {
  const rootRef = useRef(null);
  const rackRef = useRef(null);
  const closeRef = useRef(null);
  const settleFrameRef = useRef(null);
  const timerRef = useRef(null);
  const [activeModule, setActiveModule] = useState('profile');
  const [phase, setPhase] = useState('starting');
  const [returnRectangle, setReturnRectangle] = useState(originRectangle);
  const layout = useMemo(() => {
    const availableViewport = { ...viewport, height: Math.max(1, viewport.height - SHELL_DOCK_HEIGHT) };
    return identityDossierViewerLayout(originRectangle, availableViewport);
  }, [originRectangle, viewport]);
  const rackRectangle = phase === 'starting' ? originRectangle : phase === 'closing' ? returnRectangle : layout.rack;
  const collapsedHeight = MODULES.reduce((total, id) => total + MODULE_COLLAPSED_HEIGHTS[id], 0);
  const expandedHeight = Math.max(MODULE_HEADER_HEIGHT, layout.rack.height
    - collapsedHeight + MODULE_COLLAPSED_HEIGHTS[activeModule] - ((MODULES.length - 1) * MODULE_GAP));
  let moduleTop = 0;
  const tracks = new Map(MODULES.map((id) => {
    const active = id === activeModule;
    const track = { height: active ? expandedHeight : MODULE_COLLAPSED_HEIGHTS[id], top: moduleTop };
    moduleTop += track.height + MODULE_GAP;
    return [id, track];
  }));
  const returning = phase === 'starting' || phase === 'closing';

  useLayoutEffect(() => {
    rootRef.current?.getBoundingClientRect();
    const frame = requestAnimationFrame(() => setPhase('opening'));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (phase === 'opening') timerRef.current = setTimeout(() => setPhase('open'), TRANSITION_MS);
    if (phase === 'closing') timerRef.current = setTimeout(() => {
      settleFrameRef.current = requestAnimationFrame(() => {
        settleFrameRef.current = requestAnimationFrame(() => onClosed?.());
      });
    }, TRANSITION_MS);
    return () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(settleFrameRef.current);
    };
  }, [onClosed, phase]);

  useEffect(() => {
    if (phase === 'open') closeRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current?.click();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => {
      window.removeEventListener('keydown', closeOnEscape, true);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [returnFocus]);

  const requestClose = useCallback(() => {
    if (phase !== 'open') return;
    const liveRectangle = getReturnRectangle?.();
    if (liveRectangle) setReturnRectangle(liveRectangle);
    setActiveModule('profile');
    setPhase('closing');
  }, [getReturnRectangle, phase]);

  useEffect(() => {
    if (phase !== 'open' && phase !== 'closing') return undefined;
    const handleOutsideInteraction = (event) => {
      if (rackRef.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (phase === 'open') requestClose();
    };
    window.addEventListener('pointerdown', handleOutsideInteraction, true);
    window.addEventListener('click', handleOutsideInteraction, true);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideInteraction, true);
      window.removeEventListener('click', handleOutsideInteraction, true);
    };
  }, [phase, requestClose]);

  const profileTrack = returning
    ? { height: rackRectangle.height, top: 0 }
    : tracks.get('profile');
  const hiddenTrack = { height: MODULE_HEADER_HEIGHT, top: rackRectangle.height + MODULE_GAP };

  return createPortal(<section
    aria-label={`${model.profile.displayName} identity rack`}
    aria-modal="true"
    className="owner-shell-system-identity"
    data-lattice-menu-surface
    data-menu-surface={menuSurfaceId}
    data-phase={phase}
    onPointerDown={(event) => { if (phase === 'open' && event.target === event.currentTarget) requestClose(); }}
    ref={rootRef}
    role="dialog"
  >
    <div aria-hidden="true" className="owner-shell-system-identity__veil" />
    <div className="owner-shell-system-identity__rack-viewport">
      <div className="owner-shell-system-identity__rack" ref={rackRef} style={{
        '--owner-shell-system-identity-expanded-width': `${layout.rack.width}px`,
        height: rackRectangle.height, left: rackRectangle.left, top: rackRectangle.top, width: rackRectangle.width,
      }}>
        <section className="owner-shell-system-identity__module is-profile" data-active={activeModule === 'profile' || undefined} style={profileTrack}>
          <button aria-expanded={activeModule === 'profile'} className="owner-shell-system-identity__lead" onClick={() => setActiveModule('profile')} type="button">
            <span className="owner-shell-system-identity__avatar">{initials(sourceIdentity?.displayName || model.profile.displayName)}</span>
            <span><small>PROFILE IDENTITY</small><strong>{sourceIdentity?.displayName || model.profile.displayName}</strong>
              <code>{sourceIdentity?.secondaryLabel || compactAddress(model.address)}</code></span>
          </button>
          <button aria-label="Close profile" className="owner-shell-system-identity__close" onClick={requestClose} ref={closeRef} type="button"><X aria-hidden="true" /></button>
          <div className="owner-shell-system-identity__panel is-profile-panel" inert={activeModule !== 'profile' ? '' : undefined}><ProfileBody model={model} /></div>
        </section>
        <section className="owner-shell-system-identity__module" data-active={activeModule === 'links' || undefined} style={returning ? hiddenTrack : tracks.get('links')}>
          <ModuleHeader active={activeModule === 'links'} label="LINK MODULE" onClick={() => setActiveModule('links')} />
          <div className="owner-shell-system-identity__panel" inert={activeModule !== 'links' ? '' : undefined}><LinksBody links={model.links} /></div>
        </section>
        <section className="owner-shell-system-identity__module" data-active={activeModule === 'technical' || undefined} style={returning ? hiddenTrack : tracks.get('technical')}>
          <ModuleHeader active={activeModule === 'technical'} label="TECHNICAL MODULE" onClick={() => setActiveModule('technical')} />
          <div className="owner-shell-system-identity__panel" inert={activeModule !== 'technical' ? '' : undefined}><TechnicalBody entries={model.technical} /></div>
        </section>
      </div>
    </div>
  </section>, document.body);
}
