import { placementGroup, selectedPlacementGroup } from '../../systemWorkflow/domain/placementGroups.js';
import { useEffect, useState } from 'react';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import PlacementSizeControls from './PlacementSizeControls.jsx';
import ArtworkTransformTools from './ArtworkTransformTools.jsx';
import LibraryArtworkImage from './LibraryArtworkImage.jsx';
import { ContextToolContent, useContextToolTarget } from './ContextToolbar.jsx';
import { SharedDisplayToolContent } from './SharedDisplayTools.jsx';
import { ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';
import { displayTextLabel } from '../../systemWorkflow/domain/displayText.js';
import { addArticleToDisplay } from '../../text/textTransfer.js';
import {
  ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Copy, Crop, Eye, EyeOff, Lock, Trash2,
} from 'lucide-react';
import {
  SYSTEM_WORKFLOW_LAYER_OPERATIONS,
  systemWorkflowLayerOperationAvailability,
  systemWorkflowLayerTopologySnapshot,
} from '../../systemWorkflow/systemWorkflowLayer.js';

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
  controller, crop, onBeginCrop, onEditText, onArtworkInfo, toolLabel = 'Display', available = true }) {
  const [removeCandidateId, setRemoveCandidateId] = useState(null);
  const [gutter, setGutter] = useState('1');
  const [gutterMessage, setGutterMessage] = useState('');
  const toolTarget = useContextToolTarget();
  const grid = controller.selectedGrid;
  const selected = controller.selectedPlacements;
  const group = selectedPlacementGroup(grid, controller.selectedPlacementIds);
  const groupRequest = group && { gridId: grid.id, groupId: group.id, expectedGroup: group, expectedPlacements: selected };
  const unlockedSelected = selected.filter(({ locked }) => !locked);
  const primary = unlockedSelected.length === 1 ? unlockedSelected[0] : null;
  const textPlacement = selected.length === 1 && selected[0].kind === 'text' ? selected[0] : null;
  useEffect(() => { if (!removeCandidateId) return undefined; const cancel = (event) => event.key === 'Escape' && setRemoveCandidateId(null); globalThis.addEventListener('keydown', cancel, true); return () => globalThis.removeEventListener('keydown', cancel, true); }, [removeCandidateId]);
  useEffect(() => { if (authoringLocked) setRemoveCandidateId(null); }, [authoringLocked]);
  useEffect(() => {
    if (!available || toolTarget !== controller.moduleId) setRemoveCandidateId(null);
  }, [available, toolTarget, controller.moduleId]);
  if (!grid) return null;
  const addText = () => {
    if (authoringLocked) return;
    const id = controller.run(() => addArticleToDisplay(controller.store, controller.draft.profileAddress, { moduleId: controller.moduleId, gridId: grid.id }));
    if (id) { controller.replaceSelection([id]); onEditText?.(id); }
  };
  const applyGutters = () => {
    if (authoringLocked) return;
    setGutterMessage('');
    const committed = controller.run(session => {
      try {
        if (!gutter.trim()) throw new Error('Enter a gutter value.');
        return session.applyGutters({ gridId: grid.id, gutter: Number(gutter), expectedPlacements: grid.placements });
      } catch (error) { setGutterMessage(error.message); return false; }
    });
    if (committed) setGutterMessage('Gutters applied. Undo restores the previous spacing.');
  };
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
  const reorderFromDrop = (sourceId, targetId) => {
    if (authoringLocked || !sourceId || sourceId === targetId || grid.placements.some(({ locked }) => locked)) return;
    const ids = ordered.map(({ id }) => id);
    const sourceIndex = ids.indexOf(sourceId); const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(targetIndex, 0, ids.splice(sourceIndex, 1)[0]);
    controller.run((session) => session.reorderPlacementLayers({ gridId: grid.id, expectedPlacements: systemWorkflowLayerTopologySnapshot(grid), orderedPlacementIds: ids }));
  };

  const dock = content => <ContextToolContent target={controller.moduleId} label={toolLabel} available={available}>{content}</ContextToolContent>;
  const renderPanel = (content, surfaceClassName, tools) => <>{dock(tools)}<SharedDisplayToolContent id="layers" targetId={controller.moduleId} label={toolLabel} available={available}><section
    aria-label="Selection and layers inspector" className={`system-workflow__instrument-layers ${surfaceClassName}`}
    data-authoring-locked={authoringLocked || undefined}>{content}</section></SharedDisplayToolContent></>;

  const cropTools = crop?.cropSession && <div className="system-workflow__crop-controls"><div><strong>Crop / drag image</strong><output>{Math.round(crop.cropSession.controlZoom * 100)}%</output></div>
      <input aria-label="Crop zoom" max="4" min="1" onChange={(event) => crop.updateCropZoom(Number(event.target.value))} step="0.05" type="range" value={crop.cropSession.controlZoom} />
      <footer><button onClick={crop.restoreNativeFit} type="button">Native fit</button><button onClick={crop.cancelCrop} type="button">Cancel</button><button onClick={crop.applyCrop} type="button">Done</button></footer>
    </div>;

  const inspectPlacement = selected.length === 1 && selected[0].kind !== 'text' ? selected[0] : null;
  const changeInspection = (inspectionMode) => {
    if (!editable || !inspectPlacement) return;
    controller.run((session) => session.setPlacementInspection({
      gridId: grid.id, placementId: inspectPlacement.id, expectedPlacement: inspectPlacement,
      inspectionMode,
    }));
  };
  const inspectionSelector = <div className="system-workflow__inspection-selector" role="group" aria-label="Artwork inspection mode">
    <span>Inspect</span>
    {[['IN_PLACE', 'In place'], ['LIFT', 'Lift']].map(([mode, label]) => <button key={mode} type="button"
      disabled={!editable || !inspectPlacement}
      aria-pressed={Boolean(inspectPlacement && resolveInspectionMode(inspectPlacement) === mode)}
      title={mode === 'LIFT' ? 'Lift to centre' : 'Focus in place'}
      onClick={() => changeInspection(mode)}>{label}</button>)}
  </div>;

  const toolbar = <nav aria-label="Selection actions" className="system-workflow__selection-actions">
      {!textPlacement && <ArtworkTransformTools disabled={!editable} onTransform={transform} />}
      <button aria-label="Duplicate" disabled={!editable} onClick={duplicate} title="Duplicate" type="button"><Copy size={15} /></button>
      <button aria-label="Send to back" disabled={authoringLocked || !availability.BACK} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.BACK)} title="Send to back" type="button"><ChevronsDown size={15} /></button>
      <button aria-label="Move backward" disabled={authoringLocked || !availability.BACKWARD} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.BACKWARD)} title="Move backward" type="button"><ChevronDown size={15} /></button>
      <button aria-label="Move forward" disabled={authoringLocked || !availability.FORWARD} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.FORWARD)} title="Move forward" type="button"><ChevronUp size={15} /></button>
      <button aria-label="Bring to front" disabled={authoringLocked || !availability.FRONT} onClick={() => moveLayer(SYSTEM_WORKFLOW_LAYER_OPERATIONS.FRONT)} title="Bring to front" type="button"><ChevronsUp size={15} /></button>
      {!textPlacement && <button aria-label="Crop" disabled={authoringLocked || !primary} onClick={() => onBeginCrop?.(primary)} title="Crop artwork" type="button"><Crop size={15} /></button>}
    </nav>;
  return renderPanel(<>
    <button className="system-workflow__add-text" type="button" disabled={authoringLocked} onClick={addText}>Add text</button>
    <div className="system-workflow__layer-list" aria-label="Layers, front to back">{layers.map((layer) => {
        const asset = assetForPlacement(assetsById.get(layer.stableAssetId), layer); const title = layer.kind === 'text' ? displayTextLabel(layer.text) : asset?.title || asset?.name || 'UNTITLED'; const confirming = removeCandidateId === layer.id;
        const removingSelectedGroup = confirming && selected.length > 1 && controller.selectedPlacementIds.includes(layer.id) && editable;
        const hidden = controller.hiddenPlacementIds?.has(layer.id) || false;
        return <div className="system-workflow__layer-row" data-hidden={hidden || undefined} data-confirming={confirming || undefined} data-selected={controller.selectedPlacementIds.includes(layer.id) || undefined}
          draggable={!authoringLocked && !grid.placements.some(({ locked }) => locked)} key={layer.id} onDragStart={(event) => event.dataTransfer.setData('text/x-inscape-layer', layer.id)} onDragOver={(event) => { if (!authoringLocked) event.preventDefault(); }} onDrop={(event) => reorderFromDrop(event.dataTransfer.getData('text/x-inscape-layer'), layer.id)}>
          <button className="system-workflow__layer-select" disabled={layer.locked || hidden} onClick={(event) => { controller.selectPlacement(layer.id, event.shiftKey); setRemoveCandidateId(null); }} type="button">{layer.kind === 'text' ? <span aria-hidden="true">T</span> : <LibraryArtworkImage key={sourceFor(asset)} alt="" src={sourceFor(asset)} fileType={asset?.mediaFileType || asset?.assetRecord?.mediaFileType} />}<span>{placementGroup(grid, layer.id) ? `Group ${grid.groups.indexOf(placementGroup(grid, layer.id)) + 1} / ` : ''}{title}</span></button>
          <button aria-label={`${hidden ? 'Show' : 'Hide'} ${title} in editor`} aria-pressed={hidden} className="system-workflow__layer-visibility" disabled={authoringLocked}
            onClick={() => { controller.togglePlacementVisibility(layer); setRemoveCandidateId(null); }}
            title={`${hidden ? 'Show' : 'Hide'} in editor only; Preview and publication are unchanged`} type="button">{hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          <button aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${title}`} aria-pressed={layer.locked} className="system-workflow__layer-lock" disabled={authoringLocked} onClick={() => { controller.toggleLock(layer); setRemoveCandidateId(null); }} title={layer.locked ? 'Unlock placement' : 'Lock placement'} type="button"><Lock size={11} /></button>
          <button aria-label={`Remove ${title} from Grid`} className="system-workflow__layer-remove" disabled={authoringLocked || layer.locked} onClick={() => { if (placementGroup(grid, layer.id) && !controller.selectedPlacementIds.includes(layer.id)) controller.selectPlacement(layer.id); setRemoveCandidateId(layer.id); }} title="Remove from Grid" type="button"><Trash2 size={11} /></button>
          {confirming && <div aria-label={removingSelectedGroup ? 'Remove selected placements from Grid' : `Remove ${title} from Grid`} className="system-workflow__remove-confirm" role="alertdialog">{layer.kind === 'text' ? <span aria-hidden="true">T</span> : <LibraryArtworkImage key={sourceFor(asset)} alt="" src={sourceFor(asset)} fileType={asset?.mediaFileType || asset?.assetRecord?.mediaFileType} />}<span>{removingSelectedGroup ? `Remove ${selected.length} selected?` : 'Remove from Grid?'}</span><button onClick={() => setRemoveCandidateId(null)} type="button">Cancel</button><button onClick={() => { if (removingSelectedGroup) { removeSelection(); return; } const committed = controller.run((session) => session.removePlacement({ gridId: grid.id, placementId: layer.id, expectedPlacement: layer })); if (committed !== false) controller.replaceSelection(controller.selectedPlacementIds.filter((id) => id !== layer.id)); setRemoveCandidateId(null); }} type="button">Remove</button></div>}
        </div>;
      })}</div>
    {!layers.length && <p className="system-workflow__layer-hint">Add artwork from Library or add text.</p>}
    {selected.length > 0 ? <section className="system-workflow__layer-controls" aria-label="Selection properties">
      <h3>{group ? `Group / ${selected.length} layers` : 'Selection'}</h3>
      <button className="system-workflow__add-text" type="button" disabled={!editable || (!group && (selected.length < 2 || selected.some(item => item.kind === 'text' || placementGroup(grid, item.id))))}
        onClick={() => controller.run(session => group ? session.ungroupPlacements(groupRequest) : session.groupPlacements({ gridId: grid.id, placementIds: selected.map(item => item.id), expectedPlacements: selected }))}>{group ? 'Ungroup' : 'Group layers'}</button>
      {group && <p className="system-workflow__layer-hint">Moves and animates together. Ungroup to edit individual layers. Ungroup removes group effects and restores individual effects.</p>}
      {selected.length === 1 && <PlacementSizeControls placement={selected[0]} controller={controller} disabled={!editable} />}

      {inspectPlacement && inspectionSelector}
      {primary && !textPlacement && onArtworkInfo && <button type="button" className="system-workflow__add-text" onClick={onArtworkInfo}>Artwork info</button>}
      {primary && !textPlacement && <nav aria-label="Artwork placement" className="system-workflow__selection-actions system-workflow__placement-actions">
        {[['fit', 'Fit inside Display'], ['cover', 'Cover Display'], ['centre', 'Centre']].map(([mode, label]) => <button key={mode} type="button" disabled={!editable || !primary || Boolean(crop?.cropSession)} onClick={() => controller.run(session => {
          const dimensions = ownerSystemWorkflowAssetDimensions(assetForPlacement(assetsById.get(primary.stableAssetId), primary));
          return session.arrangePlacement({ gridId: grid.id, placementId: primary.id, expectedPlacement: primary, mode, aspectRatio: dimensions ? dimensions.width / dimensions.height : null });
        })}>{label}</button>)}
      </nav>}
      {textPlacement && <button className="system-workflow__add-text" type="button" disabled={authoringLocked || textPlacement.locked} onClick={() => onEditText?.(textPlacement.id)}>Edit Text</button>}

    </section> : <p className="system-workflow__layer-hint">Select a layer to edit its properties.</p>}
    <details className="system-workflow__composition-tools">
      <summary>Composition spacing</summary>
      <div className="system-workflow__gutter-controls">
        <label>Gutter <span>(canvas units)</span><input type="number" min="0" max="32" step="any" value={gutter}
          disabled={authoringLocked} onChange={event => { setGutter(event.target.value); setGutterMessage(''); }} /></label>
        <button type="button" onClick={applyGutters} disabled={authoringLocked || grid.placements.length < 2
          || grid.placements.some(item => item.locked || controller.hiddenPlacementIds?.has(item.id))}>Apply to all</button>
      </div>
      {gutterMessage && <p className="system-workflow__gutter-message" role="status">{gutterMessage}</p>}

    </details>
  </>, 'system-workflow__layers', cropTools || (selected.length ? toolbar : <p className="system-workflow__layer-hint">Select artwork to use its tools.</p>));
}

import { resolveInspectionMode } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
