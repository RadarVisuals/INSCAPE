import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';

function getReducedMotionPreference() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const IdentityDossier = forwardRef(function IdentityDossier({
  actorId,
  profileIdentity,
  profileAddress,
  walletConnected,
  residentHandoff,
  dragHandleProps,
  dragEnabled,
  onTransitionStateChange,
  onClose
}, ref) {
  const rootRef = useRef(null);
  const mountedRef = useRef(true);
  const closingRef = useRef(false);
  const completedRef = useRef(false);
  const [phase, setPhase] = useState('approaching');
  const [entryEdge, setEntryEdge] = useState('top');
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const changePhase = useCallback((nextPhase) => {
    if (!mountedRef.current) return;
    setPhase(nextPhase);
    onTransitionStateChange(nextPhase);
  }, [onTransitionStateChange]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    changePhase('exiting');
    const bounds = rootRef.current?.getBoundingClientRect();
    const finish = () => {
      if (!mountedRef.current) return;
      completedRef.current = true;
      onClose();
    };

    if (!bounds || !residentHandoff?.exit) {
      finish();
      return;
    }
    const nextEntryEdge = residentHandoff.exit(bounds, {
      reducedMotion: getReducedMotionPreference(),
      onComplete: finish
    });
    if (nextEntryEdge) setEntryEdge(nextEntryEdge);
  }, [changePhase, onClose, residentHandoff]);

  const updateEntryBounds = useCallback(() => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const nextEntryEdge = residentHandoff?.updateBounds?.(bounds);
    if (nextEntryEdge) setEntryEdge(nextEntryEdge);
    return nextEntryEdge;
  }, [residentHandoff]);

  useImperativeHandle(ref, () => ({ requestClose, updateEntryBounds }), [requestClose, updateEntryBounds]);

  useEffect(() => {
    mountedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (!bounds || !residentHandoff?.start) {
        changePhase('open');
        return;
      }
      const nextEntryEdge = residentHandoff.start(bounds, {
        reducedMotion: getReducedMotionPreference(),
        onEntering: () => changePhase('entering'),
        onEntered: () => changePhase('open')
      });
      if (nextEntryEdge) setEntryEdge(nextEntryEdge);
    });

    return () => {
      mountedRef.current = false;
      window.cancelAnimationFrame(frame);
      if (!completedRef.current) residentHandoff?.cancel?.();
    };
  }, [changePhase, residentHandoff]);

  useEffect(() => {
    if (phase !== 'open') return;
    const bounds = rootRef.current?.getBoundingClientRect();
    if (bounds) residentHandoff?.updateBounds?.(bounds);
  }, [phase, residentHandoff]);

  const profile = getIdentityProfileViewModel(profileIdentity, { walletConnected });
  const displayName = profile.name;
  const displayAddress = profile.displayAddress;
  const officialProfileLink = profile.links.find((link) => link.primary);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const phaseMessage = {
    approaching: 'Actor approaching Profile Card',
    entering: 'Actor entering Profile Card',
    exiting: 'Actor leaving Profile Card'
  }[phase] ?? '';

  return (
    <article className="identity-dossier" data-phase={phase} data-entry-edge={entryEdge} ref={rootRef}>
      <header className="identity-dossier__header" data-window-titlebar="identity-panel">
        <div
          className="identity-dossier__drag-handle"
          data-enabled={dragEnabled || undefined}
          aria-label={dragEnabled ? 'Drag Profile Card module' : undefined}
          {...dragHandleProps}
        >
          <p>Profile</p>
        </div>
        <p className="identity-dossier__transition" role="status" aria-live="polite">{phaseMessage}</p>
        <button className="identity-dossier__close" type="button" onClick={requestClose} aria-label="Close Profile Card">
          <span aria-hidden="true">&times;</span>
        </button>
      </header>

      <section className="identity-dossier__identity" aria-labelledby="identity-title">
        <figure className="identity-avatar" data-ready={avatarLoaded || undefined} data-failed={avatarFailed || undefined}>
          {profile.avatarUrl && !avatarFailed && (
            <img
              src={profile.avatarUrl}
              alt={`Avatar for ${displayName}`}
              draggable="false"
              onLoad={() => setAvatarLoaded(true)}
              onError={() => setAvatarFailed(true)}
            />
          )}
          {(!profile.avatarUrl || avatarFailed) && <span className="identity-avatar__fallback" aria-hidden="true">{initials}</span>}
        </figure>

        <div className="identity-dossier__profile">
          <p className="identity-dossier__eyebrow">Profile being visited</p>
          <h2 id="identity-title">{displayName}</h2>
          <p className="identity-dossier__address" title={profileAddress}>{displayAddress}</p>
        </div>

        <div className="identity-dossier__states" aria-label="Profile and wallet status">
          <p className="identity-dossier__connection" data-connected={profile.metadataResolved || undefined}>
            <span aria-hidden="true" />{profile.metadataStatusLabel}
          </p>
          <p className="identity-dossier__connection" data-connected={profile.walletConnected || undefined}>
            <span aria-hidden="true" />{profile.walletConnected ? 'Wallet connected' : 'Wallet not connected'}
          </p>
        </div>
      </section>

      <section className="identity-dossier__metadata">
        {profile.bio && <p className="identity-dossier__bio">{profile.bio}</p>}
        <dl className="identity-dossier__stats">
          <div><dt>Metadata</dt><dd>{profile.metadataResolved ? 'Available' : 'Unavailable'}</dd></div>
          <div><dt>Wallet</dt><dd>{profile.walletConnected ? 'Connected' : 'Not connected'}</dd></div>
          <div><dt>Resident</dt><dd>{actorId?.replaceAll('_', ' ') || 'None'}</dd></div>
        </dl>
        {profile.tags.length > 0 && (
          <ul className="identity-dossier__tags" aria-label="Profile tags">
            {profile.tags.map((tag, index) => <li key={`${tag}-${index}`}>{tag}</li>)}
          </ul>
        )}
        {profile.links.length > 0 && (
          <nav className="identity-dossier__links" aria-label="External profile links">
            <span className="identity-dossier__links-label">Linked</span>
            {profile.links.map((link) => (
            <a
              href={link.url}
              key={link.id}
              data-primary={link.primary || undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
            >
              <span aria-hidden="true">↗</span>
              <strong>{link.label}</strong>
            </a>
            ))}
          </nav>
        )}
      </section>

      <section className="identity-dossier__actions" aria-label="Profile actions">
        {officialProfileLink && (
          <a href={officialProfileLink.url} target="_blank" rel="noopener noreferrer">View Universal Profile</a>
        )}
      </section>
    </article>
  );
});

export default IdentityDossier;
