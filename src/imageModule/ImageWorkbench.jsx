import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crop, Trash2, X, ChevronRight } from 'lucide-react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { ContextToolContent, useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import ArtworkTransformTools from '../public/ownerSystemWorkflow/ArtworkTransformTools.jsx';
import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { decodeOwnerSystemWorkflowAssetDimensions } from '../public/ownerSystemWorkflow/ownerSystemWorkflowAssetDimensions.js';
import LatticeProductionFocusArtwork from '../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { createSystemWorkflowCropSession, createSystemWorkflowCropPanGesture, updateSystemWorkflowCropPanGesture, setSystemWorkflowCropZoom, nudgeSystemWorkflowCrop } from '../systemWorkflow/systemWorkflowCrop.js';
import { projectSystemWorkflowTransform, unprojectSystemWorkflowCrop, transformArtwork } from '../systemWorkflow/systemWorkflowTransform.js';
import { createImagePresentation, imageFocusEntry, imageSize, MAX_IMAGE_SIDES, nextImageSide } from './imageModule.js';
import { saveImageModule } from './imageModuleSession.js';
import ImageLift from './ImageLift.jsx';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './imageModule.css';

function Artwork({ side, rectangle, crop }) {
  const entry = useMemo(() => imageFocusEntry(side, crop), [side, crop]);
  return <LatticeProductionFocusArtwork entry={entry} motion={{ sourceRectangle: rectangle, focusedRectangle: rectangle, currentRectangle: rectangle, progress: 0 }} />;
}

function ImageInstance({ record, index, store, profileAddress, registerTarget, initialPresentation, onPresentationChange, onActivate, suspended, viewport, reducedMotion, windowSnap }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createImagePresentation(record.id, index));
  const [sideId, setSideId] = useState(record.sides[0]?.id), [flipTarget, setFlip] = useState(null);
  const [cropState, setCrop] = useState(null), [inspect, setInspect] = useState(false), [error, setError] = useState('');
  const [dropMode, setDropMode] = useState('append');
  const [sizeFields, setSizeFields] = useState({ width: String(record.width), height: String(record.height) });
  const source = useRef(null), drag = useRef(null), shortcut = useRef(null), latest = useRef(record), live = useRef(true);
  const imageRequest = useRef(0);
  latest.current = record;
  const activeTarget = useContextToolTarget();
  const side = record.sides.find(item => item.id === sideId) || record.sides[0];
  const crop = cropState?.expected === record && cropState?.placementId === side?.id ? cropState : null;
  const flip = record.sides.some(item => item.id === flipTarget) ? flipTarget : null;
  const sideIndex = record.sides.indexOf(side);
  const editable = Boolean(store) && !suspended;
  const scale = Math.min(1, (viewport.width - 16) / record.width, (viewport.height - 70) / record.height);
  const size = { width: record.width * scale, height: record.height * scale };
  const [rectangle, setRectangle] = useState({ left: 0, top: 0, ...size });
  const liftEntry = useMemo(() => side ? imageFocusEntry(side) : null, [side]);
  const inactive = suspended || !presentation.open;
  useEffect(() => { live.current = true; return () => { live.current = false; imageRequest.current += 1; }; }, []);
  useEffect(() => {
    setSizeFields({ width: String(record.width), height: String(record.height) });
    imageRequest.current += 1;
    setCrop(null); setFlip(null); setInspect(false); drag.current = null;
  }, [record]);
  useEffect(() => {
    if (inactive || store && activeTarget !== record.id) { setCrop(null); drag.current = null; }
    if (inactive) { setInspect(false); setFlip(null); }
  }, [inactive, activeTarget, record.id, store]);
  useEffect(() => { imageRequest.current += 1; }, [inactive, side?.id, dropMode]);
  useEffect(() => {
    if (!presentation.open || !source.current) return;
    const measure = () => setRectangle({ left: 0, top: 0, width: source.current.clientWidth, height: source.current.clientHeight });
    const observer = new ResizeObserver(measure); observer.observe(source.current); measure();
    return () => observer.disconnect();
  }, [presentation.open]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const layout = useCallback(({ left, top }) => setPresentation(current => current.position.left === left && current.position.top === top ? current : { ...current, position: { left, top } }), []);
  const save = useCallback((next, expected = latest.current) => {
    if (!live.current || !store || suspended) return false;
    try {
      if (!saveImageModule(store, profileAddress, expected, next)) throw new Error('Image was not saved. Your saved work is unchanged; try the edit again.');
      latest.current = next; setError(''); return true;
    } catch (e) { setError(e.message); return false; }
  }, [store, profileAddress, suspended]);
  const changeSide = (change, expected = record) => save({ ...expected, sides: expected.sides.map(item => item.id === side?.id ? { ...item, ...change } : item) }, expected);
  const acceptImage = useCallback(async input => {
    if (!editable || !presentation.open || !live.current) return false;
    const current = latest.current;
    const request = ++imageRequest.current;
    try {
      if (dropMode === 'append' && current.sides.length >= MAX_IMAGE_SIDES) throw new Error('Image supports up to 32 sides. Remove a side or replace its artwork.');
      const id = input.stableAssetId || input.id;
      let asset = createProfileDocumentV9AssetResolver([{ ...(input.assetRecord || input), id }], { compactContentReference: false })(id, input.selectedMedia);
      if (asset.media.type !== 'image' || !asset.media.url) throw new Error('Choose a Library image.');
      if (!asset.media.width || !asset.media.height) {
        const dimensions = await decodeOwnerSystemWorkflowAssetDimensions({ src: resolvePublishedAssetUrl(asset.media.url) });
        if (!live.current || imageRequest.current !== request || latest.current !== current) return false;
        if (!dimensions) throw new Error('The artwork dimensions could not be read. Try dropping the image again.');
        asset = { ...asset, media: { ...asset.media, width: dimensions.width, height: dimensions.height } };
      }
      const newSide = { id: `side:${crypto.randomUUID()}`, asset, crop: { x: .5, y: .5, zoom: 1 }, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
      const replacing = dropMode === 'replace' && current.sides.some(item => item.id === side?.id);
      if (replacing) newSide.id = side.id;
      if (!save({ ...current, sides: replacing ? current.sides.map(item => item.id === side.id ? newSide : item) : [...current.sides, newSide] }, current)) return false;
      setSideId(newSide.id); onActivate?.(record.id); return true;
    } catch (e) { if (live.current && imageRequest.current === request) setError(e.message); return false; }
  }, [editable, presentation.open, dropMode, side?.id, save, onActivate, record.id]);
  useEffect(() => {
    if (!editable || !presentation.open || !registerTarget || inspect || crop) return;
    registerTarget(record.id, { get node() { return source.current; }, label: dropMode === 'replace' ? 'Replace Image side' : 'Add Image side', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  }, [editable, presentation.open, registerTarget, record.id, acceptImage, inspect, Boolean(crop), dropMode]);
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'image', record });
  const beginCrop = () => {
    if (!side || !editable) return;
    const session = createSystemWorkflowCropSession(side, { stableAssetId: side.asset.stableAssetId, width: side.asset.media.width, height: side.asset.media.height }, rectangle);
    setCrop({ ...session, expected: record });
  };
  const visualCrop = crop && projectSystemWorkflowTransform(side.transform, crop.media, crop.previewCrop);
  const updateVisualCrop = value => setCrop(current => current && ({ ...current, previewCrop: unprojectSystemWorkflowCrop(side.transform, value) }));
  const applyCrop = value => { if (crop && changeSide({ crop: value }, crop.expected)) { setCrop(null); drag.current = null; } };
  const cancelCrop = () => { setCrop(null); drag.current = null; };
  const resize = newSize => {
    cancelCrop();
    const width = Math.max(32, Math.min(4096, Math.round(newSize.width / scale)));
    const height = Math.max(32, Math.min(4096, Math.round(newSize.height / scale)));
    return save({ ...record, width, height });
  };
  const applySize = event => {
    event.preventDefault();
    const width = Number(sizeFields.width), height = Number(sizeFields.height);
    if (!imageSize(width) || !imageSize(height)) { setError('Use whole-pixel dimensions from 32 to 4096.'); return; }
    save({ ...record, width, height });
  };
  const next = () => {
    if (record.sides.length < 2 || crop || inspect || flip || inactive) return;
    const target = record.sides[nextImageSide(sideIndex, record.sides.length)].id;
    if (reducedMotion) setSideId(target); else setFlip(target);
  };
  return <div className="image-module" data-workbench-module="image" data-image-module={record.id}
    onPointerDownCapture={() => onActivate?.(record.id)} onFocusCapture={() => onActivate?.(record.id)}>
    {shortcutMenu.content}
    {!presentation.open && <button ref={shortcut} className="image-module__shortcut" style={{ bottom: 64 + index * 38 }} onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown}
      onClick={() => setPresentation(p => ({ ...p, open: true }))}>{record.name}</button>}
    {presentation.open && <WorkbenchWindow label="Image" title={record.name} titleContent={<span>{record.name}</span>} chrome="bevel" className="image-module__window"
      resizableWidth resizable={editable && !crop && !inspect} minimumWidth={32} minimumHeight={32} controlledSize={size} width={size.width} initialHeight={size.height}
      initialX={presentation.position.left} initialY={presentation.position.top} viewId={record.id} placementModule={Boolean(store)} snapToGrid={Boolean(windowSnap)}
      onLayoutChange={layout} onResizeEnd={editable ? resize : undefined}
      controls={<button type="button" className="system-workflow__window-cap" aria-label={`Close ${record.name}`} onClick={() => { setPresentation(p => ({ ...p, open: false })); queueMicrotask(() => shortcut.current?.focus()); }}><X /></button>}>
      <button type="button" ref={source} className="image-module__canvas" aria-label={crop ? 'Drag to crop Image' : side ? `Inspect ${side.asset.name || 'Image'}` : store ? 'Drop Library artwork into Image' : 'Image is empty'}
        data-side-id={side?.id} data-cropping={Boolean(crop) || undefined} disabled={Boolean(suspended)}
        onClick={() => { if (side && !crop && !flip) setInspect(true); }}
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
        {!side ? <span className="image-module__empty">{store ? 'Drop artwork from Library' : 'No artwork'}</span> : <span className="image-module__turn" data-flipping={Boolean(flip) || undefined}
          onAnimationEnd={event => { if (event.target === event.currentTarget && flip) { setSideId(flip); setFlip(null); } }}>
          <span className="image-module__face"><Artwork side={side} rectangle={rectangle} crop={crop?.previewCrop ?? side.crop} /></span>
          {flip && <span className="image-module__face image-module__face--back"><Artwork side={record.sides.find(item => item.id === flip)} rectangle={rectangle} /></span>}
        </span>}
      </button>
      {record.sides.length > 1 && !crop && <button type="button" className="image-module__next" aria-label="Next Image side" disabled={Boolean(flip || inspect || suspended)} onClick={next}><span>{sideIndex + 1}/{record.sides.length}</span><ChevronRight size={14} /></button>}
    </WorkbenchWindow>}
    {editable && <ContextToolContent target={record.id} label={`${record.name} / ${side ? `Side ${sideIndex + 1}` : 'Empty'}`} available={presentation.open && !inspect}>
      {crop ? <div className="system-workflow__crop-controls" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancelCrop(); } }}>
        <div><strong>Crop / drag image</strong><output>{Math.round(visualCrop.crop.zoom * 100)}%</output></div>
        <input type="range" aria-label="Crop zoom" min="1" max="4" step="0.05" value={visualCrop.crop.zoom}
          onChange={event => updateVisualCrop(setSystemWorkflowCropZoom(visualCrop.crop, { ...crop.media, ...visualCrop.dimensions }, rectangle, Number(event.target.value)))} />
        <footer><button type="button" onClick={() => applyCrop(null)}>Native fit</button><button type="button" onClick={cancelCrop}>Cancel</button><button type="button" onClick={() => applyCrop(crop.previewCrop)}>Done</button></footer>
      </div> : <>
        <nav className="system-workflow__selection-actions" aria-label="Image actions"><ArtworkTransformTools disabled={!side || Boolean(flip)} onTransform={operation => changeSide({ transform: transformArtwork(side.transform, operation) })} />
          <button type="button" aria-label="Crop" title="Crop" disabled={!side || Boolean(flip)} onClick={beginCrop}><Crop size={15} /></button>
        </nav>
        <form className="image-module__size" onSubmit={applySize}>
          {['width', 'height'].map(key => <label key={key}>{key === 'width' ? 'Width' : 'Height'}<input aria-label={`Image ${key}`} type="number" min="32" max="4096" step="1" value={sizeFields[key]} onChange={event => setSizeFields(fields => ({ ...fields, [key]: event.target.value }))} /></label>)}
          <button type="submit">Set size</button>
        </form>
        <div className="image-module__side-tools">
          <label>Library drop<select aria-label="Image drop action" value={dropMode} onChange={event => setDropMode(event.target.value)}><option value="append">Add side</option><option value="replace">Replace side</option></select></label>
          <button type="button" aria-label="Remove Image side" title="Remove current side" disabled={!side || Boolean(flip)} onClick={() => save({ ...record, sides: record.sides.filter(item => item.id !== side.id) })}><Trash2 size={14} /></button>
        </div>
        <label className="image-module__publication"><input type="checkbox" checked={record.visibility === 'PUBLIC'} onChange={event => save({ ...record, visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include Image in publication</label>
      </>}
      {error && <p role="alert" className="image-module__error">{error}</p>}
    </ContextToolContent>}
    {error && activeTarget !== record.id && <button type="button" className="system-workflow__notice" role="alert" onClick={() => onActivate?.(record.id)}>{error}</button>}
    {inspect && side && !inactive && <ImageLift source={source.current} entry={liftEntry} reducedMotion={reducedMotion} onClose={() => setInspect(false)} />}
  </div>;
}

export default function ImageWorkbench({ records, presentations, ...props }) {
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => setViewport({ width: innerWidth, height: innerHeight }), motion = () => setReducedMotion(media.matches);
    addEventListener('resize', resize); media.addEventListener('change', motion);
    return () => { removeEventListener('resize', resize); media.removeEventListener('change', motion); };
  }, []);
  return records.map((record, index) => <ImageInstance key={record.id} {...props} record={record} index={index} viewport={viewport} reducedMotion={reducedMotion}
    initialPresentation={presentations?.find(item => item.id === record.id)} />);
}
