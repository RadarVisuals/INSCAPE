import { Check, ChevronDown, Settings, BadgeCheck, Github, Globe, Instagram, UserRound, X, Youtube } from 'lucide-react';
import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { WorkbenchWindow } from '../ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import OwnerSystemWorkflowDetachedWindow from '../ownerSystemWorkflow/OwnerSystemWorkflowDetachedWindow.jsx';
import { isValidPlacementMedia } from '../../systemWorkflow/domain/placementMedia.js';
import IdentityClouds from './IdentityClouds.jsx';
import { useIdentityEditor, IdentityProfileEditor, IdentityFields, IdentityAppearanceSettings } from './IdentityCardSettings.jsx';
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
    return <li key={link.id}><a href={link.url} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label}>
      {Icon ? <Icon aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.9-9L2 2h6.5l4.4 6.8L18.9 2ZM17.8 20h1.7L7.5 4H5.7l12.1 16Z" /></svg>}
      <span className="identity-module__link-tooltip">{link.label}</span>
    </a></li>;
  })}</ol></nav>;
}

// Small header controls share native 16px geometry and rounded square corners.
function IdentityActionIcon({ kind }) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'copy' && <><rect x="5.5" y="5.5" width="8" height="8" rx="1" /><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1" /></>}
    {kind === 'source' && <><path d="M8.5 3.5h-6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-6M9.5 1.5h4v4M13.5 1.5l-7 7" /></>}
    {kind === 'qr' && <><rect x="1.5" y="1.5" width="4" height="4" rx="1" /><rect x="9.5" y="1.5" width="4" height="4" rx="1" /><rect x="1.5" y="9.5" width="4" height="4" rx="1" /><rect x="9.5" y="9.5" width="4" height="4" rx="1" /></>}
  </svg>;
}

function AddressQr({ address }) {
  const id = useId();
  const popover = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    if (!open) return undefined;
    let frame;
    let previous = '';
    const locate = () => {
      const anchor = trigger.current.getBoundingClientRect();
      const node = popover.current;
      const bounds = node.getBoundingClientRect();
      const left = Math.max(16, Math.min(anchor.left, innerWidth - bounds.width - 16));
      const below = anchor.bottom + 8;
      const preferredTop = below + bounds.height <= innerHeight - 16 ? below : anchor.top - bounds.height - 8;
      const top = Math.max(16, Math.min(preferredTop, innerHeight - bounds.height - 16));
      const position = `${left}:${top}`;
      if (position !== previous) {
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        previous = position;
      }
      frame = requestAnimationFrame(locate);
    };
    locate();
    return () => cancelAnimationFrame(frame);
  }, [open]);
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
    import('./addressQr.js').then(({ createAddressQrImage }) => {
      if (active) setImage(createAddressQrImage(address));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [open, address]);
  return <>
    <button ref={trigger} className="identity-module__header-action" type="button" popovertarget={id}
      aria-label="Show address QR code" aria-expanded={open} title="Show address QR code"><IdentityActionIcon kind="qr" /></button>
    <div ref={popover} id={id} popover="auto" className="identity-module__qr" role="dialog" aria-label="Share profile address"
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
      {open && <OwnerSystemWorkflowDetachedWindow as="div" title="Share profile address" className="identity-module__qr-window"
        surfaceClassName="identity-module__qr-content"
        controls={<button className="system-workflow__round-control" type="button" popovertarget={id} popovertargetaction="hide" aria-label="Close QR code"><X /></button>}>
        {image ? <img draggable={false} src={image} alt="QR code containing the full Universal Profile address" />
          : <p role="status">{failed ? 'QR unavailable. Use the copy button.' : 'Creating QR…'}</p>}
        <code><span>{address.slice(0, 22)}</span><span>{address.slice(22)}</span></code>
      </OwnerSystemWorkflowDetachedWindow>}
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
        {copied ? <Check aria-hidden="true" /> : <IdentityActionIcon kind="copy" />}
      </button>
      <span className="identity-module__address-tooltip">{address}</span>
    </span>
    <a className="identity-module__source-link" href={profile.url} target="_blank" rel="noreferrer"
      aria-label="Open official Universal Profile" title="Open on Universal Everything"><IdentityActionIcon kind="source" /></a>
    <AddressQr key={address} address={address} />
    <span className="identity-module__copy-status" role="status">{failed ? 'Copy failed — use the full address above.' : copied ? 'Address copied' : ''}</span>
  </div>;
}

// Inputs are already projected for owner or visitor. No draft, wallet or route ownership.
export default function IdentityModule({ model, onClose, returnFocus, menuSurface, assetTargetRef, avatar, onSave, customAvatar = false, portraitChoices = [], initialWindow, onWindowChange }) {
  const [expanded, setExpanded] = useState(false);
  const editRef = useRef(null);
  const extensionId = useId();
  const savedArtwork = customAvatar || ['INSCAPE_PUBLISHED_ASSET', 'INSCAPE_DRAFT_ASSET'].includes(model.profile.avatarProvenance);
  const card = model.card || resolveIdentityCard({ avatar: { mode: savedArtwork ? 'inscape' : 'official' } });
  const official = model.officialProfile || { name: model.profile.displayName, description: model.profile.description, tags: model.profile.tags };
  const authored = model.authoredProfile;
  const edit = useIdentityEditor({ card, profile: authored, avatar, configured: model.cardConfigured, onSave,
    onDone: () => queueMicrotask(() => editRef.current?.focus({ preventScroll: true })) });
  const editing = Boolean(edit.editor);
  const hasArtwork = editing ? edit.editor.avatar?.mode === 'inscape' : savedArtwork;
  const portraitUrl = editing && JSON.stringify(edit.editor.avatar) !== JSON.stringify(avatar)
    ? hasArtwork ? edit.editor.avatar.selectedMedia?.url : official.avatarUrl
    : model.profile.avatarUrl;
  const shownCard = edit.editor?.card || card;
  const background = shownCard.background;
  const designation = model.designation && <span className="identity-module__designation" title={model.designation.title}
    aria-label={model.designation.title}><BadgeCheck aria-hidden="true" />{model.designation.label}</span>;
  const closeRef = useRef(null);
  const portraitRef = useRef(null);
  const [artworkError, setArtworkError] = useState(null);
  const replacePortrait = (asset) => {
    const dimension = (value) => Number.isSafeInteger(value) && value > 0 ? value : null;
    const media = asset?.selectedMedia || {
      url: asset?.originalImageUrl || asset?.imageUrl || asset?.src,
      width: dimension(asset?.imageWidth || asset?.width), height: dimension(asset?.imageHeight || asset?.height),
    };
    if (!onSave || asset?.placeable === false || !isValidPlacementMedia(media)) {
      setArtworkError('Choose an image from your Library.'); return false;
    }
    edit.setAvatar({ mode: 'inscape', stableAssetId: asset.stableAssetId || asset.id, shape: 'square', selectedMedia: media });
    setExpanded(true);
    setArtworkError(null);
    return true;
  };
  const replacePortraitRef = useRef(replacePortrait);
  replacePortraitRef.current = replacePortrait;
  const editable = Boolean(onSave);
  useImperativeHandle(assetTargetRef, () => editable ? {
    get node() { return portraitRef.current; },
    label: 'Release to replace Identity artwork', placeAsset: (asset) => replacePortraitRef.current(asset),
  } : null, [editable]);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [portraitUrl]);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  const close = () => {
    onClose();
    queueMicrotask(() => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); });
  };
  return <div className="identity-module system-workflow__token-scope" data-artwork={hasArtwork ? 'custom' : 'official'} data-expanded={expanded} data-editing={editing} data-workbench-module="identity" data-lattice-menu-surface
    data-menu-surface={menuSurface} onKeyDown={(event) => {
      const qr = event.currentTarget.querySelector('[popover]:popover-open');
      if (event.key === 'Escape' && qr) {
        event.preventDefault(); event.stopPropagation(); qr.hidePopover();
        event.currentTarget.querySelector('[aria-label="Show address QR code"]')?.focus();
        return;
      }
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); if (editing) edit.cancel(); else close(); }
    }} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <WorkbenchWindow label="Identity" title={model.profile.displayName} width={initialWindow?.width || 840} fitContent
      initialX={initialWindow?.left ?? Math.max(8, (globalThis.innerWidth - 840) / 2)} initialY={initialWindow?.top ?? 72}
      onLayoutChange={onWindowChange}
      titleContent={<IdentityTitle address={model.address} profile={model.officialProfile || {
        name: model.profile.displayName, avatarUrl: null, url: `https://universaleverything.io/${model.address}`,
      }} />}
      controls={<>{editing && <><button type="button" className="identity-module__save" onClick={edit.save}>Save</button>
        <button type="button" className="identity-module__save" onClick={edit.cancel}>Cancel</button></>}{onSave && <button ref={editRef} aria-label="Edit Identity" title="Edit Identity" aria-pressed={editing}
        className="system-workflow__round-control" type="button" onClick={() => {
          if (editing) edit.cancel(); else { edit.start(); setExpanded(true); }
        }}><Settings /></button>}<button aria-label="Close Identity" className="system-workflow__round-control"
        ref={closeRef} onClick={close} type="button"><X /></button></>}>
      <div className="identity-module__card">
        {background.type === 'clouds' && <IdentityClouds surface={menuSurface} color={background.color} speed={background.speed} />}
      <div className="identity-module__intro">
        <div className="identity-module__portrait" ref={portraitRef} aria-label="Identity artwork">
          {portraitUrl && !imageFailed
          ? <img alt="" draggable={false} src={portraitUrl} onError={() => setImageFailed(true)} /> : <UserRound />}
          {imageFailed && <span className="identity-module__drop-hint">Artwork unavailable</span>}
        </div>
        <div className="identity-module__story">
          {editing ? <IdentityProfileEditor edit={edit} official={official}>{designation}</IdentityProfileEditor> : <>
          {authored?.title && <p className="identity-module__custom-title">{authored.title}</p>}
          <h2>{official.name}</h2>
          {designation}
          <ProfileSection profile={{ ...official, description: authored?.description || official.description,
            tags: [...new Set([...(official.tags || []), ...(authored?.tags || [])])] }} /></>}
          <LinksSection links={model.links.filter(link => !['inscape-profile', 'universal-everything', 'explorer'].includes(link.id))} /></div>
      <button className="identity-module__expand" type="button" aria-expanded={expanded} aria-controls={extensionId}
        aria-label={expanded ? 'Collapse INSCAPE details' : 'Expand INSCAPE details'} onClick={() => setExpanded(value => !value)}>
        <ChevronDown aria-hidden="true" />
      </button>
      </div>
      <div id={extensionId} className="identity-module__extension" hidden={!expanded}>
      <IdentityFields card={shownCard} edit={editing ? edit : null} />
      {editing && <IdentityAppearanceSettings edit={edit}>
        {onSave && <label>Choose artwork<select aria-label="Choose Identity artwork" value="" onChange={(event) => {
          const asset = portraitChoices.find(entry => (entry.stableAssetId || entry.id) === event.target.value);
          if (asset) replacePortrait(asset);
        }}><option value="">Select from Library</option>{portraitChoices.map(asset =>
          <option key={asset.stableAssetId || asset.id} value={asset.stableAssetId || asset.id}>{asset.name || 'Untitled asset'}</option>)}</select></label>}
        {hasArtwork && onSave && <button type="button" onClick={() => {
          edit.setAvatar({ mode: 'official', stableAssetId: null, shape: 'square' });
          setArtworkError(null);
        }}>Use Universal Profile image</button>}
        <small>Drag an image from Library to preview it. Save keeps your changes; Cancel restores your card.</small>
      </IdentityAppearanceSettings>}
      </div>
      {edit.error && <p role="alert">{edit.error}</p>}
      {artworkError && <p role="alert">{artworkError}</p>}
      </div>
    </WorkbenchWindow>
  </div>;
}
