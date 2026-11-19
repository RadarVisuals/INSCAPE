import { useState } from 'react';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { ChevronDown, Link2, UserRound } from 'lucide-react';
import LibraryArtworkImage from '../../public/ownerSystemWorkflow/LibraryArtworkImage.jsx';
import VisitorMenu from './VisitorMenu.jsx';

export function VisitorPortrait({ src, name = '', className }) {
  const [failedSource, setFailedSource] = useState(null);
  return <span className={className}>
    {src && src !== failedSource ? <LibraryArtworkImage src={src} alt={name} onError={() => setFailedSource(src)} />
      : <UserRound aria-hidden="true" />}
  </span>;
}

export default function VisitorProfile({ model, layout, onLayoutChange }) {
  useStartupDestinationReady();
  const { officialProfile, authoredProfile, profile } = model;
  const paragraphs = (profile.description || '').split(/\n\s*\n/u).map(p => p.trim()).filter(Boolean);
  const contacts = model.links.filter(link => link.kind === 'AUTHORED');
  return <main tabIndex={-1} data-published-focus-fallback className="visitor-spread" data-layout={layout} aria-labelledby="visitor-name">
    <div className="visitor-profile-stage">
      <div className="visitor-profile-index"><VisitorMenu name="Profile index" trigger={<>Index <ChevronDown size={12} /></>}>
        <button type="button" aria-pressed={layout === 'card'} onClick={() => onLayoutChange('card')}>Profile Card</button>
        <button type="button" aria-pressed={layout === 'open'} onClick={() => onLayoutChange('open')}>Open Spread</button>
      </VisitorMenu></div>
      <div className="visitor-profile-body">
        <VisitorPortrait src={profile.avatarUrl} className="visitor-portrait" name={officialProfile.name} />
        <section className="visitor-copy">
          <header><h1 id="visitor-name">{officialProfile.name}</h1>{authoredProfile.title && <p className="visitor-role">{authoredProfile.title}</p>}</header>
          {paragraphs.length > 0 && <div className="visitor-statement">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>}
          {profile.tags.length > 0 && <ul className="visitor-tags" aria-label="Disciplines">{profile.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
          {contacts.length > 0 && <nav className="visitor-contacts" aria-label="Profile links">{contacts.map(link =>
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{layout === 'card' && <Link2 size={13} aria-hidden="true" />}{link.label}</a>)}</nav>}
        </section>
      </div>
    </div>
  </main>;
}
