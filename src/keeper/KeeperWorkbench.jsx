import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, Plus } from 'lucide-react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { ContextToolContent, useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { resolveLibraryImageAsset } from '../library/resolveLibraryImageAsset.js';
import { createKeeperPresentation, KEEPER_DOCK_SIZE, KEEPER_SIZE, keeperSize } from './keeper.js';
import { saveKeeperDock } from './keeperSession.js';
import { useKeeperMotion } from './useKeeperMotion.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './keeper.css';

function KeeperDock({ record, index, initialPresentation, store, profileAddress, hostRef, registerTarget,
  onPresentationChange, onActivate, suspended, windowSnap, reducedMotion }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createKeeperPresentation(record.id, index));
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
  const [imageState, setImageState] = useState({ src: null, status: 'loading' });
  const dock = useRef(null), actor = useRef(null), latest = useRef(record), request = useRef(0), live = useRef(false);
  latest.current = record;
  const editable = Boolean(store) && !suspended, active = useContextToolTarget() === record.id;
  const src = record.asset ? resolvePublishedAssetUrl(record.asset.media.url) : null;
  const status = imageState.src === src ? imageState.status : 'loading';
  const size = keeperSize(record);
  const { phase, toggle, settle } = useKeeperMotion({ dock, actor, hostRef, enabled: Boolean(src) && status === 'ready' && !suspended, reducedMotion, faces: record.faces, size });
  useEffect(() => { live.current = true; return () => { live.current = false; request.current++; }; }, []);
  useEffect(() => { request.current++; setLoading(false); }, [record, suspended]);
  useEffect(() => { settle(); }, [src, record.asset?.stableAssetId, suspended, settle]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const layout = useCallback(({ left, top }) => setPresentation(current => current.position.left === left && current.position.top === top
    ? current : { ...current, position: { left, top } }), []);
  const change = useCallback((changes, expected = latest.current) => {
    if (!editable || !live.current) return false;
    try {
      if (!saveKeeperDock(store, profileAddress, expected, changes)) throw new Error('The Keeper dock was not saved. Try again.');
      setError(''); return true;
    } catch (failure) { setError(failure.message); return false; }
  }, [editable, store, profileAddress]);
  const acceptImage = useCallback(async input => {
    if (!editable || !live.current) return false;
    const expected = latest.current, ticket = ++request.current;
    setLoading(true); setError('');
    try {
      const asset = await resolveLibraryImageAsset(input);
      if (!live.current || ticket !== request.current || latest.current !== expected) return false;
      const saved = change({ asset }, expected);
      if (saved) onActivate?.(record.id);
      return saved;
    } catch (failure) {
      if (live.current && ticket === request.current) setError(failure.message);
      return false;
    } finally { if (live.current && ticket === request.current) setLoading(false); }
  }, [editable, change, onActivate, record.id]);
  useEffect(() => {
    if (!editable || !registerTarget) return;
    registerTarget(record.id, { get node() { return dock.current; }, label: record.asset ? 'Replace Keeper artwork' : 'Give Keeper dock an inhabitant', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  }, [editable, registerTarget, record.id, Boolean(record.asset), acceptImage]);
  const retry = () => { setImageState({ src, status: 'loading' }); setAttempt(value => value + 1); };
  const label = !src ? 'Drop a Library image here' : status === 'failed' ? 'Retry Keeper artwork'
    : status === 'loading' ? 'Loading Keeper artwork' : phase === 'free' ? 'Return Keeper' : 'Release Keeper';
  return <div className="keeper-instance" data-keeper={record.id} data-keeper-phase={phase} data-suspended={suspended || undefined}
    onPointerDownCapture={() => editable && onActivate?.(record.id)} onFocusCapture={() => editable && onActivate?.(record.id)}>
    <WorkbenchWindow label="Keeper dock" title={record.name} titleContent={<strong title={record.name}>KEEPER</strong>}
      className="keeper-dock-window" chrome="bevel" viewId={record.id} active={active} placementModule={editable} snapToGrid={editable && windowSnap}
      width={KEEPER_DOCK_SIZE.width} initialHeight={KEEPER_DOCK_SIZE.height} minimumWidth={KEEPER_DOCK_SIZE.width} minimumHeight={KEEPER_DOCK_SIZE.height}
      resizable={false} initialX={presentation.position.left} initialY={presentation.position.top} onLayoutChange={layout}>
      <div ref={dock} className="keeper-dock" aria-busy={loading || src && status === 'loading' || undefined}>
        <button type="button" aria-label={label} title={label} onClick={event => { if (!loading && !suspended) { if (status === 'failed' && src) retry(); else toggle(event); } }}
          aria-disabled={!src || loading || status === 'loading' || suspended || undefined} aria-pressed={phase !== 'docked'}>
          {src ? <img key={`${src}:${attempt}`} src={src} alt="" draggable={false}
            onLoad={() => setImageState({ src, status: 'ready' })} onError={() => setImageState({ src, status: 'failed' })} /> : <Plus aria-hidden="true" />}
          <span>{loading || src && status === 'loading' ? 'Loading…' : !src ? 'Drop image' : status === 'failed' ? 'Retry' : phase === 'free' ? 'Return' : phase === 'returning' ? 'Returning' : 'Release'}</span>
          {phase !== 'docked' && <Home className="keeper-home" aria-hidden="true" />}
        </button>
      </div>
    </WorkbenchWindow>
    {src && <div ref={actor} className="keeper-roamer" hidden={phase === 'docked' || suspended} aria-hidden="true">
      <img key={`${src}:${attempt}`} src={src} alt="" draggable={false} />
    </div>}
    {editable && <ContextToolContent target={record.id} label={record.name}>
      <div className="keeper-tools">
        <label>Name<input aria-label="Keeper name" key={record.name} defaultValue={record.name} maxLength={48}
          onBlur={event => { const name = event.target.value.trim(); if (name && name !== record.name) change({ name }); }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        <label>Artwork faces<select aria-label="Keeper artwork faces" value={record.faces} onChange={event => change({ faces: event.target.value })}>
          <option value="right">Right</option><option value="left">Left</option>
        </select></label>
        <label>Size (px)<input aria-label="Keeper size" type="number" key={size} min={KEEPER_SIZE.min} max={KEEPER_SIZE.max} step="1" defaultValue={size}
          onBlur={event => {
            const next = Number(event.target.value);
            if (event.target.value && event.target.validity.valid && next !== size) {
              if (!change({ size: next })) event.target.value = String(size);
            } else event.target.value = String(size);
          }} onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.value = String(size); event.currentTarget.blur(); }
          }} /></label>
        <p>Drop an image from Library onto the dock to {record.asset ? 'replace its inhabitant' : 'give it an inhabitant'}.</p>
        <label className="keeper-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
        {record.asset && <button type="button" onClick={() => change({ asset: null })}>Empty dock</button>}
        <button type="button" onClick={() => {
          try {
            if (!removeWorkbenchModule(store, profileAddress, 'keeper', record)) throw new Error('The dock could not be deleted. Try again.');
            onActivate?.(null); hostRef.current?.focus({ preventScroll: true });
          } catch (failure) { setError(failure.message); }
        }}>Delete dock</button>
        {error && <p role="alert">{error}</p>}
        {src && status === 'failed' && <p role="alert">The artwork could not be loaded. Use Retry on the dock.</p>}
      </div>
    </ContextToolContent>}
  </div>;
}

export default function KeeperWorkbench({ records, presentations, ...props }) {
  return <div className="keeper-workbench" data-workbench-module="keeper">
    {records.map((record, index) => <KeeperDock key={`${props.profileAddress}:${record.id}`} {...props} record={record} index={index}
      initialPresentation={presentations?.find(item => item.id === record.id)} />)}
  </div>;
}
