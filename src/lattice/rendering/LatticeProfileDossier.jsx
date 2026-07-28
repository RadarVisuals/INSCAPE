import { useEffect, useRef, useState } from 'react';
import { Copy, Share2, X } from 'lucide-react';
import { selectPublicProfilePresentation } from '../domain/latticePublicProfilePresentation.js';
import './latticeProfileArchiveDossier.css';

function DossierPortrait({ shape, src }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span className="lattice-profile-archive__portrait-fallback" aria-hidden="true">—</span>;
  return <img alt="" draggable="false" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={src} data-shape={shape} />;
}

const resolvedCount = (value) => Number.isSafeInteger(value) && value >= 0 ? String(value) : '—';

export default function LatticeProfileDossier({
  open = false,
  presentation,
  onCopyAddress,
  onRequestClose,
  onShare,
}) {
  const closeRef = useRef(null);
  const profile = selectPublicProfilePresentation(presentation);
  const officialHandle = profile.official.handle
    ? `@${profile.official.handle.replace(/^@/u, '')}`
    : '—';
  const verification = profile.official.verified === null
    ? '—'
    : profile.official.verified
      ? 'VERIFIED UP'
      : 'UNVERIFIED';
  const classification = profile.resolved ? 'UNIVERSAL PROFILE' : 'IDENTITY UNRESOLVED';
  const dossierId = profile.residentCode ? `IU-UP-${profile.residentCode}` : 'UNRESOLVED';

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onRequestClose?.();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [onRequestClose, open]);

  return (
    <section
      aria-hidden={!open}
      aria-labelledby="lattice-profile-dossier-title"
      aria-modal="false"
      className="lattice-profile-dossier-layer"
      data-open={open || undefined}
      id="lattice-profile-dossier"
      inert={!open ? '' : undefined}
      role="dialog"
    >
      <article className="lattice-profile-archive" data-resolved={profile.resolved || undefined}>
        <button aria-label="Close public profile dossier" className="lattice-profile-archive__close" onClick={onRequestClose} ref={closeRef} type="button"><X aria-hidden="true" size={15} /></button>

        <header className="lattice-profile-archive__header">
          <span>+ &nbsp; INSCAPE / UNIVERSAL PROFILES ARCHIVE</span>
          <b>[ {dossierId} ]</b>
          <span>DOSSIER / PAPER</span>
        </header>

        <div className="lattice-profile-archive__body">
          <section className="lattice-profile-archive__emblem">
            <header><small>EMBLEM ID</small><strong>{profile.residentCode ? `IU-UP-${profile.residentCode}` : 'IU-UP-—'}</strong></header>
            <div className="lattice-profile-archive__portrait" data-shape={profile.overlay.avatar.shape}>
              <i>+</i><i>+</i>
              <DossierPortrait shape={profile.overlay.avatar.shape} src={profile.avatarUrl} />
              <span>PUBLIC IDENTITY</span>
            </div>
            <footer>
              <span><small>STATUS</small>{profile.resolved ? 'RESOLVED' : 'UNRESOLVED'}</span>
              <span><small>CLEARANCE</small>{verification}</span>
            </footer>
          </section>

          <section className="lattice-profile-archive__profile">
            <div className="lattice-profile-archive__title">
              <small>{profile.overlay.alias ? 'ALSO KNOWN AS' : 'PUBLIC IDENTITY'}</small>
              <h2 id="lattice-profile-dossier-title"><span>{profile.displayName || 'UNRESOLVED'}</span>{profile.residentCode && <em>#{profile.residentCode}</em>}</h2>
              <p>{officialHandle}</p>
            </div>
            <div className="lattice-profile-archive__classification"><i /> {classification} <span /></div>
            <p className="lattice-profile-archive__bio">{profile.bioHidden ? 'BIO HIDDEN' : profile.bio || '—'}</p>
            <div className="lattice-profile-archive__tags" aria-label="Public profile tags">
              {profile.tags.length ? profile.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>—</span>}
            </div>
            <div className="lattice-profile-archive__stats">
              <span><small>ASSETS</small><strong>{resolvedCount(profile.counts.assets)}</strong></span>
              <span><small>COLLECTIONS</small><strong>{resolvedCount(profile.counts.collections)}</strong></span>
              <span><small>NETWORK</small><strong>{profile.official.network || '—'}</strong></span>
            </div>
            <footer>
              <span>
                <small>PROFILE URL</small>
                <b>{profile.workspaceUrl || 'UNRESOLVED'}</b>
                <em>PROFILE ADDRESS / {profile.compactAddress || '—'}</em>
                <button aria-label="Copy complete profile address" disabled={!profile.official.address || !onCopyAddress} onClick={() => onCopyAddress?.(profile.official.address)} title={profile.official.address || undefined} type="button"><Copy aria-hidden="true" size={12} /></button>
              </span>
              <button disabled={!profile.workspaceUrl || !onShare} onClick={() => onShare?.(profile.workspaceUrl)} type="button">SHARE PROFILE <Share2 aria-hidden="true" size={14} strokeWidth={1.25} /></button>
            </footer>
          </section>
        </div>

        <footer className="lattice-profile-archive__footer">
          <span>+ &nbsp; INSCAPE PROTOCOL</span>
          <span>IDENTITY FILE</span>
          <span>PUBLIC PROJECTION &nbsp; +</span>
        </footer>
      </article>
    </section>
  );
}
