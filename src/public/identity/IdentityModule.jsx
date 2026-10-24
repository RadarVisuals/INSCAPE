import { Minus, Settings, UserRound, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import RackMenu from '../menus/RackMenu.jsx';
import useIdentityShortcut, { IDENTITY_SHORTCUT_SIZES } from './useIdentityShortcut.js';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { WorkbenchWindow } from '../ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { isValidPlacementMedia } from '../../systemWorkflow/domain/placementMedia.js';
import IdentityClouds from './IdentityClouds.jsx';
import IdentityCardBody from './IdentityCardBody.jsx';
import IdentityTitle from './IdentityTitle.jsx';
import LibraryArtworkImage from '../ownerSystemWorkflow/LibraryArtworkImage.jsx';
import { useIdentityEditor, IdentityAppearanceSettings } from './IdentityCardSettings.jsx';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import '../ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../ownerSystemWorkflow/displayInstruments.css';
import './identityModule.css';

// Inputs are already projected for owner or visitor. No draft, wallet or route ownership.
export default function IdentityModule({ model, onClose, returnFocus, menuSurface, assetTargetRef, presentationRef, onDisconnect, avatar, onSave, customAvatar = false, portraitChoices = [], initialWindow, onWindowChange }) {
  const [shortcutMenu, setShortcutMenu] = useState(null);
  const shortcutButton = useRef(null);
  const shortcut = useIdentityShortcut(model.address, Boolean(onSave));
  const minimized = shortcut.position.mode === 'minimized';
  const restore = () => { shortcut.setMode('window'); setShortcutMenu(null); requestAnimationFrame(() => closeRef.current?.focus()); };
  useImperativeHandle(presentationRef, () => ({ restore }));
  const [expanded, setExpanded] = useState(false);
  const editRef = useRef(null);
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
  const editable = Boolean(onSave) && !minimized;
  useImperativeHandle(assetTargetRef, () => editable ? {
    get node() { return portraitRef.current; },
    label: 'Release to replace Identity artwork', placeAsset: (asset) => replacePortraitRef.current(asset),
  } : null, [editable]);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [portraitUrl]);
  useEffect(() => { (minimized ? shortcutButton : closeRef).current?.focus({ preventScroll: true }); }, []);
  const close = () => {
    shortcut.setMode('closed');
    onClose();
    queueMicrotask(() => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); });
  };
  const openShortcutMenu = event => {
    event.preventDefault(); event.stopPropagation();
    setShortcutMenu({ x: event.clientX || shortcut.position.x, y: event.clientY || shortcut.position.y });
  };
  const circle = <button ref={shortcutButton} type="button" className="identity-module__circle" aria-label={`Open Identity: ${official.name}`}
    {...shortcut.pointer} onContextMenu={openShortcutMenu}
    onKeyDown={event => {
      if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') openShortcutMenu(event);
      else shortcut.moveByKey(event);
    }} onClick={event => { if (event.detail === 0 || !shortcut.suppressClick.current) restore(); shortcut.suppressClick.current = false; }}>
    {portraitUrl && !imageFailed ? <LibraryArtworkImage key={portraitUrl} alt="" draggable={false} src={portraitUrl} onError={() => setImageFailed(true)} /> : <UserRound />}
  </button>;
  return <div className="identity-module system-workflow__token-scope" data-shortcut-shape={shortcut.position.shape} data-minimized={minimized || undefined} data-artwork={hasArtwork ? 'custom' : 'official'} data-expanded={expanded} data-editing={editing} data-workbench-module="identity" data-lattice-menu-surface
    data-menu-surface={menuSurface} onKeyDown={(event) => {
      if (shortcutMenu) return;
      const qr = event.currentTarget.querySelector('[popover]:popover-open');
      if (event.key === 'Escape' && qr) {
        event.preventDefault(); event.stopPropagation(); qr.hidePopover();
        event.currentTarget.querySelector('[aria-label="Show address QR code"]')?.focus();
        return;
      }
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); if (editing) edit.cancel(); else close(); }
    }} onPointerDown={(event) => event.stopPropagation()}>
    <WorkbenchWindow chrome="bevel" menuSurface={menuSurface} label="Identity" title={model.profile.displayName} width={initialWindow?.width || 840} fitContent
      compact={minimized ? { content: circle, style: { left: shortcut.position.x, top: shortcut.position.y,
        width: shortcut.position.size, height: shortcut.position.size, minHeight: 0, maxHeight: 'none',
        '--detached-window-width': `${shortcut.position.size}px`, borderRadius: shortcut.position.shape === 'square' ? 'var(--workflow-window-chrome-radius)' : '50%', overflow: 'hidden' } } : undefined}
      background={background.type === 'clouds' ? <IdentityClouds surface={menuSurface} color={background.color} speed={background.speed} /> : null}
      initialX={initialWindow?.left ?? Math.max(8, (globalThis.innerWidth - 840) / 2)} initialY={initialWindow?.top ?? 72}
      onLayoutChange={onWindowChange}
      titleContent={<IdentityTitle address={model.address} profile={model.officialProfile || {
        name: model.profile.displayName, avatarUrl: null, url: `https://universaleverything.io/${model.address}`,
      }} />}
      controls={<>{editing && <><button type="button" className="identity-module__save" onClick={edit.save}>Save</button>
        <button type="button" className="identity-module__save" onClick={edit.cancel}>Cancel</button></>}<button type="button" aria-label="Minimize Identity" title="Minimize Identity" disabled={editing}
          className="system-workflow__window-cap" onClick={() => { shortcut.setMode('minimized'); requestAnimationFrame(() => shortcutButton.current?.focus()); }}><Minus /></button>{onSave && <button ref={editRef} aria-label="Edit Identity" title="Edit Identity" aria-pressed={editing}
        className="system-workflow__window-cap" data-icon="settings" type="button" onClick={() => {
          if (editing) edit.cancel(); else { edit.start(); setExpanded(true); }
        }}><Settings /></button>}<button aria-label="Close Identity" className="system-workflow__window-cap"
        ref={closeRef} onClick={close} type="button"><X /></button></>}>
      <IdentityCardBody model={model} card={shownCard} portraitUrl={portraitUrl} portraitRef={portraitRef}
        interactive={!minimized} expanded={expanded} onExpandedChange={setExpanded} edit={editing ? edit : null}>
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
      </IdentityCardBody>
      {edit.error && <p role="alert">{edit.error}</p>}
      {artworkError && <p role="alert">{artworkError}</p>}
    </WorkbenchWindow>
    {shortcutMenu && createPortal(<RackMenu anchor={shortcutMenu} label="Identity shortcut commands" menuSurfaceId={menuSurface}
      commands={[{ id: 'open', label: 'OPEN IDENTITY' }, { id: 'size', label: 'SIZE' }, { id: 'shape', label: 'SHAPE' }, { id: 'close', label: 'CLOSE' },
        ...(onSave && onDisconnect ? [{ id: 'disconnect', label: 'DISCONNECT' }] : [])]}
      getSubmenuCommands={id => id === 'size' ? Object.entries(IDENTITY_SHORTCUT_SIZES).map(([id, size]) => ({ id, label: id.toUpperCase(), checkable: true, selected: shortcut.position.size === size }))
        : id === 'shape' ? [{ id: 'circle', label: 'CIRCLE', checkable: true, selected: shortcut.position.shape === 'circle' },
          { id: 'square', label: 'ROUNDED SQUARE', checkable: true, selected: shortcut.position.shape === 'square' }] : []}
      returnFocus={shortcutButton.current} onClose={() => setShortcutMenu(null)} onCommand={id => {
        setShortcutMenu(null);
        if (id === 'open') restore();
        else if (id === 'close') close();
        else if (id === 'circle' || id === 'square') { shortcut.setShape(id); requestAnimationFrame(() => shortcutButton.current?.focus()); }
        else if (id === 'disconnect') onDisconnect?.();
        else if (IDENTITY_SHORTCUT_SIZES[id]) { shortcut.resize(IDENTITY_SHORTCUT_SIZES[id]); requestAnimationFrame(() => shortcutButton.current?.focus()); }
      }} systemWorkflowOverlay />, document.body)}
  </div>;
}
