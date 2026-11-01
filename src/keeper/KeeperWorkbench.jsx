import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { resolveLibraryImageAsset } from '../library/resolveLibraryImageAsset.js';
import { KEEPER_DOCK_SIZE, KEEPER_SIZE, keeperSize, keeperMovement } from './keeper.js';
import { saveKeeperDock } from './keeperSession.js';
import { useKeeperMotion } from './useKeeperMotion.js';
import { useWorkbenchActions, useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useKeeperRig } from './useKeeperRig.js';
import { KeeperRigArtwork } from './KeeperRigArtwork.jsx';
import { KeeperSwimControls } from './KeeperSwimControls.jsx';
import useWorkbenchUtilityWindow from '../public/ownerSystemWorkflow/useWorkbenchUtilityWindow.js';
import KeeperDockContent from './KeeperDockContent.jsx';
import { KeeperConversation } from './KeeperConversation.jsx';
import { keeperSwim } from './keeperSwim.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './keeper.css';

function KeeperDock({ record, index, initialPresentation, store, profileAddress, hostRef, registerTarget,
  dockPositions, suspended, reducedMotion, flightAreaRef, motionSpace, navigationRef }) {
  const view = useWorkbenchView();
  const utility = useWorkbenchUtilityWindow(index ? index + 1 : 0, dockPositions?.current[record.id] || initialPresentation?.position,
    position => { if (dockPositions) dockPositions.current = { ...dockPositions.current, [record.id]: position }; });
  const [position, setPosition] = useState(utility.frame);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
  const [imageState, setImageState] = useState({ src: null, status: 'loading' });
  const [talking, setTalking] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    if (!settings || !view.setUtilitySettings) return;
    view.setUtilitySettings(current => new Set(current).add(record.id));
    return () => view.setUtilitySettings(current => { const next = new Set(current); next.delete(record.id); return next; });
  }, [settings, record.id, view.setUtilitySettings]);
  const settingsButton = useRef(null);
  const closeSettings = () => { setSettings(false); settingsButton.current?.focus({ preventScroll: true }); };
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
  const snake = movement === 'swim' && layered.rig?.kind === 'snake';
  const { phase, toggle, settle, captureReaction, cancelReaction, nudge } = useKeeperMotion({ dock, actor, rigActor, hostRef, flightAreaRef, motionSpace, enabled: Boolean(src) && status === 'ready' && !suspended,
    reducedMotion, faces: record.faces, size, movement, swim, paused: talking, onPosition: conversationPosition, getSelection });
  useEffect(() => { setTalking(false); }, [src, record.asset?.stableAssetId, movement, suspended, phase]);
  useEffect(() => { live.current = true; return () => { live.current = false; request.current++; }; }, []);
  useEffect(() => { request.current++; setLoading(false); }, [record, suspended]);
  useEffect(() => { settle(); }, [src, record.asset?.stableAssetId, movement, suspended, settle]);
  // The screen-window host owns live geometry. Keep its last position across
  // Workbench switches in this profile session, outside authored composition.
  const layout = useCallback(({ left, top }) => {
    setPosition(current => current.left === left && current.top === top ? current : { left, top });
  }, []);
  const change = useCallback((changes, expected = latest.current) => {
    if (!editable || !live.current) return false;
    try {
      if (!saveKeeperDock(store, profileAddress, expected, changes)) throw new Error('The Keeper dock was not saved. Try again.');
      setError(''); return true;
    } catch (failure) {
      setError(failure.message);
      // Drop failures must be visible even when settings were never opened.
      setSettings(true);
      return false;
    }
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
      if (live.current && ticket === request.current) { setError(failure.message); setSettings(true); }
      return false;
    } finally { if (live.current && ticket === request.current) setLoading(false); }
  }, [editable, change]);
  useEffect(() => {
    if (!editable || !registerTarget) return;
    registerTarget(record.id, { get node() { return dock.current; }, label: record.asset ? 'Replace Keeper artwork' : 'Give Keeper dock an inhabitant', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  }, [editable, registerTarget, record.id, Boolean(record.asset), acceptImage]);
  const retry = () => { setImageState({ src, status: 'loading' }); setAttempt(value => value + 1); };
  const navigatorFrame = editable && settings ? view.utilityWindows?.get('navigator')?.getBoundingClientRect() : null;
  const settingsBeside = navigatorFrame && navigatorFrame.left >= 320 && innerWidth >= 700;
  const settingsBottom = Math.min(position.top, navigatorFrame?.top ?? Infinity) - 8;
  const settingsAbove = !settingsBeside && settingsBottom > 72;
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
    <WorkbenchWindow label="Keeper dock" title={record.name} titleContent={<strong title={record.name}>Keeper</strong>}
      className="keeper-dock-window" chrome="flat" avoidControls={navigationRef?.current ? [navigationRef.current] : undefined}
      controls={editable && <button ref={settingsButton} type="button" className="workflow-tactile-control keeper-settings-button" data-workbench-selection-tools aria-label="Keeper settings" title="Keeper settings" aria-expanded={Boolean(settings)}
        onClick={() => settings ? closeSettings() : setSettings(true)}><Settings2 size={14} strokeWidth={1.6} /></button>}
      width={utility.frame.width} initialHeight={utility.frame.height} minimumWidth={utility.frame.width} minimumHeight={utility.frame.height}
      resizable={false} initialX={utility.frame.left} initialY={utility.frame.top} committedFrame={utility.frame} onLayoutCommit={utility.commit} onLayoutChange={layout}>
      <div ref={dock} className="keeper-dock" aria-busy={loading || src && status === 'loading' || undefined}>
        <button type="button" data-workbench-selection-tools aria-label={label} title={label} onClick={event => { if (!loading && !suspended) { if (status === 'failed' && src) retry(); else toggle(event); } }}
          aria-disabled={!src || loading || status === 'loading' || suspended || undefined} aria-pressed={phase !== 'docked'}>
          <KeeperDockContent empty={!src} away={phase !== 'docked'} label={loading || src && status === 'loading' ? 'Loading…' : !src ? 'Drop artwork' : status === 'failed' ? 'Retry' : phase === 'free' ? 'Return' : phase === 'returning' ? 'Returning' : 'Release'}>
          {src && (rigged ? layered.rig && !wrongSvg && <span className="keeper-dock-preview" aria-hidden="true"><KeeperRigArtwork rig={layered.rig} movement={movement} /></span>
            : <img key={`${src}:${attempt}`} src={src} alt="" draggable={false}
              onLoad={() => setImageState({ src, status: 'ready' })} onError={() => setImageState({ src, status: 'failed' })} />)}
          </KeeperDockContent>
        </button>
      </div>
    </WorkbenchWindow>
    {/* Keeper and its dock use viewport coordinates independently of the canvas. */}
    {createPortal(<>
    {src && <div ref={actor} className="keeper-roamer" data-workbench-selection-tools hidden={phase === 'docked' || suspended}>
      {rigged ? !wrongSvg && layered.rig && <KeeperRigArtwork key={`${src}:${attempt}:${movement}`} movement={movement} rig={layered.rig} ref={rigActor} headControl={headControl} />
        : <><img key={`${src}:${attempt}`} src={src} alt="" draggable={false} /><button {...headControl} type="button" className="workflow-tactile-control keeper-head keeper-head--flip" /></>}
    </div>}
    {talking && phase === 'free' && !suspended && record.asset && <KeeperConversation
      key={record.asset.stableAssetId} asset={record.asset} name={record.name} anchor={head} dock={dock} onClose={closeConversation}
      captureReaction={captureReaction} cancelReaction={cancelReaction}
      onPosition={conversationPosition}
      conversationScope={JSON.stringify([profileAddress, record.id, record.asset.stableAssetId])} />}
    </>, hostRef.current || document.body)}
    {editable && settings && createPortal(<div data-keeper-tools data-workbench-selection-tools>
      <WorkbenchWindow label="Keeper settings" title={record.name} titleContent={<strong>Keeper settings</strong>} chrome="flat" className="workbench-tool-window keeper-settings-window"
        avoidControls={navigationRef?.current ? [navigationRef.current] : undefined}
        width={300} initialHeight={320} minimumHeight={96} fitContent fitContentFromTop resizable={false}
        viewportBottom={settingsAbove ? settingsBottom : undefined}
        initialX={settingsBeside ? navigatorFrame.left - 308 : position.left >= 324 ? position.left - 308 : Math.max(8, Math.min(position.left + KEEPER_DOCK_SIZE.width + 8, innerWidth - 308))}
        initialY={Math.max(view.navigationTop || 8, settingsAbove ? (hostRef.current?.getBoundingClientRect().top || 0) + 8 : Math.min(position.top, innerHeight - 240))}
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
  useEffect(() => {
    if (props.dockPositions) props.dockPositions.current = Object.fromEntries(Object.entries(props.dockPositions.current)
      .filter(([id]) => records.some(record => record.id === id)));
  }, [records, props.dockPositions]);
  return createPortal(<div className="keeper-workbench" data-workbench-module="keeper">
    {records.map((record, index) => <KeeperDock key={`${props.profileAddress}:${record.id}`} {...props} record={record} index={index}
      initialPresentation={presentations?.find(item => item.id === record.id)} />)}
  </div>, props.hostRef.current || document.body);
}
