import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Copy, Crop, FlipHorizontal2, FlipVertical2, Frame, Lock, Minus, RotateCw, Trash2,
} from 'lucide-react';
import {
  SYSTEM_WORKFLOW_LAYER_OPERATIONS,
  systemWorkflowLayerOperationAvailability,
  systemWorkflowLayerTopologySnapshot,
} from '../../systemWorkflow/systemWorkflowLayer.js';
import { SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS } from '../../systemWorkflow/systemWorkflowTransform.js';

const PRESENTATION_FRAMES = ['NONE', 'DOSSIER', 'CAPTION'];
const TRANSPARENCY = ['AUTO', 'PRESERVE_ALPHA', 'OPAQUE'];
const sourceFor = (asset) => asset?.previewSrc || asset?.src || asset?.thumbnailUrl || asset?.imageUrl;
const POSITION_KEY = 'inscape:system-workflow:layers-position';
const savedPosition = () => { try { const value = JSON.parse(globalThis.sessionStorage?.getItem(POSITION_KEY)); return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? value : null; } catch { return null; } };

function reorderBlock(ids, selectedIds, direction) {
  const selected = new Set(selectedIds);
  let ordered = [...ids];
  if (direction === 'BACK') ordered = [...ordered.filter((id) => selected.has(id)), ...ordered.filter((id) => !selected.has(id))];
  else if (direction === 'FRONT') ordered = [...ordered.filter((id) => !selected.has(id)), ...ordered.filter((id) => selected.has(id))];
  else if (direction === 'BACKWARD') {
    for (let index = 1; index < ordered.length; index += 1) if (selected.has(ordered[index]) && !selected.has(ordered[index - 1])) [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
  } else {
    for (let index = ordered.length - 2; index >= 0; index -= 1) if (selected.has(ordered[index]) && !selected.has(ordered[index + 1])) [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
  }
  return ordered;
}

export default function OwnerSystemWorkflowSelectionInspector({ assetsById, controller, crop, layout, onBeginCrop, onMinimize, obscuredByGridSwitcher = false }) {
  const [removeCandidateId, setRemoveCandidateId] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [position, setPosition] = useState(savedPosition);
  const inspectorRef = useRef(null);
  const dragRef = useRef(null);
  const grid = controller.selectedGrid;
  const selected = controller.selectedPlacements;
  const unlockedSelected = selected.filter(({ locked }) => !locked);
  const primary = unlockedSelected.length === 1 ? unlockedSelected[0] : null;
  useEffect(() => { if (!removeCandidateId) return undefined; const cancel = (event) => event.key === 'Escape' && setRemoveCandidateId(null); globalThis.addEventListener('keydown', cancel, true); return () => globalThis.removeEventListener('keydown', cancel, true); }, [removeCandidateId]);
  useEffect(() => { if (presentation && !grid?.placements.some(({ id }) => id === presentation.placementId)) setPresentation(null); }, [grid, presentation]);
  useEffect(() => () => {
    const active = dragRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.finish, true);
  }, []);
  useEffect(() => {
    if (!position || layout?.mode === 'narrow') return;
    const rectangle = inspectorRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    const next = {
      x: Math.max(8, Math.min(layout.width - rectangle.width - 8, position.x)),
      y: Math.max(8, Math.min(layout.height - 60 - rectangle.height, position.y)),
    };
    if (next.x === position.x && next.y === position.y) return;
    setPosition(next);
    try { globalThis.sessionStorage?.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* Session preference is optional. */ }
  }, [crop?.cropSession, layout?.height, layout?.mode, layout?.width, position, presentation, selected.length]);
  if (!grid) return null;
  const ordered = [...grid.placements].sort((left, right) => left.layer - right.layer);
  const layers = [...ordered].reverse();
  const editable = unlockedSelected.length === selected.length && unlockedSelected.length > 0;
  const transform = (operation) => controller.run((session) => unlockedSelected.length === 1
    ? session.transformPlacement({ gridId: grid.id, placementId: primary.id, expectedPlacement: primary, operation })
    : session.transformPlacements({ gridId: grid.id, placementIds: unlockedSelected.map(({ id }) => id), expectedPlacements: unlockedSelected, operation }));
  const duplicate = () => {
    const duplicatedIds = controller.run((session) => {
      const existingIds = new Set(session.getState().draft.grids.find(({ id }) => id === grid.id).placements.map(({ id }) => id));
      const committed = unlockedSelected.length === 1
        ? session.duplicatePlacement({ gridId: grid.id, placementId: primary.id, expectedPlacement: primary })
        : session.duplicatePlacements({ gridId: grid.id, placementIds: unlockedSelected.map(({ id }) => id), expectedPlacements: unlockedSelected });
      if (committed === false) return false;
      return session.getState().draft.grids.find(({ id }) => id === grid.id).placements
        .filter(({ id }) => !existingIds.has(id)).map(({ id }) => id);
    });
    if (Array.isArray(duplicatedIds) && duplicatedIds.length) controller.replaceSelection(duplicatedIds);
  };
  const removeSelection = () => {
    const removable = grid.placements.filter(({ id, locked }) => controller.selectedPlacementIds.includes(id) && !locked);
    if (!removable.length || removable.length !== selected.length) return;
    const committed = controller.run((session) => removable.length === 1
      ? session.removePlacement({ gridId: grid.id, placementId: removable[0].id, expectedPlacement: removable[0] })
      : session.removePlacements({ gridId: grid.id, placementIds: removable.map(({ id }) => id), expectedPlacements: removable }));
    if (committed !== false) controller.replaceSelection([]);
    setRemoveCandidateId(null);
  };
  const moveLayer = (operation) => {
    if (!editable) return;
    if (unlockedSelected.length === 1) {
      controller.run((session) => session.changePlacementLayer({ gridId: grid.id, placementId: primary.id, expectedPlacement: primary, expectedPlacements: systemWorkflowLayerTopologySnapshot(grid), operation }));
      return;
    }
    if (grid.placements.some(({ locked }) => locked)) return;
    const orderedIds = ordered.map(({ id }) => id);
    controller.run((session) => session.reorderPlacementLayers({ gridId: grid.id, expectedPlacements: systemWorkflowLayerTopologySnapshot(grid), orderedPlacementIds: reorderBlock(orderedIds, unlockedSelected.map(({ id }) => id), operation) }));
  };
  const availability = primary ? systemWorkflowLayerOperationAvailability(grid, primary.id) : { BACK: editable, BACKWARD: editable, FORWARD: editable, FRONT: editable };
  const beginPresentation = () => primary && setPresentation({ placementId: primary.id, frameId: primary.frameId, mat: structuredClone(primary.mat), backing: structuredClone(primary.backing), transparencyMode: primary.transparencyMode });
  const applyPresentation = () => {
    const placement = grid.placements.find(({ id }) => id === presentation?.placementId);
    if (!placement) return;
    controller.run((session) => session.setPlacementPresentation({ gridId: grid.id, placementId: placement.id, expectedPlacement: placement, presentation: { frameId: presentation.frameId, mat: presentation.mat, backing: presentation.backing, transparencyMode: presentation.transparencyMode } }));
    setPresentation(null);
  };
  const reorderFromDrop = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId || grid.placements.some(({ locked }) => locked)) return;
    const ids = ordered.map(({ id }) => id);
    const sourceIndex = ids.indexOf(sourceId); const targetIndex = ids.indexOf(targetId);
    ids.splice(targetIndex, 0, ids.splice(sourceIndex, 1)[0]);
    controller.run((session) => session.reorderPlacementLayers({ gridId: grid.id, expectedPlacements: systemWorkflowLayerTopologySnapshot(grid), orderedPlacementIds: ids }));
  };

  const beginPanelDrag = (event) => {
    if (layout?.mode === 'narrow' || event.button !== 0 || event.target.closest('button')) return;
    const rectangle = inspectorRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY };
    const start = { x: rectangle.left, y: rectangle.top };
    const clampPosition = (x, y) => ({
      x: Math.max(8, Math.min(globalThis.innerWidth - rectangle.width - 8, x)),
      y: Math.max(8, Math.min(globalThis.innerHeight - 60 - rectangle.height, y)),
    });
    const move = (pointerEvent) => {
      if (pointerEvent.pointerId !== event.pointerId) return;
      setPosition(clampPosition(start.x + pointerEvent.clientX - origin.x, start.y + pointerEvent.clientY - origin.y));
    };
    const finish = (pointerEvent) => {
      if (pointerEvent.pointerId !== event.pointerId) return;
      globalThis.removeEventListener('pointermove', move, true);
      globalThis.removeEventListener('pointerup', finish, true);
      globalThis.removeEventListener('pointercancel', finish, true);
      dragRef.current = null;
      setPosition((current) => { try { if (current) globalThis.sessionStorage?.setItem(POSITION_KEY, JSON.stringify(current)); } catch { /* Session preference is optional. */ } return current; });
    };
    dragRef.current = { move, finish };
    globalThis.addEventListener('pointermove', move, true);
    globalThis.addEventListener('pointerup', finish, true);
    globalThis.addEventListener('pointercancel', finish, true);
  };
  const panelStyle = layout?.mode !== 'narrow' && position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined;
  const panelHeader = <header className="system-workflow__layers-header" onPointerDown={beginPanelDrag}>
    <strong>LAYERS / THIS GRID{selected.length > 0 ? ` / ${selected.length} SELECTED` : ''}</strong>
    <button aria-label="Minimize Layers" onClick={onMinimize} title="Minimize Layers" type="button"><Minus size={15} /></button>
  </header>;

  if (crop?.cropSession) return <aside aria-label="Selection and layers inspector" className="system-workflow__inspector system-workflow__selection-inspector" data-obscured={obscuredByGridSwitcher || undefined} ref={inspectorRef} style={panelStyle}>{panelHeader}
    <section aria-label="Crop controls" className="system-workflow__crop-controls"><div><strong>Crop / drag image</strong><output>{Math.round(crop.cropSession.controlZoom * 100)}%</output></div>
      <input aria-label="Crop zoom" max="4" min="1" onChange={(event) => crop.updateCropZoom(Number(event.target.value))} step="0.05" type="range" value={crop.cropSession.controlZoom} />
      <footer><button onClick={crop.restoreNativeFit} type="button">Native fit</button><button onClick={crop.cancelCrop} type="button">Cancel</button><button onClick={crop.applyCrop} type="button">Done</button></footer>
    </section>
  </aside>;

  if (presentation) return <aside aria-label="Selection and layers inspector" className="system-workflow__inspector system-workflow__selection-inspector" data-obscured={obscuredByGridSwitcher || undefined} ref={inspectorRef} style={panelStyle}>{panelHeader}
    <section aria-label="Frame and mat controls" className="system-workflow__presentation-controls"><div className="system-workflow__presentation-fields">
      <label><span>Frame</span><select value={presentation.frameId} onChange={(event) => setPresentation((current) => ({ ...current, frameId: event.target.value }))}>{PRESENTATION_FRAMES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Mat</span><input checked={presentation.mat.enabled} onChange={(event) => setPresentation((current) => ({ ...current, mat: { ...current.mat, enabled: event.target.checked } }))} type="checkbox" /></label>
      <label><span>Mat color</span><input value={presentation.mat.color} onChange={(event) => setPresentation((current) => ({ ...current, mat: { ...current.mat, color: event.target.value } }))} type="color" /></label>
      <label><span>Backing</span><input checked={presentation.backing.enabled} onChange={(event) => setPresentation((current) => ({ ...current, backing: { ...current.backing, enabled: event.target.checked } }))} type="checkbox" /></label>
      <label><span>Backing color</span><input disabled={!presentation.backing.enabled} value={presentation.backing.color} onChange={(event) => setPresentation((current) => ({ ...current, backing: { ...current.backing, color: event.target.value } }))} type="color" /></label>
      <label><span>Transparency</span><select value={presentation.transparencyMode} onChange={(event) => setPresentation((current) => ({ ...current, transparencyMode: event.target.value }))}>{TRANSPARENCY.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div><footer><button onClick={() => setPresentation(null)} type="button">Cancel</button><button onClick={applyPresentation} type="button">Apply</button></footer></section>
  </aside>;

  return <aside aria-label="Selection and layers inspector" className="system-workflow__inspector system-workflow__selection-inspector" data-obscured={obscuredByGridSwitcher || undefined} ref={inspectorRef} style={panelStyle}>{panelHeader}
    {selected.length > 0 && <nav aria-label="Selection actions" className="system-workflow__selection-actions">
      <button aria-label="Rotate" disabled={!editable} onClick={() => transform(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.ROTATE)} title="Rotate" type="button"><RotateCw size={15} /></button>
      <button aria-label="Mirror horizontal" disabled={!editable} onClick={() => transform(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL)} title="Mirror horizontal" type="button"><FlipHorizontal2 size={15} /></button>
      <button aria-label="Mirror vertical" disabled={!editable} onClick={() => transform(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_VERTICAL)} title="Mirror vertical" type="button"><FlipVertical2 size={15} /></button>
      <button aria-label="Duplicate" disabled={!editable} onClick={duplicate} title="Duplicate" type="button"><Copy size={15} /></button>
      <button aria-label="Send to back" disabled={!availability.BACK} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.BACK)} title="Send to back" type="button"><ChevronsDown size={15} /></button>
      <button aria-label="Move backward" disabled={!availability.BACKWARD} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.BACKWARD)} title="Move backward" type="button"><ChevronDown size={15} /></button>
      <button aria-label="Move forward" disabled={!availability.FORWARD} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.FORWARD)} title="Move forward" type="button"><ChevronUp size={15} /></button>
      <button aria-label="Bring to front" disabled={!availability.FRONT} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.FRONT)} title="Bring to front" type="button"><ChevronsUp size={15} /></button>
      <button aria-label="Crop" disabled={!primary} onClick={() => onBeginCrop?.(primary)} title={primary ? 'Crop' : 'Crop requires one artwork'} type="button"><Crop size={15} /></button>
      <button aria-label="Frame and mat" disabled={!primary} onClick={beginPresentation} title={primary ? 'Frame and mat' : 'Frame and mat requires one artwork'} type="button"><Frame size={15} /></button>
    </nav>}
    <section className="system-workflow__layers">
      <div className="system-workflow__layer-list">{layers.map((layer) => {
        const asset = assetsById.get(layer.stableAssetId); const title = asset?.title || asset?.name || 'UNTITLED'; const confirming = removeCandidateId === layer.id;
        const removingSelectedGroup = confirming && selected.length > 1 && controller.selectedPlacementIds.includes(layer.id) && editable;
        return <div className="system-workflow__layer-row" data-confirming={confirming || undefined} data-selected={controller.selectedPlacementIds.includes(layer.id) || undefined}
          draggable={!grid.placements.some(({ locked }) => locked)} key={layer.id} onDragStart={(event) => event.dataTransfer.setData('text/x-inscape-layer', layer.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => reorderFromDrop(event.dataTransfer.getData('text/x-inscape-layer'), layer.id)}>
          <button className="system-workflow__layer-select" disabled={layer.locked} onClick={(event) => { controller.selectPlacement(layer.id, event.shiftKey); setRemoveCandidateId(null); }} type="button"><img alt="" src={sourceFor(asset)} /><span>{title}</span></button>
          <button aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${title}`} aria-pressed={layer.locked} className="system-workflow__layer-lock" onClick={() => { controller.toggleLock(layer); setRemoveCandidateId(null); }} title={layer.locked ? 'Unlock placement' : 'Lock placement'} type="button"><Lock size={13} /></button>
          <button aria-label={`Remove ${title} from Grid`} className="system-workflow__layer-remove" disabled={layer.locked} onClick={() => setRemoveCandidateId(layer.id)} title="Remove from Grid" type="button"><Trash2 size={14} /></button>
          {confirming && <div aria-label={removingSelectedGroup ? 'Remove selected placements from Grid' : `Remove ${title} from Grid`} className="system-workflow__remove-confirm" role="alertdialog"><img alt="" src={sourceFor(asset)} /><span>{removingSelectedGroup ? `Remove ${selected.length} selected?` : 'Remove from Grid?'}</span><button onClick={() => setRemoveCandidateId(null)} type="button">Cancel</button><button onClick={() => { if (removingSelectedGroup) { removeSelection(); return; } const committed = controller.run((session) => session.removePlacement({ gridId: grid.id, placementId: layer.id, expectedPlacement: layer })); if (committed !== false) controller.replaceSelection(controller.selectedPlacementIds.filter((id) => id !== layer.id)); setRemoveCandidateId(null); }} type="button">Remove</button></div>}
        </div>;
      })}</div>
    </section>
  </aside>;
}
