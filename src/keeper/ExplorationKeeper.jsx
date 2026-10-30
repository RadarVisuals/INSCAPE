import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import ProfileEditingBoundary from '../systemWorkflow/ProfileEditingBoundary.jsx';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { WorkbenchViewProvider } from '../public/ownerSystemWorkflow/WorkbenchView.jsx';
import OwnerSystemWorkflowLibraryWorkspace from '../public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx';
import useOwnerLatticeBrowser from '../public/useOwnerLatticeBrowser.js';
import useOwnerSystemWorkflowLayout from '../public/ownerSystemWorkflow/useOwnerSystemWorkflowLayout.js';
import KeeperWorkbench from './KeeperWorkbench.jsx';
import { KEEPER_DOCK_SIZE } from './keeper.js';
import { addKeeperDock } from './keeperSession.js';
import { createExplorationSpace, EXPLORATION_PIECES, EXPLORATION_WALLS, EXPLORATION_ROOM } from './explorationSpace.js';

export default function ExplorationKeeper(props) {
  return <ProfileEditingBoundary profileAddress={props.profileAddress} onView={props.onReturn}>
    <KeeperRoomSession {...props} />
  </ProfileEditingBoundary>;
}

function KeeperRoomSession(props) {
  const [source] = useState(() => {
    try {
      const store = createSystemWorkflowDraftStore({ profileAddress: props.profileAddress, storage: localStorage, requireEditor: true });
      if (store.getRecordState().status !== 'valid') return { error: 'Open your Workbench first to load or recover your local draft, then return here.' };
      return { store };
    } catch { return { error: 'Your local draft could not be opened. Return to your Workbench to recover it.' }; }
  });
  if (!source.store) return <p role="status" className="exploration-keeper-notice">{source.error}</p>;
  return <KeeperRoom store={source.store} {...props} />;
}

function RoomLibrary({ profileAddress, ...props }) {
  const browser = useOwnerLatticeBrowser(profileAddress);
  return <OwnerSystemWorkflowLibraryWorkspace {...props} data={browser.data} categoryCommands={browser.commands} phase="open" placementScope={`${profileAddress}:exploration-keeper`} />;
}

function KeeperRoom({ store, profileAddress, flightAreaRef, menuSurface }) {
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [error, setError] = useState(''), [libraryOpen, setLibraryOpen] = useState(false), [selected, setSelected] = useState(null);
  const libraryButton = useRef(null), previousLibrary = useRef(false), dockTarget = useRef(null);
  const scene = useRef(null);
  const [zoom, setZoom] = useState(1);
  const layout = useOwnerSystemWorkflowLayout();
  const motionSpace = useMemo(() => createExplorationSpace({
    getRectangle: () => flightAreaRef.current?.getBoundingClientRect(), reducedMotion: layout.reducedMotion, animateZoom: true,
    paintScene: camera => {
      if (!scene.current) return;
      scene.current.style.transform = `scale(${camera.zoom}) translate3d(${-camera.x}px, ${-camera.y}px, 0)`;
      scene.current.style.transformOrigin = '0 0';
      scene.current.dataset.zoom = camera.zoom;
      scene.current.dataset.cameraX = camera.x; scene.current.dataset.cameraY = camera.y;
    },
  }), [flightAreaRef, layout.reducedMotion]);
  useLayoutEffect(() => { motionSpace.reset(); setZoom(motionSpace.getZoom()); return () => motionSpace.dispose(); }, [motionSpace]);
  const toggleZoom = useCallback(() => {
    const next = motionSpace.getTargetZoom() === 1 ? .5 : 1;
    motionSpace.setZoom(next); setZoom(next);
  }, [motionSpace]);
  useEffect(() => {
    const key = event => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
        || event.key.toLowerCase() !== 'f' || libraryOpen) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]')) return;
      if (event.target !== document.body && !flightAreaRef.current?.contains(event.target)) return;
      event.preventDefault(); toggleZoom();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [toggleZoom, libraryOpen, flightAreaRef]);
  const records = draft.keeperDocks || [];
  const record = records.find(item => item.id === selected) || records[0];
  const registerTarget = useCallback((_id, target) => { dockTarget.current = target; }, []);
  const moduleTargets = useRef({
    targetAt: point => dockTarget.current?.node?.contains(document.elementFromPoint(point.x, point.y)) ? dockTarget.current : null,
    has: target => dockTarget.current === target,
  });
  const placementTarget = useRef({ captureTarget: () => dockTarget.current });
  const emptyTarget = useRef(null);
  const create = useCallback(() => {
    try { setSelected(addKeeperDock(store, profileAddress, { movement: 'swim' })); setError(''); }
    catch (failure) { setError(failure.message); }
  }, [store, profileAddress]);
  useEffect(() => { if (!store.getDraft().keeperDocks?.length) create(); }, [store, create]);
  useLayoutEffect(() => {
    if (!libraryOpen && previousLibrary.current) libraryButton.current?.focus({ preventScroll: true });
    previousLibrary.current = libraryOpen;
  }, [libraryOpen]);
  const bounds = flightAreaRef.current?.getBoundingClientRect();
  // The room's dock position is temporary presentation. Its inhabitant and
  // settings use the existing authoritative record, not a second room draft.
  const presentation = record ? [{ id: record.id, position: { left: Math.max(16, (bounds?.right || innerWidth) - KEEPER_DOCK_SIZE.width - 40), top: Math.max(100, (bounds?.bottom || innerHeight) - KEEPER_DOCK_SIZE.height - 42) } }] : [];
  return <WorkbenchViewProvider store={store} profileAddress={profileAddress}>
    <div className="exploration-world-viewport" aria-label="Exploration world">
      <div ref={scene} className="exploration-world" style={{ width: EXPLORATION_ROOM.width, height: EXPLORATION_ROOM.height }}>
        {EXPLORATION_PIECES.map((piece, index) => <div key={index} className="exploration-environment" style={{ left: piece.x, top: piece.y, width: piece.size }}>
          <img src="/exploration/environment.webp" alt="Red, ivory and grey illustrated architectural corner" draggable={false} />
        </div>)}
        {EXPLORATION_WALLS.map((wall, index) => <div key={index} className="exploration-environment__wall" aria-label={index % 2 ? 'Solid vertical metal edge' : 'Solid horizontal metal edge'}
          style={{ left: wall.left, top: wall.top, width: wall.right - wall.left, height: wall.bottom - wall.top }} />)}
        <span className="exploration-home-marker" style={{ left: EXPLORATION_ROOM.home.x, top: EXPLORATION_ROOM.home.y }}>START</span>
      </div>
    </div>
    <div className="exploration-keeper-controls" data-workbench-selection-tools>
      <button type="button" ref={libraryButton} aria-expanded={libraryOpen} onClick={() => setLibraryOpen(value => !value)}>Library</button>
      <button type="button" onClick={toggleZoom} aria-keyshortcuts="f" aria-pressed={zoom === .5}>{zoom === 1 ? 'Overview · 50% (F)' : 'Normal · 100% (F)'}</button>
      {records.length > 1 && <label>Keeper<select aria-label="Room Keeper" value={record.id} onChange={event => { setSelected(event.target.value); setLibraryOpen(false); }}>
        {records.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
      {!record && <button type="button" onClick={create}>Add Keeper dock</button>}
      <span>Camera follows Keeper · Hold right mouse to explore · Click for a destination · Only the metal beams are solid · Return recalls directly.</span>
      {error && <p role="alert">{error}</p>}
    </div>
    <KeeperWorkbench records={record ? [record] : []} presentations={presentation} store={store} profileAddress={profileAddress}
      hostRef={flightAreaRef} flightAreaRef={flightAreaRef} motionSpace={motionSpace} registerTarget={registerTarget} reducedMotion={layout.reducedMotion} windowSnap={false} />
    {libraryOpen && <RoomLibrary key={`${profileAddress}:${record?.id || ''}`} profileAddress={profileAddress} menuSurface={menuSurface}
      onClose={() => setLibraryOpen(false)} workspaceRef={flightAreaRef} moduleAssetTargetRef={moduleTargets} placementTargetRef={placementTarget}
      workbenchImageTargetRef={emptyTarget} shortcutTargetRef={emptyTarget} />}
  </WorkbenchViewProvider>;
}
