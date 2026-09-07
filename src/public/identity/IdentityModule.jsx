import { ArrowUpRight, Check, ChevronDown, Copy, ExternalLink, Github, Globe, Instagram, QrCode, UserRound, X, Youtube } from 'lucide-react';
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { WorkbenchWindow } from '../ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { isValidPlacementMedia } from '../../systemWorkflow/domain/placementMedia.js';
import IdentityClouds from './IdentityClouds.jsx';
import IdentityCardSettings from './IdentityCardSettings.jsx';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import '../ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../ownerSystemWorkflow/displayInstruments.css';
import './identityModule.css';

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
    const showName = link.platform === 'web' || entries.filter(entry => entry.platform === link.platform).length > 1;
    return <li key={link.id}><a href={link.url} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label}>
      {Icon ? <Icon aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.9-9L2 2h6.5l4.4 6.8L18.9 2ZM17.8 20h1.7L7.5 4H5.7l12.1 16Z" /></svg>}
      {showName && <span>{link.label}</span>}
      <span className="identity-module__link-tooltip">{link.label}</span>
    </a></li>;
  })}</ol></nav>;
}

function AddressQr({ address }) {
  const id = useId();
  const popover = useRef(null);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = popover.current;
    const toggle = event => setOpen(event.newState === 'open');
    node.addEventListener('toggle', toggle);
    return () => node.removeEventListener('toggle', toggle);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setImage(null); setFailed(false);
    import('qrcode-generator').then(({ default: createQr }) => {
      const qr = createQr(0, 'M');
      qr.addData(address); qr.make();
      if (active) setImage(qr.createDataURL(6));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [open, address]);
  return <>
    <button className="identity-module__header-action" type="button" popovertarget={id}
      aria-label="Show address QR code" aria-expanded={open} title="Show address QR code"><QrCode aria-hidden="true" /></button>
    <div ref={popover} id={id} popover="auto" className="identity-module__qr" role="dialog" aria-label="Share profile address"
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
      <div className="identity-module__qr-heading"><strong>Share profile address</strong>
        <button className="identity-module__header-action" type="button" popovertarget={id} popovertargetaction="hide" aria-label="Close QR code"><X /></button></div>
      {image ? <img draggable={false} src={image} alt="QR code containing the full Universal Profile address" />
        : <p role="status">{failed ? 'QR unavailable. Use the copy button.' : 'Creating QR…'}</p>}
      <code>{address}</code>
    </div>
  </>;
}

function IdentityTitle({ address, profile }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const request = useRef(0);
  useEffect(() => { setAvatarFailed(false); }, [profile.avatarUrl]);
  useEffect(() => {
    setCopied(false); setFailed(false);
    return () => { request.current++; };
  }, [address]);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copyAddress = async () => {
    const current = ++request.current;
    try {
      await navigator.clipboard.writeText(address);
      if (request.current === current) { setCopied(true); setFailed(false); }
    } catch { if (request.current === current) { setCopied(false); setFailed(true); } }
  };
  return <div className="identity-module__title">
    <span className="identity-module__title-avatar">{profile.avatarUrl && !avatarFailed
      ? <img alt="" src={profile.avatarUrl} onError={() => setAvatarFailed(true)} /> : <UserRound aria-hidden="true" />}</span>
    <span className="identity-module__title-name" title={profile.name}>{profile.name}</span>
    <span className="identity-module__identifier">#{address.slice(2, 6)}</span>
    <span className="identity-module__address-control">
      <button type="button" aria-label={copied ? 'Address copied' : 'Copy profile address'} title={address} onClick={copyAddress}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <span className="identity-module__address-tooltip">{address}</span>
    </span>
    <a className="identity-module__source-link" href={profile.url} target="_blank" rel="noreferrer"
      aria-label="Open official Universal Profile" title="Open on Universal Everything"><ArrowUpRight aria-hidden="true" /></a>
    <AddressQr key={address} address={address} />
    <span className="identity-module__copy-status" role="status">{failed ? 'Copy failed — use the full address above.' : copied ? 'Address copied' : ''}</span>
  </div>;
}

function IdentityDetails({ profile, onSave }) {
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState(null);
  const save = useRef(null);
  const start = () => {
    save.current = onSave;
    setEditor({ title: profile?.title || '', description: profile?.description || '', tags: (profile?.tags || []).join(', ') });
    setError(null);
  };
  return <section aria-label="INSCAPE profile">
    <div className="identity-module__details-heading"><h3>INSCAPE details</h3>
      {onSave && !editor && <button type="button" onClick={start}>Edit</button>}</div>
    {editor ? <form className="identity-module__details-form" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setEditor(null); setError(null); }
    }} onSubmit={event => {
      event.preventDefault();
      const next = { title: editor.title.trim(), description: editor.description.trim(), tags: [...new Set(editor.tags.split(',').map(tag => tag.trim()).filter(Boolean))] };
      if (next.tags.length > 16 || next.tags.some(tag => tag.length > 48)) { setError('Use up to 16 tags, each at most 48 characters.'); return; }
      const previous = { title: profile?.title || '', description: profile?.description || '', tags: profile?.tags || [] };
      if (JSON.stringify(next) === JSON.stringify(previous)) { setEditor(null); return; }
      if (save.current(next)) { setEditor(null); setError(null); }
      else setError('Could not save. Your text is still here. If these details changed elsewhere, cancel and reopen Edit.');
    }}>
      <label>Title<input autoFocus maxLength={80} value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} /></label>
      <label>Story<input maxLength={480} value={editor.description} onChange={event => setEditor({ ...editor, description: event.target.value })} /></label>
      <label>Tags, separated by commas<input value={editor.tags} maxLength={798} onChange={event => setEditor({ ...editor, tags: event.target.value })} /></label>
      <div><button type="submit">Save details</button><button type="button" onClick={() => { setEditor(null); setError(null); }}>Cancel</button></div>
      {error && <p role="alert">{error}</p>}
    </form> : <>
      {profile?.title && <h3>{profile.title}</h3>}
      <ProfileSection profile={{ description: profile?.description, tags: profile?.tags || [] }} />
      {onSave && !profile?.title && !profile?.description && !profile?.tags?.length && <p>Add your own title, story and interests.</p>}
    </>}
  </section>;
}

function TechnicalSection({ entries }) {
  const groupFor = (id) => {
    if (['address', 'network', 'type'].includes(id)) return 'contract';
    if (id === 'last-published') return 'publication';
    return 'registers';
  };
  const groups = [
    { id: 'contract', label: 'Universal Profile' },
    { id: 'publication', label: 'Publication' },
    { id: 'registers', label: 'Asset registers' }
  ].map((group) => ({
    ...group,
    entries: entries.filter((entry) => entry.id !== 'metadata-integrity' && groupFor(entry.id) === group.id)
  })).filter((group) => group.entries.length);
  return <div>{groups.map((group) => <section key={group.id}>
    <small>{group.label}</small>
    <dl>{group.entries.map((entry) => <div key={entry.id}>
      <dt>{entry.label}</dt>
      <dd>{entry.url ? <a href={entry.url} target="_blank" rel="noreferrer">{entry.value}<ExternalLink aria-hidden="true" /></a> : entry.value}</dd>
      {entry.provenance && !['CANONICAL_ADDRESS', 'DIRECT_RPC'].includes(entry.provenance)
        && <small>{entry.provenance.replaceAll('_', ' ')}</small>}
    </div>)}</dl>
  </section>)}</div>;
}


// Inputs are already projected for owner or visitor. No draft, wallet or route ownership.
export default function IdentityModule({ model, onClose, returnFocus, menuSurface, assetTargetRef, onAvatarChange, onDetailsChange, onCardChange, customAvatar = false, portraitChoices = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [narrow, setNarrow] = useState(() => globalThis.innerWidth <= 640);
  const extensionId = useId();
  const extensionRef = useRef(null);
  const [extensionHeight, setExtensionHeight] = useState(180);
  useEffect(() => {
    if (!expanded) return undefined;
    const node = extensionRef.current;
    const measure = () => setExtensionHeight(Math.ceil(node.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(node); measure();
    return () => observer.disconnect();
  }, [expanded]);
  const hasArtwork = customAvatar || ['INSCAPE_PUBLISHED_ASSET', 'INSCAPE_DRAFT_ASSET'].includes(model.profile.avatarProvenance);
  const card = model.card || resolveIdentityCard({ avatar: { mode: hasArtwork ? 'inscape' : 'official' } });
  const [previewBackground, setPreviewBackground] = useState(null);
  const background = previewBackground || card.background;
  const official = model.officialProfile || { name: model.profile.displayName, description: model.profile.description, tags: model.profile.tags };
  const authored = model.authoredProfile;
  const compactHeight = hasArtwork ? (narrow ? 640 : 490) : (narrow ? 390 : 300);
  useEffect(() => {
    const media = matchMedia('(max-width: 640px)');
    const change = () => setNarrow(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const closeRef = useRef(null);
  const portraitRef = useRef(null);
  const [artworkError, setArtworkError] = useState(null);
  const replacePortrait = (asset) => {
    const dimension = (value) => Number.isSafeInteger(value) && value > 0 ? value : null;
    const media = asset?.selectedMedia || {
      url: asset?.originalImageUrl || asset?.imageUrl || asset?.src,
      width: dimension(asset?.imageWidth || asset?.width), height: dimension(asset?.imageHeight || asset?.height),
    };
    if (!onAvatarChange || asset?.placeable === false || !isValidPlacementMedia(media)) {
      setArtworkError('Choose an image from your Library.'); return false;
    }
    const saved = onAvatarChange({ mode: 'inscape', stableAssetId: asset.stableAssetId || asset.id, shape: 'square', selectedMedia: media });
    setArtworkError(saved ? null : 'The artwork could not be saved. Your previous portrait is unchanged.');
    return Boolean(saved);
  };
  const replacePortraitRef = useRef(replacePortrait);
  replacePortraitRef.current = replacePortrait;
  const editable = Boolean(onAvatarChange);
  useImperativeHandle(assetTargetRef, () => editable ? {
    get node() { return portraitRef.current; },
    label: 'Release to replace Identity artwork', placeAsset: (asset) => replacePortraitRef.current(asset),
  } : null, [editable]);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [model.profile.avatarUrl]);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  const close = () => {
    onClose();
    queueMicrotask(() => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); });
  };
  return <div className="identity-module system-workflow__token-scope" data-artwork={hasArtwork ? 'custom' : 'official'} data-expanded={expanded} data-workbench-module="identity" data-lattice-menu-surface
    data-menu-surface={menuSurface} onKeyDown={(event) => {
      const qr = event.currentTarget.querySelector('[popover]:popover-open');
      if (event.key === 'Escape' && qr) {
        event.preventDefault(); event.stopPropagation(); qr.hidePopover();
        event.currentTarget.querySelector('[aria-label="Show address QR code"]')?.focus();
        return;
      }
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); }
    }} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <WorkbenchWindow label="Identity" title={model.profile.displayName} width={840} initialHeight={compactHeight} preferredHeight={compactHeight + (expanded ? extensionHeight : 0)}
      initialX={Math.max(8, (globalThis.innerWidth - 840) / 2)}
      titleContent={<IdentityTitle address={model.address} profile={model.officialProfile || {
        name: model.profile.displayName, avatarUrl: null, url: `https://universaleverything.io/${model.address}`,
      }} />}
      controls={<button aria-label="Close Identity" className="system-workflow__round-control"
        ref={closeRef} onClick={close} type="button"><X /></button>}>
      <div className="identity-module__intro">
        {background.type === 'clouds' && <IdentityClouds surface={menuSurface} color={background.color} speed={background.speed} />}
        <div className="identity-module__portrait" ref={portraitRef} aria-label="Identity artwork">
          {model.profile.avatarUrl && !imageFailed
          ? <img alt="" draggable={false} src={model.profile.avatarUrl} onError={() => setImageFailed(true)} /> : <UserRound />}
          {imageFailed && <span className="identity-module__drop-hint">Artwork unavailable</span>}
        </div>
        <div className="identity-module__story"><h2>{official.name}</h2>
          <ProfileSection profile={{ ...official, tags: official.tags || [] }} />
          <LinksSection links={model.links.filter(link => !['inscape-profile', 'universal-everything', 'explorer'].includes(link.id))} /></div>
      </div>
      <button className="identity-module__expand" type="button" aria-expanded={expanded} aria-controls={extensionId}
        aria-label={expanded ? 'Collapse INSCAPE details' : 'Expand INSCAPE details'} onClick={() => setExpanded(value => !value)}>
        <ChevronDown aria-hidden="true" />
      </button>
      <div ref={extensionRef} id={extensionId} className="identity-module__extension" hidden={!expanded}>
      {(onDetailsChange || authored?.title || authored?.description || authored?.tags?.length > 0) && <IdentityDetails profile={authored} onSave={onDetailsChange} />}
      <IdentityCardSettings card={card} configured={model.cardConfigured} onSave={onCardChange} onPreview={setPreviewBackground} />
      {onAvatarChange && <details className="identity-module__artwork-controls"><summary>Identity artwork</summary>
        <label>Choose from Library<select aria-label="Choose Identity artwork" value="" onChange={(event) => {
          const asset = portraitChoices.find((entry) => (entry.stableAssetId || entry.id) === event.target.value);
          if (asset) replacePortrait(asset);
        }}><option value="">Select an image</option>{portraitChoices.map((asset) =>
          <option key={asset.stableAssetId || asset.id} value={asset.stableAssetId || asset.id}>{asset.name || 'Untitled asset'}</option>)}</select></label>
        <p>Drag a specific image from the Library to use that variant. This changes your INSCAPE artwork only.</p>
        {customAvatar && <button type="button" onClick={() => {
          const saved = onAvatarChange({ mode: 'official', stableAssetId: null, shape: 'square' });
          setArtworkError(saved ? null : 'The artwork could not be saved.');
        }}>Use Universal Profile image</button>}
      </details>}
      {artworkError && <p role="alert">{artworkError}</p>}
      <details className="identity-module__technical"><summary>Universal Profile details</summary><TechnicalSection entries={model.technical} /></details>
      </div>
    </WorkbenchWindow>
  </div>;
}
