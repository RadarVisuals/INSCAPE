import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, Plus, Settings2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { resolveLibraryImageAsset } from '../library/resolveLibraryImageAsset.js';
import { createKeeperPresentation, KEEPER_DOCK_SIZE, KEEPER_SIZE, keeperSize, keeperMovement } from './keeper.js';
import { saveKeeperDock } from './keeperSession.js';
import { useKeeperMotion } from './useKeeperMotion.js';
import { useWorkbenchActions, useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useKeeperRig } from './useKeeperRig.js';
import { KeeperRigArtwork } from './KeeperRigArtwork.jsx';
import { KeeperSwimControls } from './KeeperSwimControls.jsx';
import { KeeperConversation } from './KeeperConversation.jsx';
import { keeperSwim } from './keeperSwim.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './keeper.css';

function KeeperDock({ record, index, initialPresentation, store, profileAddress, hostRef, registerTarget,
  onPresentationChange, suspended, windowSnap, reducedMotion }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createKeeperPresentation(record.id, index));
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
  const [imageState, setImageState] = useState({ src: null, status: 'loading' });
  const [talking, setTalking] = useState(false);
  const [settings, setSettings] = useState(null);
  const settingsButton = useRef(null);
  const closeSettings = () => { setSettings(null); settingsButton.current?.focus({ preventScroll: true }); };
  const head = useRef(null), conversationPosition = useRef(null);
  const dock = useRef(null), actor = useRef(null), rigActor = useRef(null), latest = useRef(record), request = useRef(0), live = useRef(false);
  latest.current = record;
  const editable = Boolean(store) && !suspended;
  const src = record.asset ? resolvePublishedAssetUrl(record.asset.media.url) : null;
  const movement = keeperMovement(record), rigged = movement === 'swim' || movement === 'svg';
  const layered = useKeeperRig(src, rigged && !suspended, attempt);
  const wrongSvg = movement === 'svg' && layered.status === 'ready' && layered.rig?.kind !== 'octopus';
  const status = wrongSvg ? 'failed' : rigged ? layered.status : imageState.src === src ? imageState.status : 'loading';
  const size = keeperSize(record), swim = keeperSwim(record);
  const { getSelection } = useWorkbenchActions();
  const hiddenByGroup = useWorkbenchView().hiddenModuleIds?.includes(record.id);
  const snake = movement === 'swim' && layered.rig?.kind === 'snake';
  const { phase, toggle, settle, captureReaction, cancelReaction, nudge } = useKeeperMotion({ dock, actor, rigActor, hostRef, enabled: Boolean(src) && status === 'ready' && !suspended && !hiddenByGroup,
    reducedMotion, faces: record.faces, size, movement, swim, paused: talking, onPosition: conversationPosition, getSelection });
  useEffect(() => { setTalking(false); }, [src, record.asset?.stableAssetId, movement, suspended, phase]);
  useEffect(() => { live.current = true; return () => { live.current = false; request.current++; }; }, []);
  useEffect(() => { request.current++; setLoading(false); }, [record, suspended]);
  useEffect(() => { settle(); }, [src, record.asset?.stableAssetId, movement, suspended, settle]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const layout = useCallback(({ left, top }) => setPresentation(current => current.position.left === left && current.position.top === top
    ? current : { ...current, position: { left, top } }), []);
  const resizeTarget = useMemo(() => ({ enabled: false, store, layoutKey: 'keeperDocks', applyFrame: layout }), [store, layout]);
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

      return saved;
    } catch (failure) {
      if (live.current && ticket === request.current) { setError(failure.message); setSettings(dock.current?.getBoundingClientRect() || { right: 8, top: 24 }); }
      return false;
    } finally { if (live.current && ticket === request.current) setLoading(false); }
  }, [editable, change]);
  useEffect(() => {
    if (!editable || !registerTarget) return;
    registerTarget(record.id, { get node() { return dock.current; }, label: record.asset ? 'Replace Keeper artwork' : 'Give Keeper dock an inhabitant', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  }, [editable, registerTarget, record.id, Boolean(record.asset), acceptImage]);
  const retry = () => { setImageState({ src, status: 'loading' }); setAttempt(value => value + 1); };
  const label = !src ? 'Drop a Library image here' : status === 'failed' ? 'Retry Keeper artwork'
    : status === 'loading' ? 'Loading Keeper artwork' : phase === 'free' ? 'Return Keeper' : 'Release Keeper';
  const closeConversation = () => { setTalking(false); head.current?.focus({ preventScroll: true }); };
  const headControl = { ref: head, 'aria-label': `Talk to ${record.name}`, title: 'Click to talk',
    'aria-description': 'Arrow keys move Keeper. Click empty space or hold the right mouse button to swim while talking.',
    'aria-haspopup': 'dialog', 'aria-expanded': talking, disabled: phase !== 'free',
    onKeyDown: event => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (direction) { event.preventDefault(); event.stopPropagation(); nudge(direction[0] * 80, direction[1] * 80); }
    },
    onClick: () => setTalking(value => !value) };
  return <div className="keeper-instance" data-workbench-selection-tools data-keeper={record.id} data-keeper-phase={phase} data-keeper-movement={movement} data-suspended={suspended || undefined}>
    <WorkbenchWindow label="Keeper dock" title={record.name} titleContent={<strong title={record.name}>KEEPER</strong>}
      className="keeper-dock-window" chrome="tactile" viewId={record.id} placementModule={editable} snapToGrid={editable && windowSnap}
      controls={editable && <button ref={settingsButton} type="button" className="workflow-tactile-control keeper-settings-button" data-workbench-selection-tools aria-label="Keeper settings" title="Keeper settings" aria-expanded={Boolean(settings)}
        onClick={() => settings ? closeSettings() : setSettings(dock.current.getBoundingClientRect())}><Settings2 size={14} strokeWidth={1.6} /></button>}
      width={KEEPER_DOCK_SIZE.width} initialHeight={KEEPER_DOCK_SIZE.height} minimumWidth={KEEPER_DOCK_SIZE.width} minimumHeight={KEEPER_DOCK_SIZE.height}
      resizable={false} resizeTarget={resizeTarget} initialX={presentation.position.left} initialY={presentation.position.top} onLayoutChange={layout}>
      <div ref={dock} className="keeper-dock" aria-busy={loading || src && status === 'loading' || undefined}>
        <button className="workflow-tactile-control" type="button" data-workbench-selection-tools aria-label={label} title={label} onClick={event => { if (!loading && !suspended) { if (status === 'failed' && src) retry(); else toggle(event); } }}
          aria-disabled={!src || loading || status === 'loading' || suspended || undefined} aria-pressed={phase !== 'docked'}>
          {src ? <img key={`${src}:${attempt}`} src={src} alt="" draggable={false}
            onLoad={() => setImageState({ src, status: 'ready' })} onError={() => setImageState({ src, status: 'failed' })} /> : <Plus aria-hidden="true" />}
          <span>{loading || src && status === 'loading' ? 'Loading…' : !src ? 'Drop image' : status === 'failed' ? 'Retry' : phase === 'free' ? 'Return' : phase === 'returning' ? 'Returning' : 'Release'}</span>
          {phase !== 'docked' && <Home className="keeper-home" aria-hidden="true" />}
        </button>
      </div>
    </WorkbenchWindow>
    {src && <div ref={actor} className="keeper-roamer" data-workbench-selection-tools hidden={phase === 'docked' || suspended}>
      {rigged ? !wrongSvg && layered.rig && <KeeperRigArtwork key={`${src}:${attempt}:${movement}`} movement={movement} rig={layered.rig} ref={rigActor} headControl={headControl} />
        : <><img key={`${src}:${attempt}`} src={src} alt="" draggable={false} /><button {...headControl} type="button" className="workflow-tactile-control keeper-head keeper-head--flip" /></>}
    </div>}
    {talking && phase === 'free' && !suspended && record.asset && <KeeperConversation
      key={record.asset.stableAssetId} asset={record.asset} name={record.name} anchor={head} dock={dock} onClose={closeConversation}
      captureReaction={captureReaction} cancelReaction={cancelReaction}
      onPosition={conversationPosition}
      conversationScope={JSON.stringify([profileAddress, record.id, record.asset.stableAssetId])} />}
    {editable && settings && createPortal(<div data-keeper-tools data-workbench-selection-tools>
      <WorkbenchWindow label="Keeper settings" title={record.name} chrome="tactile" className="context-toolbar workbench-tool-window keeper-settings-window"
        width={300} initialHeight={320} minimumHeight={96} fitContent fitContentFromTop resizable={false}
        initialX={Math.max(8, Math.min(settings.right + 8, globalThis.innerWidth - 308))} initialY={Math.max(8, Math.min(settings.top, globalThis.innerHeight - 240))}
        controls={<button className="workflow-tactile-control" type="button" aria-label="Close Keeper settings" onClick={closeSettings}><X /></button>}>
      <div className="keeper-tools" onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); closeSettings(); } }}>
        <label>Name<input aria-label="Keeper name" key={record.name} defaultValue={record.name} maxLength={48}
          onBlur={event => { const name = event.target.value.trim(); if (name && name !== record.name) change({ name }); }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        <label>Movement<select aria-label="Keeper movement" value={movement} onChange={event => change({ movement: event.target.value })}>
          <option value="flip">Flip</option><option value="swim">Layered swim</option><option value="svg">SVG float</option>
        </select></label>
        {!snake && movement !== 'svg' && <label>Artwork faces<select aria-label="Keeper artwork faces" value={record.faces} onChange={event => change({ faces: event.target.value })}>
          <option value="right">Right</option><option value="left">Left</option>
        </select></label>}
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
        {rigged && <KeeperSwimControls value={swim} snake={snake} onChange={next => change({ swim: next }, record)} />}
        <details><summary>Using Keeper</summary>
        <p>Drop an image from Library onto the dock to {record.asset ? 'replace its inhabitant' : 'give it an inhabitant'}.</p>
        {movement === 'swim' && <p>{snake ? 'Snake chain detected.' : layered.rig?.kind === 'octopus' ? 'Octopus detected.' : 'Use a prepared Keeper SVG with image layers or vector octopus parts.'}</p>}
        {movement === 'svg' && <p>Requires a prepared SVG with vector tentacles and eyes.</p>}
        {rigged && <p>Release, then click empty Workbench space to swim there. Hold the right mouse button to follow your cursor.</p>}
        {record.asset && <p>Click the released character's head to open its dialogue.</p>}
        </details>
        <label className="keeper-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
        {record.asset && <button className="workflow-tactile-control" type="button" onClick={() => change({ asset: null })}>Empty dock</button>}
        <button className="workflow-tactile-control" type="button" onClick={() => {
          try {
            if (!removeWorkbenchModule(store, profileAddress, 'keeper', record)) throw new Error('The dock could not be deleted. Try again.');
            hostRef.current?.focus({ preventScroll: true });
          } catch (failure) { setError(failure.message); }
        }}>Delete dock</button>
        {error && <p role="alert">{error}</p>}
        {src && status === 'failed' && <p role="alert">{wrongSvg ? 'SVG float needs a prepared SVG with vector tentacles and eyes. Use Layered swim for image-layer tentacles or a snake.' : rigged ? layered.error : 'The artwork could not be loaded.'} Use Retry on the dock.</p>}
      </div>
      </WorkbenchWindow>
    </div>, hostRef.current || document.body)}
  </div>;
}

export default function KeeperWorkbench({ records, presentations, ...props }) {
  return <div className="keeper-workbench" data-workbench-module="keeper">
    {records.map((record, index) => <KeeperDock key={`${props.profileAddress}:${record.id}`} {...props} record={record} index={index}
      initialPresentation={presentations?.find(item => item.id === record.id)} />)}
  </div>;
}
