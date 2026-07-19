import { useEffect, useRef, useState } from 'react';
import { useProfileIdentity } from '../../profileIdentity/index.js';
import ProfileDocumentSpaceWindow from './ProfileDocumentSpaceWindow.jsx';
import { iconGlyph } from '../../public/sceneIcons.js';
import FramedArtwork from '../../public/FramedArtwork.jsx';
import { projectDocumentAsset } from '../domain/documentProjection.js';

export default function ProfileDocumentPreview({ document, onExit }) {
  const [openSpaceId, setOpenSpaceId] = useState(() => document.spaces.find((space) => space.startOpen)?.id || null);
  const [openArtworkId, setOpenArtworkId] = useState(null);
  const artworkDialogRef = useRef(null);
  const liveIdentity = useProfileIdentity(document.profile.address);
  const cached = document.profile.cachedIdentity;
  const displayName = liveIdentity?.name || cached.name || `${document.profile.address.slice(0, 8)}…${document.profile.address.slice(-6)}`;
  const avatarUrl = liveIdentity?.avatarUrl || cached.avatarUrl;
  const openSpace = document.spaces.find((space) => space.id === openSpaceId);
  const openArtwork = document.canvasObjects.find((object) => object.id === openArtworkId);
  useEffect(() => {
    if (!openArtwork) return undefined;
    const previous = globalThis.document.activeElement;
    const frame = window.requestAnimationFrame(() => artworkDialogRef.current?.querySelector('button')?.focus());
    const close = (event) => { if (event.key === 'Escape') { event.preventDefault(); setOpenArtworkId(null); } };
    window.addEventListener('keydown', close);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('keydown', close); previous?.focus?.(); };
  }, [openArtwork]);
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
    <section className="profile-document-preview__objects" aria-label="Published canvas artwork">
      {[...document.canvasObjects].sort((a,b)=>a.order-b.order).map((object)=>{const asset=projectDocumentAsset(object.asset);return <FramedArtwork key={object.id} object={{...object,stableAssetId:object.asset.stableAssetId,visitorVisible:true,presentationOrder:object.order}} asset={asset} arranging={false} selected={false} compact={false} onActivate={()=>setOpenArtworkId(object.id)} onEdit={()=>{}} style={{left:`${object.placement.column/24*100}%`,top:`${object.placement.row/13*100}%`,width:`${object.span.columns/24*100}%`,height:`${object.span.rows/13*100}%`,zIndex:10+object.order}} />;})}
    </section>
    {openSpace && <section className="module-shell module-shell--expanded module-shell--collection module-shell--folder profile-document-preview__window"><ProfileDocumentSpaceWindow space={openSpace} onClose={() => setOpenSpaceId(null)} /></section>}
    {openArtwork && (()=>{const asset=projectDocumentAsset(openArtwork.asset);return <section ref={artworkDialogRef} className="profile-document-preview__artwork" role="dialog" aria-modal="true" aria-label={`Artwork preview: ${asset.name}`}><header><strong>{asset.name}</strong><button type="button" onClick={()=>setOpenArtworkId(null)} aria-label="Close artwork preview">×</button></header>{asset.imageUrl?<img src={asset.imageUrl} alt={asset.name}/>:<p>Artwork unavailable</p>}</section>;})()}
  </main>;
}
