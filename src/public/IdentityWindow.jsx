import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';
import { habitatBoundsEqual, measureRoundedHabitatBounds } from './identity/habitatBounds.js';

export default function IdentityWindow({ titleId, onClose, onHabitatChange, profileIdentity, walletConnected = false }) {
  const habitatRef = useRef(null);
  const profile = getIdentityProfileViewModel(profileIdentity, { walletConnected });

  useEffect(() => {
    const habitat = habitatRef.current;
    if (!habitat || typeof onHabitatChange !== 'function') return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrameId = 0;
    let lastBounds = null;
    const reportBounds = () => {
      animationFrameId = 0;
      const nextBounds = measureRoundedHabitatBounds(habitat);
      if (habitatBoundsEqual(lastBounds, nextBounds)) return;
      lastBounds = nextBounds;
      onHabitatChange(nextBounds, { reducedMotion });
    };
    const scheduleReport = () => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(reportBounds);
    };

    scheduleReport();
    const observer = new ResizeObserver(scheduleReport);
    observer.observe(habitat);
    window.addEventListener('resize', scheduleReport);
    window.addEventListener('orientationchange', scheduleReport);
    window.addEventListener('scroll', scheduleReport, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleReport);
      window.removeEventListener('orientationchange', scheduleReport);
      window.removeEventListener('scroll', scheduleReport, true);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      onHabitatChange(null, { reducedMotion });
    };
  }, [onHabitatChange]);

  return (
    <article className="identity-habitat">
      <header className="identity-habitat__header">
        <p>Identity</p>
        <button type="button" onClick={onClose} aria-label="Close Identity">
          <X aria-hidden="true" />
        </button>
      </header>

      <section className="identity-habitat__resident" ref={habitatRef} aria-label="Resident habitat">
        <p>The resident remains live within this temporary habitat.</p>
      </section>

      <section className="identity-profile__identity">
        <p className="identity-profile__eyebrow">Known as</p>
        <h2 id={titleId}>{profile.name}</h2>
        <p className="identity-profile__address">{profile.address}</p>
        {profile.bio && <p className="identity-profile__description">{profile.bio}</p>}

        <ul className="identity-profile__tags" aria-label="Profile tags">
          {profile.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      </section>

      <section className="identity-profile__social" aria-label="Social information">
        <p className="identity-profile__section-label">Connections</p>
        <dl className="identity-profile__stats">
          <div><dd>{profile.metadataStatusLabel}</dd><dt>Profile metadata</dt></div>
          <div><dd>{profile.walletConnected ? 'Connected' : 'Not connected'}</dd><dt>Visitor wallet</dt></div>
        </dl>
      </section>

      <section className="identity-profile__actions" aria-label="Profile actions">
        {profile.links.map((link) => (
          <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
        ))}
      </section>
    </article>
  );
}
