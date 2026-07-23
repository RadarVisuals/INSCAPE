import { useEffect, useMemo, useRef, useState } from 'react';
import {
  identityCode,
  PROFILE_IDENTITY_CARD_STATE,
  selectProfileCardLinks,
  transitionProfileIdentityCard
} from './profileIdentityCardModel.js';
import './profileIdentityCard.css';

const SAFE_NETWORK_LABEL = 'LUKSO MAINNET';

function Avatar({ src }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span className="profile-identity-card__avatar-fallback" aria-hidden="true">UP</span>;
  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export default function ProfileIdentityCard({ profile, expanded: controlledExpanded, initialExpanded = false, collapseToAvatar = false, onExpandedChange, onStateChange }) {
  const [state, setState] = useState((controlledExpanded ?? initialExpanded) ? PROFILE_IDENTITY_CARD_STATE.EXPANDED : PROFILE_IDENTITY_CARD_STATE.AVATAR);
  const stateRef = useRef(state);
  const onStateChangeRef = useRef(onStateChange);
  const onExpandedChangeRef = useRef(onExpandedChange);
  onStateChangeRef.current = onStateChange;
  onExpandedChangeRef.current = onExpandedChange;
  stateRef.current = state;
  const code = identityCode(profile?.address);
  const name = profile?.name || 'Unnamed profile';
  const links = useMemo(() => selectProfileCardLinks(profile?.links), [profile?.links]);
  const socialLinks = links.slice(0, Math.min(2, links.length));
  const linkedLinks = links.slice(2);
  const tags = Array.isArray(profile?.tags) ? profile.tags.filter(Boolean).slice(0, 3) : [];
  const expanded = state === PROFILE_IDENTITY_CARD_STATE.EXPANDED;
  const compact = state !== PROFILE_IDENTITY_CARD_STATE.AVATAR;
  const avatarActionLabel = state === PROFILE_IDENTITY_CARD_STATE.AVATAR
    ? 'Reveal profile identity'
    : state === PROFILE_IDENTITY_CARD_STATE.COMPACT
      ? 'Expand profile details'
      : 'Collapse profile to avatar';

  useEffect(() => {
    onStateChangeRef.current?.(state);
  }, [state]);

  useEffect(() => {
    if (typeof controlledExpanded !== 'boolean') return;
    setState((current) => {
      if (controlledExpanded) return PROFILE_IDENTITY_CARD_STATE.EXPANDED;
      return current === PROFILE_IDENTITY_CARD_STATE.EXPANDED ? PROFILE_IDENTITY_CARD_STATE.AVATAR : current;
    });
  }, [controlledExpanded]);

  useEffect(() => {
    if (!collapseToAvatar) return;
    if (stateRef.current === PROFILE_IDENTITY_CARD_STATE.EXPANDED) onExpandedChangeRef.current?.(false);
    setState(PROFILE_IDENTITY_CARD_STATE.AVATAR);
  }, [collapseToAvatar]);

  const transition = (action) => {
    setState((current) => {
      const next = transitionProfileIdentityCard(current, action);
      if ((current === PROFILE_IDENTITY_CARD_STATE.EXPANDED) !== (next === PROFILE_IDENTITY_CARD_STATE.EXPANDED)) {
        onExpandedChange?.(next === PROFILE_IDENTITY_CARD_STATE.EXPANDED);
      }
      return next;
    });
  };

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && state !== PROFILE_IDENTITY_CARD_STATE.AVATAR) transition('escape');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [state]);

  return <section
    className="profile-identity-card"
    aria-label={`${name} profile`}
    data-state={state}
    data-compact={compact || undefined}
    data-expanded={expanded || undefined}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <header>
      <button
        className="profile-identity-card__avatar"
        type="button"
        aria-expanded={expanded}
        aria-label={avatarActionLabel}
        onClick={() => transition('avatar')}
      ><Avatar src={profile?.avatarUrl} /></button>
      <span className="profile-identity-card__copy">
        <strong>{name} <i>{code}</i></strong>
        <small>{expanded ? 'UNIVERSAL PROFILE' : 'VIEW PROFILE'}</small>
      </span>
      <button
        className="profile-identity-card__toggle"
        type="button"
        aria-expanded={expanded}
        tabIndex={compact ? 0 : -1}
        aria-label={expanded ? 'Collapse profile to avatar' : 'Expand profile details'}
        onClick={() => transition('toggle')}
      >{expanded ? '×' : '›'}</button>
    </header>
    <div className="profile-identity-card__details" aria-hidden={!expanded}>
      <p>{profile?.bio || 'A world assembled beneath the surface.'}</p>
      {tags.length > 0 && <div className="profile-identity-card__tags" aria-label="Profile tags">
        {tags.map((tag) => <span key={tag}>{String(tag).toUpperCase()}</span>)}
      </div>}
      <dl>
        {socialLinks.length > 0 && <div>
          <dt>SOCIAL</dt>
          <dd className="profile-identity-card__link-group">{socialLinks.map((link) => <a key={link.id || link.url} href={link.url} target="_blank" rel="noreferrer">{link.label.toUpperCase()} ↗</a>)}</dd>
        </div>}
        {linkedLinks.length > 0 && <div>
          <dt>LINKED</dt>
          <dd className="profile-identity-card__link-group">{linkedLinks.map((link) => <a key={link.id || link.url} href={link.url} target="_blank" rel="noreferrer">{link.label.toUpperCase()} ↗</a>)}</dd>
        </div>}
        <div><dt>NETWORK</dt><dd>{SAFE_NETWORK_LABEL}</dd></div>
      </dl>
    </div>
  </section>;
}
