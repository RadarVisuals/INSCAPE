import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import RackMenu from '../menus/RackMenu.jsx';
import ProgressiveArtworkImage from './ProgressiveArtworkImage.jsx';
import { assetForPlacement, isValidPlacementMedia } from '../../systemWorkflow/domain/placementMedia.js';
import { PRESENTATION_BOARD_INSTANCE_STATE } from './ownerSystemWorkflowModuleState.js';
import {
  DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION,
  loadPresentationBoardShortcut,
  normalizePresentationBoardShortcutIconPresentation,
  presentationBoardShortcutStorageKey,
} from './presentationBoardShortcutStorage.js';

const WORKBENCH_CELL = 24;
const MINIMUM_SHORTCUT_SIZE = { width: 82, height: 64 };
const SHORTCUT_ICON_EDITOR_SIZE = { width: 252, height: 308 };
const SHORTCUT_ICON_PREVIEW_SIZE = 84;
const snap = (value, enabled) => enabled ? Math.round(value / WORKBENCH_CELL) * WORKBENCH_CELL : value;
const shortcutIconStyle = ({ offsetX, offsetY, scale }) => ({
  transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
});
const shortcutIconPreviewStyle = ({ offsetX, offsetY, scale, size }) => {
  const previewRatio = SHORTCUT_ICON_PREVIEW_SIZE / size;
  return { transform: `translate(${offsetX * previewRatio}px, ${offsetY * previewRatio}px) scale(${scale})` };
};
const shortcutBounds = ({ labelSize, size }) => ({
  height: Math.max(MINIMUM_SHORTCUT_SIZE.height, Math.ceil(size + labelSize * 1.25 + 19)),
  width: Math.max(MINIMUM_SHORTCUT_SIZE.width, size + 10),
});
const shortcutPresentationStyle = (presentation) => ({
  '--workflow-shortcut-height': `${shortcutBounds(presentation).height}px`,
  '--workflow-shortcut-icon-size': `${presentation.size}px`,
  '--workflow-shortcut-label-size': `${presentation.labelSize}px`,
  '--workflow-shortcut-width': `${shortcutBounds(presentation).width}px`,
});
export default function PresentationBoardShortcut({ assetsById, host, instanceState, menuSurface,
  onRestore, profileAddress, shortcutSnap, shortcutTargetRef }) {
  const storedShortcut = useMemo(() => loadPresentationBoardShortcut(profileAddress), [profileAddress]);
  const [shortcutPosition, setShortcutPosition] = useState(storedShortcut?.position || { left: 24, top: 72 });
  const [shortcutName, setShortcutName] = useState(storedShortcut?.name && storedShortcut.name !== 'PRESENTATION BOARD'
    ? storedShortcut.name : 'DISPLAY MODULE');
  const [shortcutIconId, setShortcutIconId] = useState(storedShortcut?.iconAssetId || null);
  const [shortcutIconMedia, setShortcutIconMedia] = useState(() => isValidPlacementMedia(storedShortcut?.iconMedia) ? storedShortcut.iconMedia : null);
  const shortcutNode = useRef(null);
  const [shortcutVisible, setShortcutVisible] = useState(Boolean(storedShortcut?.visible || storedShortcut?.open === false));
  const [shortcutIconPresentation, setShortcutIconPresentation] = useState(() =>
    normalizePresentationBoardShortcutIconPresentation(storedShortcut?.iconPresentation));
  const [shortcutIconEditing, setShortcutIconEditing] = useState(false);
  const [shortcutMenu, setShortcutMenu] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(shortcutName);
  const shortcutDragRef = useRef(null);
  useEffect(() => {
    try { globalThis.localStorage?.setItem(presentationBoardShortcutStorageKey(profileAddress), JSON.stringify({
      iconAssetId: shortcutIconId, iconMedia: shortcutIconMedia, iconPresentation: shortcutIconPresentation, name: shortcutName,
      open: instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW, position: shortcutPosition, visible: shortcutVisible,
    })); } catch { /* Workbench layout persistence is optional. */ }
  }, [instanceState, profileAddress, shortcutIconId, shortcutIconMedia, shortcutIconPresentation, shortcutName, shortcutPosition, shortcutVisible]);

  const applyShortcutAsset = (asset) => {
    const id = asset?.stableAssetId || asset?.id;
    if (!assetsById.has(id)) return false;
    setShortcutIconId(id);
    setShortcutIconMedia(isValidPlacementMedia(asset.selectedMedia) ? asset.selectedMedia : null);
    setShortcutIconPresentation(DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION);
    return true;
  };
  useImperativeHandle(shortcutTargetRef, () => ({
    get node() { return shortcutNode.current; },
    placeAsset: applyShortcutAsset,
    show: () => setShortcutVisible(true),
  }));
  useEffect(() => {
    if (!shortcutVisible || !shortcutIconId) setShortcutIconEditing(false);
  }, [shortcutIconId, shortcutVisible]);

  const currentShortcutBounds = shortcutBounds(shortcutIconPresentation);
  useLayoutEffect(() => {
    if (!host) return undefined;
    const keepShortcutVisible = () => setShortcutPosition((position) => {
      const left = Math.max(0, Math.min(host.clientWidth - currentShortcutBounds.width, position.left));
      const top = Math.max(0, Math.min(host.clientHeight - currentShortcutBounds.height, position.top));
      return left === position.left && top === position.top ? position : { left, top };
    });
    keepShortcutVisible();
    const observer = new ResizeObserver(keepShortcutVisible);
    observer.observe(host);
    return () => observer.disconnect();
  }, [host, currentShortcutBounds.width, currentShortcutBounds.height]);
  const clampShortcut = (position) => ({
    left: Math.max(0, Math.min((host?.clientWidth || currentShortcutBounds.width) - currentShortcutBounds.width, snap(position.left, shortcutSnap))),
    top: Math.max(0, Math.min((host?.clientHeight || currentShortcutBounds.height) - currentShortcutBounds.height, snap(position.top, shortcutSnap))),
  });
  useEffect(() => {
    if (!host || !shortcutVisible) return;
    setShortcutPosition((current) => {
      const next = clampShortcut(current);
      return next.left === current.left && next.top === current.top ? current : next;
    });
  }, [host, shortcutIconPresentation.labelSize, shortcutIconPresentation.size, shortcutSnap, shortcutVisible]);
  const beginShortcutDrag = (event) => {
    if (event.button !== 0 || renaming) return;
    shortcutDragRef.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...shortcutPosition };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveShortcutDrag = (event) => {
    const start = shortcutDragRef.current; if (!start || start.id !== event.pointerId) return;
    setShortcutPosition(clampShortcut({ left: start.left + event.clientX - start.clientX,
      top: start.top + event.clientY - start.clientY }));
  };
  const stopShortcutDrag = (event) => { if (shortcutDragRef.current?.id === event.pointerId) shortcutDragRef.current = null; };
  const commitRename = () => {
    const value = renameValue.trim(); if (value) setShortcutName(value.slice(0, 48)); else setRenameValue(shortcutName);
    setRenaming(false);
  };

  const shortcutAsset = shortcutIconId ? assetForPlacement(assetsById.get(shortcutIconId)
    || (shortcutIconMedia ? { id: shortcutIconId } : null), { selectedMedia: shortcutIconMedia }) : null;
  const hostRectangle = host?.getBoundingClientRect();
  const iconEditorPosition = hostRectangle ? {
    left: Math.max(8, Math.min(globalThis.innerWidth - SHORTCUT_ICON_EDITOR_SIZE.width - 8,
      hostRectangle.left + shortcutPosition.left + currentShortcutBounds.width + 8)),
    top: Math.max(8, Math.min(globalThis.innerHeight - SHORTCUT_ICON_EDITOR_SIZE.height - 8,
      hostRectangle.top + shortcutPosition.top)),
  } : { left: 8, top: 8 };
  return <>
    {shortcutVisible
      && <button aria-label={instanceState === PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED
        ? `Open ${shortcutName}` : `${shortcutName} shortcut`} className="system-workflow__desktop-shortcut" ref={shortcutNode}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setShortcutMenu({ x: event.clientX, y: event.clientY }); }}
      onDoubleClick={() => { if (instanceState === PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED) onRestore?.(); }} onDragOver={(event) => { if ([...event.dataTransfer.types].includes('application/x-inscape-asset')) event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation();
        applyShortcutAsset(assetsById.get(event.dataTransfer.getData('application/x-inscape-asset')));
      }}
      onKeyDown={(event) => { if (event.key === 'Enter' && !renaming && instanceState === PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED) { event.preventDefault(); onRestore?.(); } }}
      onPointerCancel={stopShortcutDrag} onPointerDown={beginShortcutDrag} onPointerMove={moveShortcutDrag}
      onPointerUp={stopShortcutDrag} style={{ left: shortcutPosition.left, top: shortcutPosition.top,
        ...shortcutPresentationStyle(shortcutIconPresentation) }} type="button">
      <span aria-hidden="true" className="system-workflow__desktop-shortcut-icon" data-custom={shortcutAsset ? true : undefined}>
        {shortcutAsset ? <ProgressiveArtworkImage asset={shortcutAsset} style={shortcutIconStyle(shortcutIconPresentation)} /> : 'DM'}
      </span>
      {renaming ? <input aria-label="Display Module shortcut name" autoFocus maxLength="48"
        onBlur={commitRename} onChange={(event) => setRenameValue(event.target.value)}
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
          if (event.key === 'Escape') { event.preventDefault(); setRenameValue(shortcutName); setRenaming(false); }
        }} value={renameValue} /> : <strong>{shortcutName}</strong>}
    </button>}
    {shortcutIconEditing && shortcutAsset && <section aria-label="Edit Display Module shortcut icon"
      className="system-workflow__shortcut-icon-editor" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); setShortcutIconEditing(false); }
      }} role="dialog" style={iconEditorPosition}>
      <div className="system-workflow__shortcut-icon-preview" aria-hidden="true">
        <ProgressiveArtworkImage asset={shortcutAsset} style={shortcutIconPreviewStyle(shortcutIconPresentation)} />
      </div>
      <div className="system-workflow__shortcut-icon-controls">
        <label><span>SIZE</span><input aria-label="Shortcut icon size" autoFocus max="150" min="40" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, size: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.size} /><output>{shortcutIconPresentation.size}px</output></label>
        <label><span>ZOOM</span><input aria-label="Shortcut icon zoom" max="3" min="0.75" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, scale: Number(event.target.value) }))} step="0.05" type="range" value={shortcutIconPresentation.scale} /><output>{Math.round(shortcutIconPresentation.scale * 100)}%</output></label>
        <label><span>X</span><input aria-label="Shortcut icon horizontal position" max="150" min="-150" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, offsetX: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.offsetX} /><output>{shortcutIconPresentation.offsetX > 0 ? '+' : ''}{shortcutIconPresentation.offsetX}</output></label>
        <label><span>Y</span><input aria-label="Shortcut icon vertical position" max="150" min="-150" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, offsetY: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.offsetY} /><output>{shortcutIconPresentation.offsetY > 0 ? '+' : ''}{shortcutIconPresentation.offsetY}</output></label>
        <label><span>FONT</span><input aria-label="Shortcut label size" max="20" min="7" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, labelSize: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.labelSize} /><output>{shortcutIconPresentation.labelSize}px</output></label>
      </div>
      <footer><button onClick={() => setShortcutIconPresentation(DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION)} type="button">Reset</button><button onClick={() => setShortcutIconEditing(false)} type="button">Done</button><button aria-label="Close icon editor" className="system-workflow__shortcut-icon-editor-close" onClick={() => setShortcutIconEditing(false)} title="Close" type="button"><X /></button></footer>
    </section>}
    {shortcutMenu && createPortal(<RackMenu anchor={shortcutMenu} commands={[
      { id: 'rename', label: 'RENAME' }, { disabled: !shortcutIconId, id: 'edit-icon', label: 'EDIT ICON' },
      { disabled: !shortcutIconId, id: 'reset-icon', label: 'RESET ICON' },
    ]} label="Display Module shortcut commands" menuSurfaceId={menuSurface} onClose={() => setShortcutMenu(null)} onCommand={(id) => {
      if (id === 'rename') { setRenameValue(shortcutName); setRenaming(true); }
      if (id === 'edit-icon') setShortcutIconEditing(true);
      if (id === 'reset-icon') { setShortcutIconId(null); setShortcutIconPresentation(DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION); }
      setShortcutMenu(null);
    }} systemWorkflowOverlay />, document.body)}
  </>;
}
