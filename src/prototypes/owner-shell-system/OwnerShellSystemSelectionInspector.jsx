import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Frame,
  Lock,
  RotateCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  OWNER_SHELL_SYSTEM_PRESENTATION_OPTIONS,
  OWNER_SHELL_SYSTEM_TRANSPARENCY_OPTIONS,
} from './ownerShellSystemPresentation.js';

export default function OwnerShellSystemSelectionInspector({
  activePlacementCount,
  cropSession,
  layers,
  onApplyCrop,
  onApplyPresentation,
  onBeginCrop,
  onBeginPresentation,
  onCancelCrop,
  onCancelPresentation,
  onDuplicate,
  onLayerMove,
  onLayerSelect,
  onMirrorHorizontal,
  onMirrorVertical,
  onRemoveCancel,
  onRemoveConfirm,
  onRemoveRequest,
  onRestoreNativeFit,
  onRotate,
  onUpdateCropZoom,
  onUpdatePresentation,
  onToggleLock,
  presentationSession,
  selectedCount,
  side,
}) {
  return <aside aria-label="Selection and layers inspector" className="owner-shell-system__inspector" data-side={side}>
    {cropSession ? <section aria-label="Crop controls" className="owner-shell-system__crop-controls">
      <div><strong>CROP / DRAG IMAGE</strong><output>{Math.round(cropSession.previewCrop.zoom * 100)}%</output></div>
      <input aria-label="Crop zoom" max="4" min="1" onChange={(event) => onUpdateCropZoom(Number(event.target.value))}
        step="0.05" type="range" value={cropSession.previewCrop.zoom} />
      <footer><button onClick={onRestoreNativeFit} type="button">NATIVE FIT</button><button onClick={onCancelCrop} type="button">CANCEL</button><button onClick={onApplyCrop} type="button">DONE</button></footer>
    </section> : presentationSession ? <section aria-label="Frame and mat controls" className="owner-shell-system__presentation-controls">
      <div className="owner-shell-system__presentation-fields">
        <label><span>FRAME</span><select onChange={(event) => onUpdatePresentation({ frame: event.target.value })} value={presentationSession.frame}>{OWNER_SHELL_SYSTEM_PRESENTATION_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>MAT</span><select onChange={(event) => onUpdatePresentation({ mat: event.target.value })} value={presentationSession.mat}>{OWNER_SHELL_SYSTEM_PRESENTATION_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>MAT COLOR</span><input onChange={(event) => onUpdatePresentation({ matColor: event.target.value })} type="color" value={presentationSession.matColor} /></label>
        <label><span>BACKING</span><input checked={presentationSession.backing} onChange={(event) => onUpdatePresentation({ backing: event.target.checked })} type="checkbox" /></label>
        <label><span>BACKING COLOR</span><input disabled={!presentationSession.backing} onChange={(event) => onUpdatePresentation({ backingColor: event.target.value })} type="color" value={presentationSession.backingColor} /></label>
        <label><span>TRANSPARENCY</span><select onChange={(event) => onUpdatePresentation({ transparency: event.target.value })} value={presentationSession.transparency}>{OWNER_SHELL_SYSTEM_TRANSPARENCY_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <footer><button onClick={onCancelPresentation} type="button">CANCEL</button><button onClick={onApplyPresentation} type="button">APPLY</button></footer>
    </section> : <>
      <nav aria-label="Selection actions" className="owner-shell-system__selection-actions">
        <button aria-label="Rotate" disabled={!selectedCount} onClick={onRotate} title="Rotate" type="button"><RotateCw size={15} /></button>
        <button aria-label="Mirror horizontal" disabled={!selectedCount} onClick={onMirrorHorizontal} title="Mirror horizontal" type="button"><FlipHorizontal2 size={15} /></button>
        <button aria-label="Mirror vertical" disabled={!selectedCount} onClick={onMirrorVertical} title="Mirror vertical" type="button"><FlipVertical2 size={15} /></button>
        <button aria-label="Duplicate" disabled={!selectedCount} onClick={onDuplicate} title="Duplicate" type="button"><Copy size={15} /></button>
        <button aria-label="Send to back" disabled={!selectedCount} onClick={() => onLayerMove(-activePlacementCount)} title="Send to back" type="button"><ChevronsDown size={15} /></button>
        <button aria-label="Move backward" disabled={!selectedCount} onClick={() => onLayerMove(-1)} title="Move backward" type="button"><ChevronDown size={15} /></button>
        <button aria-label="Move forward" disabled={!selectedCount} onClick={() => onLayerMove(1)} title="Move forward" type="button"><ChevronUp size={15} /></button>
        <button aria-label="Bring to front" disabled={!selectedCount} onClick={() => onLayerMove(activePlacementCount)} title="Bring to front" type="button"><ChevronsUp size={15} /></button>
        <button aria-label="Crop" disabled={selectedCount !== 1} onClick={onBeginCrop} title={selectedCount === 1 ? 'Crop' : 'Crop requires one artwork'} type="button"><Crop size={15} /></button>
        <button aria-label="Frame and mat" disabled={selectedCount !== 1} onClick={onBeginPresentation} title={selectedCount === 1 ? 'Frame and mat' : 'Frame and mat requires one artwork'} type="button"><Frame size={15} /></button>
      </nav>
      <section className="owner-shell-system__layers"><small>LAYERS / THIS TABLE{selectedCount > 1 ? ` / ${selectedCount} SELECTED` : ''}</small>
        <div className="owner-shell-system__layer-list">{layers.map((layer) => <div className="owner-shell-system__layer-row"
          data-confirming={layer.confirming || undefined} data-selected={layer.selected || undefined} key={layer.id}>
          <button className="owner-shell-system__layer-select" disabled={layer.locked} onClick={(event) => onLayerSelect(layer.id, event.shiftKey)} type="button"><img alt="" src={layer.previewSrc} /><span>{layer.title}</span></button>
          <button aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.title}`} aria-pressed={layer.locked} className="owner-shell-system__layer-lock" onClick={() => onToggleLock(layer.id)} title={layer.locked ? 'Unlock placement' : 'Lock placement'} type="button">{layer.locked ? <Unlock size={13} /> : <Lock size={13} />}</button>
          <button aria-label={`Remove ${layer.title} from table`} className="owner-shell-system__layer-remove" onClick={() => onRemoveRequest(layer.id)} title="Remove from table" type="button"><Trash2 size={14} /></button>
          {layer.confirming && <div className="owner-shell-system__remove-confirm"><img alt="" src={layer.previewSrc} /><span>REMOVE FROM TABLE?</span><button onClick={onRemoveCancel} type="button">CANCEL</button><button onClick={() => onRemoveConfirm(layer.id)} type="button">REMOVE</button></div>}
        </div>)}</div>
      </section>
    </>}
  </aside>;
}
