import { Github, Globe, Instagram, Youtube } from 'lucide-react';

export function ProfileSection({ profile }) {
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

export function LinksSection({ links }) {
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


