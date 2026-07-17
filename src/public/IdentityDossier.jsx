import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';

const profile = getIdentityProfileViewModel();

function getReducedMotionPreference() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const IdentityDossier = forwardRef(function IdentityDossier({
  avatarSrc,
  actorId,
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
  const [following, setFollowing] = useState(false);
  const [tipFeedback, setTipFeedback] = useState('');
  const [avatarLoaded, setAvatarLoaded] = useState(false);

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

  const followerCount = profile.followers + (following ? 1 : 0);
  const phaseMessage = {
    approaching: 'Actor approaching Profile Card',
    entering: 'Actor entering Profile Card',
    exiting: 'Actor leaving Profile Card'
  }[phase] ?? '';

  return (
    <article className="identity-dossier" data-phase={phase} data-entry-edge={entryEdge} ref={rootRef}>
      <header className="identity-dossier__header">
        <div
          className="identity-dossier__drag-handle"
          data-enabled={dragEnabled || undefined}
          aria-label={dragEnabled ? 'Drag Profile Card module' : undefined}
          {...dragHandleProps}
        >
          <p>Profile Card</p>
        </div>
        <p className="identity-dossier__transition" role="status" aria-live="polite">{phaseMessage}</p>
        <button className="identity-dossier__close" type="button" onClick={requestClose} aria-label="Close Profile Card">
          <span aria-hidden="true">&times;</span>
        </button>
      </header>

      <figure className="identity-avatar" data-ready={avatarLoaded || undefined}>
        <img
          src={avatarSrc}
          alt={`Avatar for ${profile.artistName}`}
          draggable="false"
          onLoad={() => setAvatarLoaded(true)}
        />
        <figcaption>{actorId?.replaceAll('_', ' ')}</figcaption>
      </figure>

      <section className="identity-dossier__profile" aria-labelledby="identity-title">
        <div className="identity-dossier__profile-heading">
          <h2 id="identity-title">{profile.artistName}</h2>
          <ul className="identity-dossier__badges" aria-label="Earned badges">
            {profile.badges.map((badge) => (
              <li key={badge.id} title={badge.label} aria-label={badge.label}>
                <span aria-hidden="true">{badge.mark}</span>
              </li>
            ))}
          </ul>
        </div>
        <ul className="identity-dossier__tags" aria-label="Profile tags">
          {profile.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
        <nav className="identity-dossier__links" aria-label="External profile links">
          <span className="identity-dossier__links-label" aria-hidden="true">Linked</span>
          {profile.links.map((link) => (
            <a
              href={`#identity-${link.id}`}
              key={link.id}
              data-primary={link.primary || undefined}
              aria-label={`${link.label} (prototype link)`}
              title={`${link.label} - prototype link`}
              onClick={(event) => event.preventDefault()}
            >
              <span aria-hidden="true">{link.mark}</span>
              {link.primary && <strong>{link.label}</strong>}
            </a>
          ))}
        </nav>
      </section>

      <section className="identity-dossier__relationship" aria-label="Profile relationship">
        <div>
          <strong>{followerCount.toLocaleString('en-US')}</strong>
          <span>Followers</span>
        </div>
        <p className="identity-dossier__connection" data-connected={profile.connected || undefined}>
          <span aria-hidden="true" />
          {profile.connected ? 'Connected' : 'Not connected'}
        </p>
      </section>

      <section className="identity-dossier__actions" aria-label="Profile actions">
        <button
          type="button"
          onClick={() => setTipFeedback('Tip is unavailable in this visual prototype.')}
          aria-describedby={tipFeedback ? 'tip-feedback' : undefined}
        >
          Tip
        </button>
        <button type="button" aria-pressed={following} onClick={() => setFollowing((current) => !current)}>
          {following ? 'Following' : 'Follow'}
        </button>
        <p id="tip-feedback" role="status">{tipFeedback}</p>
      </section>
    </article>
  );
});

export default IdentityDossier;
