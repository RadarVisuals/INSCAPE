import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import ProfileOverview from './ProfileOverview.jsx';
import ReceptionImagePreview from './ReceptionImagePreview.jsx';
import { publicCanvasItems } from './profileOverviewModel.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { projectImageModules, IMAGE_FILL_CROP } from '../../imageModule/imageModule.js';
import { saveImageModule } from '../../imageModule/imageModuleSession.js';
import { projectReception, saveReceptionSelection } from '../domain/receptionPresentation.js';
import { projectSystemWorkflowTransform, unprojectSystemWorkflowCrop } from '../../systemWorkflow/systemWorkflowTransform.js';
import { normalizeCropForMask, cropFocusBounds } from '../../lattice/rendering/latticeCrop.js';
import LibraryArtworkImage from '../../public/ownerSystemWorkflow/LibraryArtworkImage.jsx';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import './receptionEditor.css';

const subscribeNothing = () => () => {};
const noDraft = () => null;

function EditorDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  useLayoutEffect(() => {
    const node = dialog.current, previous = document.activeElement;
    node.showModal();
    return () => { node.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog className="reception-editor-dialog system-workflow__token-scope" ref={dialog} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2>{title}</h2><button type="button" aria-label="Close editor" onClick={onClose}><X /></button></header>
    {children}
  </dialog>;
}

function CropEditor({ record, ratio, onSave, onClose }) {
  const [index, setIndex] = useState(0), [changes, setChanges] = useState({}), [error, setError] = useState('');
  const side = record.sides[index];
  const crop = Object.hasOwn(changes, side?.id) ? changes[side.id] : side?.receptionCrop ?? null;
  const preview = useRef(null), gesture = useRef(null);
  const projection = side && projectSystemWorkflowTransform(side.transform, side.asset.media, crop || IMAGE_FILL_CROP);
  const update = visualCrop => {
    const bounds = preview.current.getBoundingClientRect();
    const next = normalizeCropForMask(visualCrop, { left: 0, top: 0, width: bounds.width, height: bounds.height }, projection.dimensions);
    setChanges(current => ({ ...current, [side.id]: unprojectSystemWorkflowCrop(side.transform, next) }));
  };
  const cancelGesture = () => {
    const previous = gesture.current; gesture.current = null;
    if (previous && preview.current?.hasPointerCapture(previous.id)) preview.current.releasePointerCapture(previous.id);
  };
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancelGesture(); };
    addEventListener('blur', cancelGesture); document.addEventListener('visibilitychange', hidden);
    return () => { cancelGesture(); removeEventListener('blur', cancelGesture); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  const pointerDown = event => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const mask = { left: 0, top: 0, width: bounds.width, height: bounds.height };
    const visual = normalizeCropForMask(projection.crop, mask, projection.dimensions);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, visual,
      bounds: cropFocusBounds(mask, projection.dimensions, visual.zoom) };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const pointerMove = event => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    if (event.pointerType === 'mouse' && !event.buttons) { cancelGesture(); return; }
    const clamp = (value, bounds) => Math.min(bounds.maximum, Math.max(bounds.minimum, value));
    update({ ...start.visual,
      x: clamp(start.visual.x - (event.clientX - start.x) / start.bounds.renderedSize.width, start.bounds.x),
      y: clamp(start.visual.y - (event.clientY - start.y) / start.bounds.renderedSize.height, start.bounds.y) });
  };
  return <EditorDialog title="Reception crop" onClose={onClose}>
    {!side ? <p>This Image has no artwork yet.</p> : <>
      {record.sides.length > 1 && <label>Image side<select aria-label="Image side" value={index} onChange={event => { cancelGesture(); setIndex(Number(event.target.value)); }}>
        {record.sides.map((item, i) => <option key={item.id} value={i}>{i + 1} · {item.asset.name || record.name}</option>)}
      </select></label>}
      <div className="reception-crop__preview" style={{ '--crop-ratio': ratio }} ref={preview} tabIndex={0} role="group" aria-label="Drag artwork to position reception crop"
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={cancelGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}
        onKeyDown={event => {
          const delta = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] }[event.key];
          if (!delta) return; event.preventDefault();
          update({ ...projection.crop, x: Math.max(0, Math.min(1, projection.crop.x + delta[0])), y: Math.max(0, Math.min(1, projection.crop.y + delta[1])) });
        }}><ReceptionImagePreview side={side} crop={crop} /></div>
      <p>Drag to frame your preview. The full artwork and canvas crop stay unchanged.</p>
      <label>Zoom <output>{Math.round((crop?.zoom || 1) * 100)}%</output><input aria-label="Reception crop zoom" type="range" min="1" max="4" step="0.01" value={crop?.zoom || 1}
        onChange={event => update({ ...projection.crop, zoom: Number(event.target.value) })} /></label>
      <label>Horizontal position<input aria-label="Reception crop horizontal position" type="range" min="0" max="1" step="0.01" value={projection.crop.x}
        onChange={event => update({ ...projection.crop, x: Number(event.target.value) })} /></label>
      <label>Vertical position<input aria-label="Reception crop vertical position" type="range" min="0" max="1" step="0.01" value={projection.crop.y}
        onChange={event => update({ ...projection.crop, y: Number(event.target.value) })} /></label>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={() => setChanges(current => ({ ...current, [side.id]: null }))}>Fit full image</button>
        <button type="button" onClick={() => update({ ...IMAGE_FILL_CROP })}>Fill preview</button>
        <button type="button" onClick={() => {
          const next = { ...record, sides: record.sides.map(item => {
            if (!Object.hasOwn(changes, item.id)) return item;
            const changed = { ...item }; if (changes[item.id]) changed.receptionCrop = changes[item.id]; else delete changed.receptionCrop;
            return changed;
          }) };
          if (onSave(record, next)) onClose(); else setError('Crop was not saved. The draft changed or storage is unavailable. Close and reopen Edit reception to retry.');
        }}>Save crop</button></footer>
    </>}
  </EditorDialog>;
}

function SelectionEditor({ items, initial, onSave, onClose }) {
  const [selected, setSelected] = useState(initial), [error, setError] = useState('');
  const ordered = [...selected.map(id => items.find(item => item.key === id)).filter(Boolean), ...items.filter(item => !selected.includes(item.key))];
  const move = (id, delta) => setSelected(current => { const next = [...current], from = next.indexOf(id), to = from + delta;
    if (from < 0 || to < 0 || to >= next.length) return current;
    [next[from], next[to]] = [next[to], next[from]]; return next; });
  return <EditorDialog title="Choose reception artwork" onClose={onClose}>
    <p>Choose what appears and its order. New public Images are available here when you add them to your Workbench.</p>
    <ul className="reception-selection">{ordered.map(item => <li key={item.key}>
      <label><input type="checkbox" checked={selected.includes(item.key)} onChange={event => setSelected(current => event.target.checked ? [...current, item.key] : current.filter(id => id !== item.key))} />
        {item.kind === 'image' && item.record.sides[0] && <LibraryArtworkImage src={resolvePublishedAssetUrl(item.record.sides[0].asset.media.url)} alt="" draggable={false} />}
        <span>{item.kind === 'image' ? item.record.sides[0]?.asset.name || item.title : item.title}<small>{item.kind}</small></span></label>
      {selected.includes(item.key) && <span><button type="button" aria-label={`Move ${item.title} earlier`} disabled={selected.indexOf(item.key) === 0} onClick={() => move(item.key, -1)}><ArrowUp /></button>
        <button type="button" aria-label={`Move ${item.title} later`} disabled={selected.indexOf(item.key) === selected.length - 1} onClick={() => move(item.key, 1)}><ArrowDown /></button></span>}
    </li>)}</ul>
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" onClick={() => setSelected([])}>Clear selection</button><button type="button" onClick={() => {
      if (onSave(selected)) onClose(); else setError('Selection was not saved. Close and reopen Edit reception to reload the draft.');
    }}>Save selection</button></footer>
  </EditorDialog>;
}

// Mounted only by an explicit action from the verified owner. The normal public
// reception never creates a draft store or reads owner storage.
export default function OwnerReceptionEditor({ document: publication, onDone, store: suppliedStore }) {
  const profile = publication.profile.address;
  const [source] = useState(() => {
    try {
      const store = suppliedStore || createSystemWorkflowDraftStore({ profileAddress: profile, storage: localStorage });
      if (store.getProfileAddress() !== profile) throw new Error('Profile mismatch');
      if (store.getRecordState().status === 'absent') return { error: 'Open this profile in Workbench first to load its published content before editing reception.' };
      store.getSnapshot(); return { store };
    } catch { return { error: 'The local draft could not be opened. Return to Workbench to resolve draft storage before editing reception.' }; }
  });
  const store = source.store;
  const draft = useSyncExternalStore(store?.subscribe || subscribeNothing, store?.getSnapshot || noDraft, store?.getSnapshot || noDraft);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [cropTarget, setCropTarget] = useState(null), [selecting, setSelecting] = useState(false), [notice, setNotice] = useState('Choose artwork, then click an Image to crop its reception preview.');
  const preview = useMemo(() => {
    if (!draft) return publication;
    const imageModules = projectImageModules(draft.imageModules || []);
    const projected = { ...publication, imageModules };
    delete projected.reception;
    if (draft.reception) projected.reception = projectReception(draft.reception, projected);
    return projected;
  }, [draft, publication]);
  const available = useMemo(() => publicCanvasItems(preview), [preview]);
  const selected = preview.reception?.items || [...available.filter(item => item.kind === 'image'), ...available.filter(item => item.kind !== 'image')].map(item => item.key);
  const saved = success => { if (success) setNotice('Saved to your local draft. Publish from Workbench to update visitors.'); return success; };
  const saveCrop = (expected, next) => {
    if (!live.current || store?.getProfileAddress() !== profile) return false;
    try { return saved(saveImageModule(store, profile, expected, next)); } catch { return false; }
  };
  return <>
    <ProfileOverview document={preview} reception onEditImage={(record, node) => {
      const original = draft?.imageModules?.find(item => item.id === record.id);
      if (!original?.sides.length) return;
      const rect = node.getBoundingClientRect();
      setCropTarget({ record: original, ratio: rect.width / rect.height });
    }} />
    <aside className="reception-editor-bar" aria-label="Reception editing">
      <strong>Reception · Draft</strong><span role={source.error ? 'alert' : 'status'}>{source.error || notice}</span>
      {store && <button type="button" onClick={() => setSelecting({ expected: draft.reception })}>Choose artwork</button>}
      <button type="button" onClick={onDone}>Done editing</button>
    </aside>
    {cropTarget && <CropEditor {...cropTarget} onSave={saveCrop} onClose={() => setCropTarget(null)} />}
    {selecting && <SelectionEditor items={available} initial={selected} onClose={() => setSelecting(false)} onSave={items => {
      if (!live.current || store?.getProfileAddress() !== profile) return false;
      try { return saved(saveReceptionSelection(store, profile, selecting.expected, items)); } catch { return false; }
    }} />}
  </>;
}
