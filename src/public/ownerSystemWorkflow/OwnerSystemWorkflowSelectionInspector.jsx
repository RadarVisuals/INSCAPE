import { useEffect, useState } from 'react';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import {
  ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Copy, Crop, Eye, EyeOff, FlipHorizontal2, FlipVertical2, Frame, Lock, RotateCw, Trash2,
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

export default function OwnerSystemWorkflowSelectionInspector({ assetsById, authoringLocked = false,
  controller, crop, onBeginCrop }) {
  const [removeCandidateId, setRemoveCandidateId] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const grid = controller.selectedGrid;
  const selected = controller.selectedPlacements;
  const unlockedSelected = selected.filter(({ locked }) => !locked);
  const primary = unlockedSelected.length === 1 ? unlockedSelected[0] : null;
  useEffect(() => { if (!removeCandidateId) return undefined; const cancel = (event) => event.key === 'Escape' && setRemoveCandidateId(null); globalThis.addEventListener('keydown', cancel, true); return () => globalThis.removeEventListener('keydown', cancel, true); }, [removeCandidateId]);
  useEffect(() => { if (authoringLocked) { setPresentation(null); setRemoveCandidateId(null); } }, [authoringLocked]);
  useEffect(() => { if (presentation && !grid?.placements.some(({ id }) => id === presentation.placementId)) setPresentation(null); }, [grid, presentation]);
  if (!grid) return null;
  const ordered = [...grid.placements].sort((left, right) => left.layer - right.layer);
  const layers = [...ordered].reverse();
  const editable = !authoringLocked && unlockedSelected.length === selected.length && unlockedSelected.length > 0;
  const transform = (operation) => controller.run((session) => unlockedSelected.length === 1
    ? session.transformPlacement({ gridId: grid.id, placementId: primary.id, expectedPlacement: primary, operation })
    : session.transformPlacements({ gridId: grid.id, placementIds: unlockedSelected.map(({ id }) => id), expectedPlacements: unlockedSelected, operation }));
  const duplicate = () => {
    if (authoringLocked) return;
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
    if (authoringLocked) return;
    const removable = grid.placements.filter(({ id, locked }) => controller.selectedPlacementIds.includes(id) && !locked);
    if (!removable.length || removable.length !== selected.length) return;
    const committed = controller.run((session) => removable.length === 1
      ? session.removePlacement({ gridId: grid.id, placementId: removable[0].id, expectedPlacement: removable[0] })
      : session.removePlacements({ gridId: grid.id, placementIds: removable.map(({ id }) => id), expectedPlacements: removable }));
    if (committed !== false) controller.replaceSelection([]);
    setRemoveCandidateId(null);
  };
  const moveLayer = (operation) => {
    if (authoringLocked || !editable) return;
    if (unlockedSelected.length === 1) {
      controller.run((session) => session.changePlacementLayer({ gridId: grid.id, placementId: primary.id, expectedPlacement: primary, expectedPlacements: systemWorkflowLayerTopologySnapshot(grid), operation }));
      return;
    }
    if (grid.placements.some(({ locked }) => locked)) return;
    const orderedIds = ordered.map(({ id }) => id);
    controller.run((session) => session.reorderPlacementLayers({ gridId: grid.id, expectedPlacements: systemWorkflowLayerTopologySnapshot(grid), orderedPlacementIds: reorderBlock(orderedIds, unlockedSelected.map(({ id }) => id), operation) }));
  };
  const availability = primary ? systemWorkflowLayerOperationAvailability(grid, primary.id) : { BACK: editable, BACKWARD: editable, FORWARD: editable, FRONT: editable };
  const beginPresentation = () => !authoringLocked && primary && setPresentation({ placementId: primary.id, frameId: primary.frameId, mat: structuredClone(primary.mat), backing: structuredClone(primary.backing), transparencyMode: primary.transparencyMode });
  const applyPresentation = () => {
    if (authoringLocked) return;
    const placement = grid.placements.find(({ id }) => id === presentation?.placementId);
    if (!placement) return;
    controller.run((session) => session.setPlacementPresentation({ gridId: grid.id, placementId: placement.id, expectedPlacement: placement, presentation: { frameId: presentation.frameId, mat: presentation.mat, backing: presentation.backing, transparencyMode: presentation.transparencyMode, inspectionMode: placement.inspectionMode || 'IN_PLACE' } }));
    setPresentation(null);
  };
  const reorderFromDrop = (sourceId, targetId) => {
    if (authoringLocked || !sourceId || sourceId === targetId || grid.placements.some(({ locked }) => locked)) return;
    const ids = ordered.map(({ id }) => id);
    const sourceIndex = ids.indexOf(sourceId); const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(targetIndex, 0, ids.splice(sourceIndex, 1)[0]);
    controller.run((session) => session.reorderPlacementLayers({ gridId: grid.id, expectedPlacements: systemWorkflowLayerTopologySnapshot(grid), orderedPlacementIds: ids }));
  };

  const renderPanel = (content, surfaceClassName) => <section
    aria-label="Selection and layers inspector" className={`system-workflow__instrument-layers ${surfaceClassName}`}
    data-authoring-locked={authoringLocked || undefined}>{content}</section>;

  if (crop?.cropSession) return renderPanel(<><div><strong>Crop / drag image</strong><output>{Math.round(crop.cropSession.controlZoom * 100)}%</output></div>
      <input aria-label="Crop zoom" max="4" min="1" onChange={(event) => crop.updateCropZoom(Number(event.target.value))} step="0.05" type="range" value={crop.cropSession.controlZoom} />
      <footer><button onClick={crop.restoreNativeFit} type="button">Native fit</button><button onClick={crop.cancelCrop} type="button">Cancel</button><button onClick={crop.applyCrop} type="button">Done</button></footer>
    </>, 'system-workflow__crop-controls');

  if (presentation) return renderPanel(<><div className="system-workflow__presentation-fields">
      <label><span>Frame</span><select value={presentation.frameId} onChange={(event) => setPresentation((current) => ({ ...current, frameId: event.target.value }))}>{PRESENTATION_FRAMES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Mat</span><input checked={presentation.mat.enabled} onChange={(event) => setPresentation((current) => ({ ...current, mat: { ...current.mat, enabled: event.target.checked } }))} type="checkbox" /></label>
      <label><span>Mat color</span><input value={presentation.mat.color} onChange={(event) => setPresentation((current) => ({ ...current, mat: { ...current.mat, color: event.target.value } }))} type="color" /></label>
      <label><span>Backing</span><input checked={presentation.backing.enabled} onChange={(event) => setPresentation((current) => ({ ...current, backing: { ...current.backing, enabled: event.target.checked } }))} type="checkbox" /></label>
      <label><span>Backing color</span><input disabled={!presentation.backing.enabled} value={presentation.backing.color} onChange={(event) => setPresentation((current) => ({ ...current, backing: { ...current.backing, color: event.target.value } }))} type="color" /></label>
      <label><span>Transparency</span><select value={presentation.transparencyMode} onChange={(event) => setPresentation((current) => ({ ...current, transparencyMode: event.target.value }))}>{TRANSPARENCY.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div><footer><button onClick={() => setPresentation(null)} type="button">Cancel</button><button onClick={applyPresentation} type="button">Apply</button></footer>
  </>, 'system-workflow__presentation-controls');

  const inspectPlacement = selected.length === 1 ? selected[0] : null;
  const changeInspection = (inspectionMode) => {
    if (!editable || !inspectPlacement) return;
    controller.run((session) => session.setPlacementPresentation({
      gridId: grid.id, placementId: inspectPlacement.id, expectedPlacement: inspectPlacement,
      presentation: { frameId: inspectPlacement.frameId, mat: inspectPlacement.mat,
        backing: inspectPlacement.backing, transparencyMode: inspectPlacement.transparencyMode, inspectionMode },
    }));
  };
  const inspectionSelector = <div className="system-workflow__inspection-selector" role="group" aria-label="Artwork inspection mode">
    <span>Inspect</span>
    {[['IN_PLACE', 'In place'], ['LIFT', 'Lift']].map(([mode, label]) => <button key={mode} type="button"
      disabled={!editable || !inspectPlacement}
      aria-pressed={Boolean(inspectPlacement && (inspectPlacement.inspectionMode || 'IN_PLACE') === mode)}
      title={mode === 'LIFT' ? 'Lift to centre' : 'Focus in place'}
      onClick={() => changeInspection(mode)}>{label}</button>)}
  </div>;

  const toolbar = <nav aria-label="Selection actions" className="system-workflow__selection-actions">
      <button aria-label="Rotate" disabled={!editable} onClick={() => transform(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.ROTATE)} title="Rotate" type="button"><RotateCw size={15} /></button>
      <button aria-label="Mirror horizontal" disabled={!editable} onClick={() => transform(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL)} title="Mirror horizontal" type="button"><FlipHorizontal2 size={15} /></button>
      <button aria-label="Mirror vertical" disabled={!editable} onClick={() => transform(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_VERTICAL)} title="Mirror vertical" type="button"><FlipVertical2 size={15} /></button>
      <button aria-label="Duplicate" disabled={!editable} onClick={duplicate} title="Duplicate" type="button"><Copy size={15} /></button>
      <button aria-label="Send to back" disabled={authoringLocked || !availability.BACK} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.BACK)} title="Send to back" type="button"><ChevronsDown size={15} /></button>
      <button aria-label="Move backward" disabled={authoringLocked || !availability.BACKWARD} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.BACKWARD)} title="Move backward" type="button"><ChevronDown size={15} /></button>
      <button aria-label="Move forward" disabled={authoringLocked || !availability.FORWARD} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.FORWARD)} title="Move forward" type="button"><ChevronUp size={15} /></button>
      <button aria-label="Bring to front" disabled={authoringLocked || !availability.FRONT} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.FRONT)} title="Bring to front" type="button"><ChevronsUp size={15} /></button>
      <button aria-label="Crop" disabled={authoringLocked || !primary} onClick={() => onBeginCrop?.(primary)} title={primary ? 'Crop' : 'Crop requires one artwork'} type="button"><Crop size={15} /></button>
      <button aria-label="Frame and mat" disabled={authoringLocked || !primary} onClick={beginPresentation} title={primary ? 'Frame and mat' : 'Frame and mat requires one artwork'} type="button"><Frame size={15} /></button>
    </nav>;
  return renderPanel(<><div className="system-workflow__layer-controls">{toolbar}{inspectionSelector}</div><div className="system-workflow__layer-list">{layers.map((layer) => {
        const asset = assetForPlacement(assetsById.get(layer.stableAssetId), layer); const title = asset?.title || asset?.name || 'UNTITLED'; const confirming = removeCandidateId === layer.id;
        const removingSelectedGroup = confirming && selected.length > 1 && controller.selectedPlacementIds.includes(layer.id) && editable;
        const hidden = controller.hiddenPlacementIds?.has(layer.id) || false;
        return <div className="system-workflow__layer-row" data-hidden={hidden || undefined} data-confirming={confirming || undefined} data-selected={controller.selectedPlacementIds.includes(layer.id) || undefined}
          draggable={!authoringLocked && !grid.placements.some(({ locked }) => locked)} key={layer.id} onDragStart={(event) => event.dataTransfer.setData('text/x-inscape-layer', layer.id)} onDragOver={(event) => { if (!authoringLocked) event.preventDefault(); }} onDrop={(event) => reorderFromDrop(event.dataTransfer.getData('text/x-inscape-layer'), layer.id)}>
          <button className="system-workflow__layer-select" disabled={layer.locked || hidden} onClick={(event) => { controller.selectPlacement(layer.id, event.shiftKey); setRemoveCandidateId(null); }} type="button"><img alt="" src={sourceFor(asset)} /><span>{title}</span></button>
          <button aria-label={`${hidden ? 'Show' : 'Hide'} ${title} in editor`} aria-pressed={hidden} className="system-workflow__layer-visibility" disabled={authoringLocked}
            onClick={() => { controller.togglePlacementVisibility(layer); setRemoveCandidateId(null); }}
            title={`${hidden ? 'Show' : 'Hide'} in editor only; Preview and publication are unchanged`} type="button">{hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          <button aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${title}`} aria-pressed={layer.locked} className="system-workflow__layer-lock" disabled={authoringLocked} onClick={() => { controller.toggleLock(layer); setRemoveCandidateId(null); }} title={layer.locked ? 'Unlock placement' : 'Lock placement'} type="button"><Lock size={11} /></button>
          <button aria-label={`Remove ${title} from Grid`} className="system-workflow__layer-remove" disabled={authoringLocked || layer.locked} onClick={() => setRemoveCandidateId(layer.id)} title="Remove from Grid" type="button"><Trash2 size={11} /></button>
          {confirming && <div aria-label={removingSelectedGroup ? 'Remove selected placements from Grid' : `Remove ${title} from Grid`} className="system-workflow__remove-confirm" role="alertdialog"><img alt="" src={sourceFor(asset)} /><span>{removingSelectedGroup ? `Remove ${selected.length} selected?` : 'Remove from Grid?'}</span><button onClick={() => setRemoveCandidateId(null)} type="button">Cancel</button><button onClick={() => { if (removingSelectedGroup) { removeSelection(); return; } const committed = controller.run((session) => session.removePlacement({ gridId: grid.id, placementId: layer.id, expectedPlacement: layer })); if (committed !== false) controller.replaceSelection(controller.selectedPlacementIds.filter((id) => id !== layer.id)); setRemoveCandidateId(null); }} type="button">Remove</button></div>}
        </div>;
      })}</div></>, 'system-workflow__layers');
}
