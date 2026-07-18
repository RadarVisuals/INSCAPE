import { useState } from 'react';
import { useProfileIdentity } from '../../profileIdentity/index.js';
import ProfileDocumentSpaceWindow from './ProfileDocumentSpaceWindow.jsx';
import { iconGlyph } from '../../public/sceneIcons.js';

export default function ProfileDocumentPreview({ document, onExit }) {
  const [openSpaceId, setOpenSpaceId] = useState(() => document.spaces.find((space) => space.startOpen)?.id || null);
  const liveIdentity = useProfileIdentity(document.profile.address);
  const cached = document.profile.cachedIdentity;
  const displayName = liveIdentity?.name || cached.name || `${document.profile.address.slice(0, 8)}…${document.profile.address.slice(-6)}`;
  const avatarUrl = liveIdentity?.avatarUrl || cached.avatarUrl;
  const openSpace = document.spaces.find((space) => space.id === openSpaceId);
  return <main className="public-shell profile-document-preview" data-preview-mode="visitor" data-interface-visible aria-label="Profile document visitor preview">
    <header className="public-shell__masthead profile-document-preview__header"><div className="system-hud__identity">
      <h1>[ <span className="system-hud__brand-accent">VISITOR PREVIEW</span> ]</h1>
      <span className="system-hud__operator">{displayName}</span><span className="system-hud__live"><i aria-hidden="true" />Document v{document.version}</span>
    </div><nav className="system-hud__commands"><button type="button" onClick={onExit}>[ Exit Preview ]</button></nav></header>
    <section className="profile-document-preview__identity" aria-label="Public profile identity">
      {avatarUrl ? <img src={avatarUrl} alt="" /> : <span aria-hidden="true">UP</span>}<div><strong>{displayName}</strong><small>{document.profile.address}</small></div>
    </section>
    <section className="profile-document-preview__spaces" aria-label="Published Canvas Spaces">
      {[...document.spaces].sort((a, b) => a.order - b.order).map((space) => { const appearance=space.appearance||{mode:'label',iconKey:space.kind==='favorites'?'favorites':'folder',showLabel:true,columnSpan:3,rowSpan:1}; return <button data-appearance={appearance.mode} key={space.id} type="button" style={{ '--space-column': space.placement?.column ?? 0, '--space-row': space.placement?.row ?? space.order, '--space-columns':appearance.columnSpan,'--space-rows':appearance.rowSpan }} onClick={() => setOpenSpaceId(space.id)} aria-expanded={openSpaceId === space.id} aria-label={`Open ${space.label}, ${space.assets.length} assets`}>
        {appearance.mode !== 'label' && <b aria-hidden="true">{iconGlyph(appearance.iconKey)}</b>}{appearance.showLabel && <span>{space.label}</span>}{appearance.mode !== 'icon' && <small>{space.assets.length} assets</small>}
      </button>; })}
    </section>
    {openSpace && <section className="module-shell module-shell--expanded module-shell--collection module-shell--folder profile-document-preview__window"><ProfileDocumentSpaceWindow space={openSpace} onClose={() => setOpenSpaceId(null)} /></section>}
  </main>;
}
