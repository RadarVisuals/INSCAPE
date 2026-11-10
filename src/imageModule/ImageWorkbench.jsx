import { lazy, Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Crop, ChevronLeft, ZoomIn, Shrink, Expand } from 'lucide-react';
import ImageWindow from './ImageWindow.jsx';
import ImageArtwork from './ImageArtwork.jsx';
import { useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import ArtworkTransformTools from '../public/ownerSystemWorkflow/ArtworkTransformTools.jsx';
import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { resolveImageLibraryArtwork } from './imageLibraryArtwork.js';
import { createSystemWorkflowCropSession, createSystemWorkflowCropPanGesture, updateSystemWorkflowCropPanGesture, setSystemWorkflowCropZoom, nudgeSystemWorkflowCrop } from '../systemWorkflow/systemWorkflowCrop.js';
import { projectSystemWorkflowTransform, unprojectSystemWorkflowCrop, transformArtwork } from '../systemWorkflow/systemWorkflowTransform.js';
import { createImagePresentation, imageFocusEntry, MAX_IMAGE_MODULES, IMAGE_FILL_CROP, imageSizeLimits } from './imageModule.js';
import { saveImageModule, prepareImageResize, duplicateImageModule } from './imageModuleSession.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { moveWorkbenchSelection } from '../systemWorkflow/moveWorkbenchSelection.js';
import { useWorkbenchActions, useWorkbenchView, useWorkbenchInspectionAction, useArtworkOpener, useClosedArtworkLayout, useWorkbenchToolSource } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useWorkbenchMiniature } from '../public/ownerSystemWorkflow/workbenchMiniatures.js';
import { SharedDisplayToolContent } from '../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import { ArtworkInfoButton, LayerNameInput } from '../public/ownerSystemWorkflow/ArtworkToolbarControls.jsx';
import { OwnerSystemWorkflowMetadataContent } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';
import { createProfileDocumentV9AssetDossier } from '../profileDocument/components/profileDocumentV9FocusViewModel.js';
import ImageLift from './ImageLift.jsx';
import { projectedSvgArtworkFor } from '../artwork/ProjectedSvgArtwork.jsx';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import { useEditorCells } from '../reception/EditorCellsContext.jsx';
import { receptionMemberAnchor } from '../reception/editorCellGeometry.js';
import './imageModule.css';

const LibraryPicker = lazy(() => import('../library/ProfileLibraryPicker.jsx'));

const ImageInstance = memo(function ImageInstance({ record, index, store, profileAddress, library, registerTarget, initialPresentation, onPresentationChange, onActivate, suspended, viewport, reducedMotion, canDuplicate, onDuplicated, focusOnMount = false, initiallyOpenId, savedLayout }) {
  const [presentation, setPresentation] = useState(() => ({ ...(initialPresentation || createImagePresentation(record.id, index)), ...(initiallyOpenId === record.id ? { open: true } : {}) }));
  useArtworkOpener(record.id, () => setPresentation(current => ({ ...current, open: true })));
  useClosedArtworkLayout(presentation, setPresentation, savedLayout?.imageModules?.find(item => item.id === record.id));
  const [cropState, setCrop] = useState(null), [inspect, setInspect] = useState(false), [failure, setFailure] = useState(null);
  const error = failure?.message || '';
  const setError = useCallback((message, surface = 'actions') => setFailure(message ? { message, surface } : null), []);
  const [replacement, setReplacement] = useState(null);
  const replacementRef = useRef(null), replacementTarget = useRef(null);
  const [recoveryHost, setRecoveryHost] = useState(null);
  const [inspectionRecoveryHost, setInspectionRecoveryHost] = useState(null);
  useLayoutEffect(() => {
    // Workbench's native focus listener runs before React's portal bubbling.
    // Reaching Retry must not turn keyboard focus into an artwork selection.
    const stop = event => event.stopPropagation();
    recoveryHost?.addEventListener('focusin', stop);
    return () => recoveryHost?.removeEventListener('focusin', stop);
  }, [recoveryHost]);

  const source = useRef(null), drag = useRef(null), shortcut = useRef(null), latest = useRef(record), live = useRef(true);
  const imageRequest = useRef(0);
  const pointerFocus = useRef(false);
  const cropFocusHost = useRef(null);
  latest.current = record;
  const activeTarget = useContextToolTarget();
  const { getPresentation, setSelection, focusModules } = useWorkbenchActions();
  const artwork = record.artwork;
  const crop = cropState?.expected === record && cropState?.placementId === artwork?.id ? cropState : null;
  const cropping = Boolean(crop);
  useWorkbenchMiniature(record.id, useMemo(() => ({ kind: 'image', record, artwork, crop: crop?.previewCrop ?? artwork?.crop }), [record, artwork, crop?.previewCrop]));
  const workbenchView = useWorkbenchView();
  const cells = useEditorCells();
  const ownerCell = cells?.cells.find(cell => cell.members.includes(record.id));
  const sizeLimits = imageSizeLimits(Boolean(ownerCell));
  const presented = Boolean(workbenchView.presentationTransforms?.[record.id]);
  const dossier = useMemo(() => createProfileDocumentV9AssetDossier(artwork?.asset), [artwork?.asset]);
  const editable = Boolean(store) && !suspended && !presented && !ownerCell?.lockedMembers?.includes(record.id);
  const rectangle = crop?.mask || { left: 0, top: 0, width: record.width, height: record.height };
  const liftEntry = useMemo(() => artwork ? imageFocusEntry(artwork) : null, [artwork]);
  const inactive = suspended || !presentation.open;
  const cropInProgress = useRef(crop);
  cropInProgress.current = crop;
  useEffect(() => store?.guardWorkbenchTransition?.(() => cropInProgress.current
    ? 'Finish or cancel the Image crop before switching Workbenches.' : null), [store]);
  const prepareInspection = () => {
    if (liftEntry && !inactive && !crop && !inspect && !reducedMotion)
      projectedSvgArtworkFor(source.current, liftEntry.media.src)?.prepareImages();
  };
  const inspectArtwork = () => {
    if (!liftEntry || inactive || crop || inspect) return false;
    prepareInspection(); setInspect(true); return true;
  };
  useWorkbenchInspectionAction(record.id, inspectArtwork);
  const releaseInspection = () => {
    if (liftEntry && !inspect) projectedSvgArtworkFor(source.current, liftEntry.media.src)?.releaseImages();
  };
  useEffect(() => {
    const artwork = liftEntry && projectedSvgArtworkFor(source.current, liftEntry.media.src);
    if (inactive || cropping) artwork?.releaseImages();
    return () => artwork?.releaseImages();
  }, [liftEntry, inactive, cropping]);
  useEffect(() => { live.current = true; return () => { live.current = false; imageRequest.current += 1; }; }, []);
  useEffect(() => { if (focusOnMount) source.current?.focus({ preventScroll: true }); }, [focusOnMount]);
  useEffect(() => {
    imageRequest.current += 1;
    setCrop(null); setInspect(false); drag.current = null;
  }, [record]);
  useEffect(() => {
    if (inactive || store && activeTarget !== record.id) { setCrop(null); drag.current = null; }
    if (inactive) { setInspect(false); }
  }, [inactive, activeTarget, record.id, store]);
  useEffect(() => { imageRequest.current += 1; }, [inactive, artwork?.id, editable]);
  const replacementActive = Boolean(replacement && replacement.expected === record && replacement.artworkId === artwork?.id
    && editable && !inactive && !crop && !inspect && activeTarget === record.id);
  replacementRef.current = replacementActive ? replacement : null;
  useEffect(() => { if (replacement && !replacementActive) setReplacement(null); }, [replacement, replacementActive]);
  useEffect(() => {
    const cancelPan = () => { drag.current = null; };
    addEventListener('blur', cancelPan);
    return () => removeEventListener('blur', cancelPan);
  }, []);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const layout = useCallback(({ left, top }) => setPresentation(current => current.position.left === left && current.position.top === top ? current : { ...current, position: { left, top } }), []);
  const beginMove = () => {
    if (!store) return layout;
    const generation = store.getGeneration();
    return position => {
      try {
        moveWorkbenchSelection(store, profileAddress, [{ id: record.id, from: presentation.position, ...position }], getPresentation?.(), generation);
        layout(position);
        setError('');
      } catch (error) { setError(error.message); }
    };
  };
  const save = useCallback((next, expected = latest.current, errorSurface = 'actions', workbench) => {
    if (!live.current || !store || suspended) return false;
    try {
      if (!saveImageModule(store, profileAddress, expected, next, workbench)) throw new Error('Image was not saved. Your saved work is unchanged; try the edit again.');
      latest.current = next; setError(''); return true;
    } catch (e) { setError(e.message, errorSurface); return false; }
  }, [store, profileAddress, suspended, setError]);
  const changeArtwork = (change, expected = record) => save({ ...expected, artwork: { ...expected.artwork, ...change } }, expected);
  // Fit in Bento targets the owning cell, including an independently moved or
  // resized Image. Frame and fitting mode save together through native history.
  const fitImage = crop => {
    if (!artwork || !editable) return;
    const workbench = getPresentation?.() || store.getDraft().workbench;
    const ownerFrame = ownerCell && workbench.shapes?.find(item => item.id === ownerCell.id)?.window;
    const anchor = receptionMemberAnchor(ownerCell, [record.id]);
    const frame = ownerFrame && anchor ? { left: ownerFrame.left + anchor.paddingX, top: ownerFrame.top + anchor.paddingY,
      width: ownerFrame.width - 2 * anchor.paddingX, height: ownerFrame.height - 2 * anchor.paddingY } : ownerFrame;
    if (frame && (frame.width < sizeLimits.minimumWidth || frame.height < sizeLimits.minimumHeight)) {
      setError('Use less cell padding or enlarge the cell to fit this image.'); return;
    }
    const next = { ...record, ...(frame ? { width: Math.round(frame.width), height: Math.round(frame.height) } : {}),
      artwork: { ...artwork, crop } };
    const position = frame && { left: frame.left, top: frame.top };
    const placement = frame ? { ...workbench, imageModules: workbench.imageModules.map(item => item.id === record.id ? { ...item, position } : item) } : undefined;
    if (save(next, record, 'actions', placement) && position) {
      const committed = store.getSnapshot().workbench.imageModules.find(item => item.id === record.id)?.position;
      layout(committed || position);
    }
  };
  const duplicate = () => {
    if (!editable || !live.current || crop || !canDuplicate) return;
    const id = duplicateImageModule(store, profileAddress, record, { workbench: getPresentation?.(), position: presentation.position });
    setError(''); onDuplicated(id); onActivate?.(id); setSelection?.([id]);
  };
  const acceptImage = useCallback(async (input, dimensions, isCurrent = () => true) => {
    if (!editable || !presentation.open || !live.current || !isCurrent()) return false;
    const current = latest.current;
    const request = ++imageRequest.current;
    try {
      const newArtwork = await resolveImageLibraryArtwork(input, dimensions, Boolean(ownerCell));
      if (!live.current || imageRequest.current !== request || latest.current !== current || !isCurrent()) return false;
      const next = { ...current, artwork: newArtwork };
      if (!save(next, current)) return false;
      onActivate?.(record.id); return true;
    } catch (e) { if (live.current && imageRequest.current === request) setError(e.message); return false; }
  }, [editable, presentation.open, save, onActivate, record.id, setError, ownerCell]);
  useEffect(() => {
    if (!editable || !presentation.open || !registerTarget || inspect || cropping) return;
    registerTarget(record.id, { get node() { return source.current; }, label: artwork ? 'Replace image' : 'Use image', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  }, [editable, presentation.open, registerTarget, record.id, acceptImage, inspect, cropping, artwork]);
  const closeReplacement = () => {
    const trigger = replacementRef.current?.trigger;
    replacementRef.current = null; setReplacement(null);
    requestAnimationFrame(() => (trigger?.isConnected ? trigger : source.current)?.focus({ preventScroll: true }));
  };
  const openReplacement = event => {
    if (!library || !editable || inactive || crop || inspect) return;
    const request = { expected: record, artworkId: artwork?.id, trigger: event.currentTarget };
    replacementRef.current = request; setReplacement(request);
    replacementTarget.current = { captureTarget: () => ({
      async placeAsset(input, dimensions) {
        const current = () => replacementRef.current === request && live.current && latest.current === request.expected;
        if (!current()) return false;
        const saved = await acceptImage(input, dimensions, current);
        if (saved) closeReplacement();
        return saved;
      },
    }) };
  };
  const replacementButton = (compact = false) => library && <button type="button"
    className={compact ? 'editor-object-toolbar-button' : 'workflow-tactile-control'}
    disabled={!editable || Boolean(crop || inspect)} onClick={openReplacement}>{artwork ? 'Replace image' : 'Choose image'}</button>;
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'image', record });
  const beginCrop = event => {
    if (!artwork || !editable) return;
    cropFocusHost.current = event?.currentTarget.closest('[data-workbench-inspector], [role="toolbar"]');
    const session = createSystemWorkflowCropSession(artwork, { stableAssetId: artwork.asset.stableAssetId, width: artwork.asset.media.width, height: artwork.asset.media.height },
      { left: 0, top: 0, width: record.width, height: record.height });
    setCrop({ ...session, expected: record });
  };
  const visualCrop = crop && projectSystemWorkflowTransform(artwork.transform, crop.media, crop.previewCrop);
  const updateVisualCrop = value => setCrop(current => current && ({ ...current, previewCrop: unprojectSystemWorkflowCrop(artwork.transform, value) }));
  const restoreCropFocus = () => {
    const host = cropFocusHost.current;
    cropFocusHost.current = null;
    requestAnimationFrame(() => {
      if (host?.isConnected && document.activeElement === document.body)
        host.querySelector('[data-image-crop-trigger]:not(:disabled)')?.focus({ preventScroll: true });
    });
  };
  const applyCrop = value => { if (crop && changeArtwork({ crop: value }, crop.expected)) { setCrop(null); drag.current = null; restoreCropFocus(); } };
  const cancelCrop = () => { setCrop(null); drag.current = null; restoreCropFocus(); };
  const cropKeyDown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelCrop(); } };
  const fitControls = (compact = false) => <>
    <button className={compact ? 'editor-object-toolbar-button' : 'workflow-tactile-control'} type="button" disabled={!artwork} aria-pressed={Boolean(artwork && artwork.crop === null)}
      aria-label={ownerCell ? 'Fit cell' : 'Fit inside'}
      title={ownerCell ? 'Show the complete image centred inside this cell.' : 'Show the complete image inside its frame.'}
      onClick={() => fitImage(null)}><Shrink size={16} />{compact ? 'Fit' : ownerCell ? 'Fit cell' : 'Fit inside'}</button>
    <button className={compact ? 'editor-object-toolbar-button' : 'workflow-tactile-control'} type="button" disabled={!artwork} aria-pressed={Boolean(artwork?.crop)}
      aria-label={ownerCell ? 'Fill cell' : 'Fill canvas'}
      title={ownerCell ? 'Fill this cell with a centred crop. Edges may be cropped.' : 'Fill the image frame with a centred crop. Edges may be cropped.'}
      onClick={() => fitImage({ ...IMAGE_FILL_CROP })}><Expand size={16} />{compact ? 'Fill' : ownerCell ? 'Fill cell' : 'Fill canvas'}</button>
  </>;
  const cropButton = <button className="editor-object-toolbar-button" type="button" data-image-crop-trigger aria-label="Crop" title="Crop" disabled={!artwork} onClick={beginCrop}><Crop size={16} />Crop</button>;
  const cropCompletion = (compact = false) => <>
    <button className={compact ? 'editor-object-toolbar-button' : 'workflow-tactile-control'} type="button" onKeyDown={cropKeyDown} onClick={cancelCrop}>Cancel</button>
    <button className={compact ? 'editor-object-toolbar-button' : 'workflow-tactile-control'} type="button" onKeyDown={cropKeyDown} onClick={() => applyCrop(crop.previewCrop)}>Done</button>
  </>;
  const cropZoom = crop && <input type="range" aria-label="Crop zoom" min="1" max="4" step="0.05" value={visualCrop.crop.zoom} onKeyDown={cropKeyDown}
    onChange={event => updateVisualCrop(setSystemWorkflowCropZoom(visualCrop.crop, { ...crop.media, ...visualCrop.dimensions }, rectangle, Number(event.target.value)))} />;
  const resize = (newSize, position) => {
    cancelCrop();
    const saved = commitWorkbenchSelectionResize([{ ...resizeTarget, id: record.id, ...position, ...newSize, getPresentation }]);
    if (saved) layout(position);
    return saved;
  };
  const resizeTarget = useMemo(() => ({ enabled: editable && !cropping && !inspect,
    reflow: editable,
    expected: record, store, profileAddress, layoutKey: 'imageModules', commit: commitWorkbenchSelectionResize, prepare: prepareImageResize, applyFrame: layout, reportError: setError,
    ...sizeLimits,
  }), [editable, cropping, inspect, record, store, profileAddress, layout, setError, sizeLimits]);
  // Only the tool's presentation moves to the shared dock. Validation, saving and undo remain with this Image.
  useWorkbenchToolSource(record.id, { actions: { disabled: !editable || Boolean(crop || inspect),
    duplicate: { disabled: !canDuplicate, reason: !canDuplicate ? 'At most sixteen Image modules are supported.' : undefined, run: duplicate } },
    image: ({ transform, position, information }) => <section key={record.id} className="workbench-image-inspector" data-workbench-inspection-target={record.id} aria-label={`${record.name} Image settings`}>
    {!presentation.open ? <p>Open this Image to edit its settings.</p>
      : !editable || inspect ? <p>Image settings are unavailable while viewing this artwork.</p>
      : <>
        {crop ? <section className="workbench-inspector-section" aria-label="Crop Image" onKeyDown={cropKeyDown}>
          <p>Drag the image to adjust the crop.</p>
          <div className="workbench-inspector-row"><span>Crop zoom</span><output>{Math.round(visualCrop.crop.zoom * 100)}%</output></div>
          {cropZoom}
          <div className="workbench-inspector-actions"><button className="workflow-tactile-control" type="button" onClick={() => applyCrop(null)}>Native fit</button></div>
          <div className="workbench-inspector-actions">{cropCompletion()}</div>
        </section> : <>
          <div className="workbench-inspector-actions" role="group" aria-label="Image fit">{fitControls()}</div>
          <div className="workbench-inspector-actions"><button className="workflow-tactile-control" type="button" data-image-crop-trigger disabled={!artwork} onClick={beginCrop}><Crop />Crop</button>{replacementButton()}</div>
          {position}{transform}
          <div className="image-inspector-transforms" role="group" aria-label="Image transforms">
            <ArtworkTransformTools disabled={!artwork} onTransform={operation => changeArtwork({ transform: transformArtwork(artwork.transform, operation) })} />
            <button className="workflow-tactile-control" type="button" aria-label="Inspect Image" aria-keyshortcuts="I" title="Inspect Image (I)" disabled={!artwork} onClick={inspectArtwork}
              onPointerEnter={prepareInspection} onFocus={prepareInspection} onPointerLeave={releaseInspection} onBlur={releaseInspection}><ZoomIn /></button>
          </div>
        </>}
        {failure?.surface === 'actions' && <p role="alert" className="image-module__error">{error}</p>}
        {!crop && <>
        {information}
        <label className="image-module__publication"><input type="checkbox" checked={record.visibility === 'PUBLIC'} onChange={event => save({ ...record, visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' }, record, 'settings')} />Include Image in publication</label>
        {ownerCell && <div className="workbench-inspector-actions"><button className="workflow-tactile-control" type="button" onClick={() => cells.leaveCell(true)}><ChevronLeft />Back to cell</button></div>}
        </>}
      </>}
    {failure?.surface === 'settings' && <p role="alert" className="image-module__error">{error}</p>}
  </section> });
  return <div className="image-module" data-workbench-module="image" data-image-module={record.id}
    onPointerDownCapture={event => {
      // Finish native focus before activation mounts the companion tools.
      // Otherwise the nested focus event flushes their pending React layout
      // while the pointer gesture is still starting.
      // Shift belongs to Workbench selection; nested focus would select first,
      // causing the host's subsequent toggle to remove the same Image.
      if (event.button === 0 && !event.shiftKey && !suspended && !presented && !crop && !inspect
        && source.current && event.target.closest('.image-module__canvas') === source.current) {
        pointerFocus.current = true;
        try { source.current.closest('.image-module__window')?.focus({ preventScroll: true }); }
        finally { pointerFocus.current = false; }
      }
      if (!event.shiftKey) onActivate?.(record.id);
    }} onFocusCapture={() => { if (!pointerFocus.current) onActivate?.(record.id); }}>
    <SharedDisplayToolContent id="metadata" targetId={record.id} label={dossier?.title || record.name}
      available={Boolean(dossier) && !inactive && !inspect && (!store || workbenchView.selection?.length === 1 && workbenchView.selection[0] === record.id)}>
      <OwnerSystemWorkflowMetadataContent dossier={dossier} />
    </SharedDisplayToolContent>
    {shortcutMenu.content}
    {!presentation.open && <button data-workbench-pan ref={shortcut} className="workflow-tactile-control image-module__shortcut" style={{ bottom: 64 + index * 38 }} onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown}
      onClick={() => setPresentation(p => ({ ...p, open: true }))}>{record.name}</button>}
    {presentation.open && <ImageWindow id={record.id} title={record.name} position={presentation.position}
      size={record} viewport={viewport} editable={editable && !crop && !inspect} suspended={suspended || inspect}
      movable={(!store || editable) && !crop}
      active={activeTarget === record.id}
      placementModule={Boolean(store)} applyPosition={layout} onBeginMove={beginMove} onResize={resize}
      resizeTarget={resizeTarget}
      quickTools={editable && !inspect && (!ownerCell || cells.editingCellId === ownerCell.id) ? <>
        {crop ? <><span>Drag image to adjust crop</span>{cropZoom}{cropCompletion(true)}</> : <>
          <LayerNameInput compact label="Image layer name" name={record.name} onRename={name => save({ ...record, name }, record)} />
          {fitControls(true)}{cropButton}{replacementButton(true)}<ArtworkInfoButton targetId={record.id} /></>}
        {failure?.surface === 'actions' && <span role="alert" className="image-module__error">{error}</span>}
      </> : null}
      onClose={() => { setPresentation(p => ({ ...p, open: false })); queueMicrotask(() => shortcut.current?.focus()); }}>
      {renderRectangle => <>
      <button type="button" ref={source} className="workflow-tactile-control image-module__canvas" aria-label={crop ? 'Drag to crop Image' : artwork ? `${focusModules ? 'Focus' : 'Inspect'} ${artwork.asset.name || 'Image'}` : store ? 'Drop Library artwork into Image' : 'Image is empty'}
        data-artwork-context-id={!inactive && !inspect && artwork ? `${record.id}:${artwork.id}:${artwork.asset.stableAssetId}` : undefined}
        data-artwork-context-title={artwork?.asset.name || 'Untitled artwork'}
        data-artwork-context-src={liftEntry?.media.src}
          data-artwork-context-asset={artwork?.asset.stableAssetId}
          data-artwork-context-standard={artwork?.asset.tokenStandard}
        data-workbench-selectable={!crop && !suspended && !inspect || undefined}
        data-image-artwork-id={artwork?.id} data-cropping={Boolean(crop) || undefined} disabled={Boolean(suspended)}
        onPointerEnter={event => { if (!focusModules && !event.buttons) prepareInspection(); }}
        onPointerLeave={() => { if (!source.current?.matches(':focus-visible')) releaseInspection(); }}
        onFocus={event => { if (!focusModules && event.currentTarget.matches(':focus-visible')) prepareInspection(); }} onBlur={releaseInspection}
        onClick={event => {
          if (!artwork || crop) return;
          // Pointer activation already selects this Image and its tools. Only
          // the second click of a double-click requests camera Focus; ordinary
          // repeat clicks keep the current view. Keyboard activation stays direct.
          // Using click detail keeps ImageWindow's drag/cancel suppression in charge.
          if (focusModules) {
            if (event.detail === 0 || event.detail === 2) focusModules([record.id]);
          } else inspectArtwork();
        }}
        onKeyDown={event => {
          if (!crop) return;
          if (event.key === 'Escape') { event.preventDefault(); cancelCrop(); }
          if (event.key === 'Enter') { event.preventDefault(); applyCrop(crop.previewCrop); }
          if (event.key.startsWith('Arrow')) {
            event.preventDefault(); const step = event.shiftKey ? .05 : .01;
            updateVisualCrop(nudgeSystemWorkflowCrop(visualCrop.crop, { ...crop.media, ...visualCrop.dimensions }, rectangle,
              { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 }));
          }
        }}
        onPointerDown={event => {
          if (!focusModules && event.button === 0 && !crop) prepareInspection();
          if (!crop || event.button !== 0) return;
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
          const bounds = event.currentTarget.getBoundingClientRect();
          const coordinateScale = { x: rectangle.width / bounds.width, y: rectangle.height / bounds.height };
          drag.current = { id: event.pointerId, start: crop.previewCrop, coordinateScale, gesture: createSystemWorkflowCropPanGesture({ ...crop, mask: rectangle, media: { ...crop.media, ...visualCrop.dimensions }, previewCrop: visualCrop.crop }, { x: event.clientX * coordinateScale.x, y: event.clientY * coordinateScale.y }) };
        }} onPointerMove={event => {
          if (!crop || drag.current?.id !== event.pointerId) return;
          drag.current.gesture = updateSystemWorkflowCropPanGesture(drag.current.gesture, { x: event.clientX * drag.current.coordinateScale.x, y: event.clientY * drag.current.coordinateScale.y });
          updateVisualCrop(drag.current.gesture.previewCrop);
        }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { const start = drag.current?.start; if (start) setCrop(c => c && ({ ...c, previewCrop: start })); drag.current = null; }}
        onLostPointerCapture={() => { drag.current = null; }}>
        {!artwork ? <span className="image-module__empty">{store ? 'Drop artwork from Library' : 'No artwork'}</span>
          : <ImageArtwork artwork={artwork} rectangle={renderRectangle}
            recoveryHost={!inactive ? inspect ? inspectionRecoveryHost : recoveryHost : null} recoveryMode={inspect ? 'inspect' : undefined}
            onRecoverFocus={() => {
              const canvas = source.current;
              const stop = event => event.stopPropagation();
              canvas?.addEventListener('focusin', stop);
              try { canvas?.focus({ preventScroll: true }); }
              finally { canvas?.removeEventListener('focusin', stop); }
            }}
            crop={crop?.previewCrop ?? artwork.crop} />}
      </button>
      <span ref={setRecoveryHost} className="image-module__recovery" data-workbench-selection-tools />
      {!crop && <button type="button" data-workbench-recovery-control className="workflow-tactile-control image-module__inspect" aria-label="Inspect Image" aria-keyshortcuts="I"
        title="Inspect Image (I)" disabled={!artwork || Boolean(inspect || suspended)} onClick={inspectArtwork}
        onPointerEnter={prepareInspection} onFocus={prepareInspection} onPointerLeave={releaseInspection} onBlur={releaseInspection}><ZoomIn size={14} /></button>}
      </>}
    </ImageWindow>}
    {replacementActive && <Suspense fallback={<p role="status">Opening Library…</p>}><LibraryPicker library={library}
      label="Choose replacement image" selectionAction={artwork ? 'Replace image' : 'Use image'} placementScope={replacement}
      placementTargetRef={replacementTarget} onClose={closeReplacement} /></Suspense>}
    {error && activeTarget !== record.id && <button type="button" className="workflow-tactile-control system-workflow__notice" role="alert" onClick={() => onActivate?.(record.id)}>{error}</button>}
    {inspect && artwork && !inactive && <ImageLift source={source.current} entry={liftEntry} reducedMotion={reducedMotion} onClose={() => setInspect(false)}
      status={<span ref={setInspectionRecoveryHost} />} />}
  </div>;
});

export default function ImageWorkbench({ records, presentations, ...props }) {
  const [duplicated, setDuplicated] = useState(null);
  const onDuplicated = useCallback(id => setDuplicated({ id, profileAddress: props.profileAddress }), [props.profileAddress]);
  const duplicateTarget = duplicated?.profileAddress === props.profileAddress ? duplicated : null;
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => setViewport({ width: innerWidth, height: innerHeight }), motion = () => setReducedMotion(media.matches);
    addEventListener('resize', resize); media.addEventListener('change', motion);
    return () => { removeEventListener('resize', resize); media.removeEventListener('change', motion); };
  }, []);
  // Geometry-only history changes must still reach the window's existing
  // saved-frame reconciliation, even when this Image record is unchanged.
  return records.map((record, index) => <ImageInstance key={`${props.profileAddress}:${record.id}`} {...props} record={record} index={index} viewport={viewport} reducedMotion={reducedMotion}
    savedLayout={props.store?.getSnapshot().workbench}
    canDuplicate={records.length < MAX_IMAGE_MODULES} onDuplicated={onDuplicated}
    focusOnMount={duplicateTarget?.id === record.id}
    initialPresentation={presentations?.find(item => item.id === record.id)} />);
}
