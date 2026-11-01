import { BadgeCheck, ChevronDown, Github, Globe, Instagram, UserRound, Youtube } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import IdentityPortrait from './IdentityPortrait.jsx';
import { IdentityFields, IdentityProfileEditor } from './IdentityCardSettings.jsx';
function ProfileSection({ profile }) {
  const paragraphs = String(profile.description || '').split(/\n{2,}/u).filter(Boolean);
  return <div>
    {profile.profileImageTokenReference && !profile.avatarUrl && <p>
      TOKEN-BACKED PROFILE IMAGE / REFERENCE RETAINED / MEDIA UNRESOLVED
    </p>}
    {paragraphs.length > 0
      ? <div>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      : null}
    {profile.tags.length > 0 && <ul aria-label="Profile tags">
      {profile.tags.map((tag) => <li key={tag}>{tag}</li>)}
    </ul>}
  </div>;
}

function LinksSection({ links }) {
  const platform = url => {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      return ({ 'x.com': 'x', 'twitter.com': 'x', 'github.com': 'github', 'instagram.com': 'instagram', 'youtube.com': 'youtube', 'youtu.be': 'youtube' })[host] || 'web';
    } catch { return 'web'; }
  };
  const entries = links.map(link => ({ ...link, platform: platform(link.url) }));
  const icons = { github: Github, instagram: Instagram, youtube: Youtube, web: Globe };
  return <nav className="identity-module__links" aria-label="Profile links"><ol>{entries.map(link => {
    const Icon = icons[link.platform];
    return <li key={link.id}><a href={link.url} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label}>
      {Icon ? <Icon aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.9-9L2 2h6.5l4.4 6.8L18.9 2ZM17.8 20h1.7L7.5 4H5.7l12.1 16Z" /></svg>}
    </a></li>;
  })}</ol></nav>;
}


// One card presentation for canvas and reception. The host owns expansion;
// authoring remains an explicit editor input, absent from public reception.
export default function IdentityCardBody({ model, card, portraitUrl, portraitRef, interactive = true,
  expanded, onExpandedChange, expansionControls, edit = null, children }) {
  const extensionId = useId();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [portraitUrl]);
  const official = model.officialProfile || { name: model.profile.displayName, description: model.profile.description, tags: model.profile.tags };
  const authored = model.authoredProfile;
  const designation = model.designation && <span className="identity-module__designation" title={model.designation.title}
    aria-label={model.designation.title}><BadgeCheck aria-hidden="true" />{model.designation.label}</span>;
  return <div className="identity-module__card">
    <div className="identity-module__intro">
      <div className="identity-module__portrait" ref={portraitRef} aria-label="Identity artwork">
        {portraitUrl && !imageFailed ? <IdentityPortrait key={model.address + ':' + portraitUrl} src={portraitUrl}
          interactive={interactive} title={official.name + ' — Identity artwork'} onError={() => setImageFailed(true)} /> : <UserRound />}
        {imageFailed && <span className="identity-module__drop-hint">Artwork unavailable</span>}
      </div>
      <div className="identity-module__story">
        {edit ? <IdentityProfileEditor edit={edit} official={official}>{designation}</IdentityProfileEditor> : <>
          {authored?.title && <p className="identity-module__custom-title">{authored.title}</p>}
          <h2>{official.name}</h2>{designation}
          <ProfileSection profile={{ ...official, description: authored?.description || official.description,
            tags: [...new Set([...(official.tags || []), ...(authored?.tags || [])])] }} />
        </>}
        <LinksSection links={model.links.filter(link => !['inscape-profile', 'universal-everything', 'explorer'].includes(link.id))} />
      </div>
      {expansionControls === undefined ? <button className="identity-module__expand" type="button" aria-expanded={expanded} aria-controls={extensionId}
        aria-label={expanded ? 'Collapse INSCAPE details' : 'Expand INSCAPE details'} onClick={() => onExpandedChange(!expanded)}>
        <ChevronDown aria-hidden="true" />
      </button> : expansionControls}
    </div>
    <div id={extensionId} className="identity-module__extension" hidden={!expanded}>
      <IdentityFields card={card} edit={edit} />{children}
    </div>
  </div>;
}
