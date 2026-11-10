import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, List, Minimize2, X } from 'lucide-react';
import WorkbenchIndexRows from './WorkbenchIndexRows.jsx';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import WorkbenchToolPanel from './WorkbenchToolPanel.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { editWorkbenchIndex } from '../../systemWorkflow/workbenchIndexSession.js';
import { screenWorkbenchIndex, resolveWorkbenchDestination, workbenchDestinationAnchor } from '../../systemWorkflow/domain/workbenchIndex.js';
import { workbenchGroupWindowIds } from '../../systemWorkflow/domain/workbenchGroups.js';
import { workbenchDestinationCamera } from './workbenchNavigation.js';
import './workbenchIndex.css';

const empty = Object.freeze({});
const noSubscribe = () => () => {};

export default function WorkbenchIndex({ hostRef, navigation, sceneRef, entryTarget, showTrigger = true }) {
  const view = useWorkbenchView(), owner = Boolean(view.store);
  const { setSelection } = view;
  const content = useSyncExternalStore(view.store?.subscribe || noSubscribe,
    view.store?.getSnapshot || (() => view.groupContent || empty));
  const storedIndex = content.workbenchIndex;
  const index = useMemo(() => screenWorkbenchIndex(storedIndex), [storedIndex]);
  const [visitorOpen, setVisitorOpen] = useState(null);
  const [visitorPosition, setVisitorPosition] = useState(null);
  const [compact, setCompact] = useState(false), [error, setError] = useState('');
  const [preferredId, setPreferredId] = useState(null), [activeId, setActiveId] = useState(null);
  const open = owner ? index?.open : visitorOpen ?? index?.open;
  const panelRoot = useRef(null);
  const returnToModeButton = useRef(false);
  const modeButton = useCallback(button => {
    if (button && returnToModeButton.current) {
      returnToModeButton.current = false;
      button.focus({ preventScroll: true });
    }
  }, []);
  const frame = useMemo(() => {
    if (!index) return null;
    const full = visitorPosition && !owner ? { ...index.window, ...visitorPosition } : index.window;
    if (!compact || !index.destinations.length) return full;
    return { ...full, width: Math.min(480, 90 + index.destinations.length * 32), height: 40 };
  }, [index, compact, visitorPosition, owner]);
  const started = useRef(false), current = useRef(null);
  current.current = { content, index, navigation, preferredId };
  const getFrame = useCallback(id => view.frames.get(id)?.current, [view.frames]);
  const refreshActive = useCallback(() => {
    const { content, index, navigation, preferredId } = current.current;
    let match = null;
    if (!navigation.moving && index?.destinations.length) {
      const camera = navigation.getCamera(), viewport = navigation.navigationViewport();
      for (const item of index.destinations) {
        const bounds = resolveWorkbenchDestination(item, content, getFrame);
        const target = workbenchDestinationCamera(bounds, viewport, .25, 0);
        if (!target || Math.abs(target.scale - camera.scale) > 1e-7
          || Math.abs(target.offset.x - camera.offset.x) > .5 || Math.abs(target.offset.y - camera.offset.y) > .5) continue;
        // Two names can frame the same spot. Keep the one the user just chose.
        if (item.id === preferredId) { match = item.id; break; }
        match ??= item.id;
      }
    }
    setActiveId(match);
  }, [getFrame]);
  useLayoutEffect(() => {
    if (open) refreshActive();
  }, [open, navigation, content, preferredId, refreshActive, view.toolViewportBottom]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!open || !host) return;
    const size = new ResizeObserver(refreshActive), docks = new MutationObserver(refreshActive);
    size.observe(host);
    docks.observe(host, { attributes: true, attributeFilter: ['style'] });
    return () => { size.disconnect(); docks.disconnect(); };
  }, [hostRef, open, refreshActive]);
  const save = (next, label) => {
    try { editWorkbenchIndex(view.store, view.profileAddress, storedIndex, next, label); setError(''); return true; }
    catch (failure) { setError(failure.message); return false; }
  };
  const visit = useCallback(id => {
    const { navigation } = current.current;
    return navigation.focusDestination({ padding: 0, onArrive: () => { setPreferredId(id); setSelection([]); },
      prepare: () => sceneRef.current?.restore(null),
      getBounds: () => {
        const { index, content } = current.current;
        return resolveWorkbenchDestination(index?.destinations.find(item => item.id === id), content, getFrame);
      } });
  }, [sceneRef, getFrame, setSelection]);
  useEffect(() => {
    if (owner || entryTarget || started.current || !index?.landingId || navigation.locked) return;
    let second;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      if (visit(index.landingId)) started.current = true;
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [owner, entryTarget, index?.landingId, navigation.locked, visit]);
  useLayoutEffect(() => {
    if (open && activeId) panelRoot.current?.querySelector('[data-active], [aria-current="location"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }, [open, activeId, compact]);
  if (!index) return null;
  const toggle = () => owner ? save({ ...index, open: !open }, 'Toggle Index') : setVisitorOpen(!open);
  const update = (next, label = 'Edit destination') => {
    const clearStart = next.visibility === 'PRIVATE' && index.landingId === next.id;
    const destinations = index.destinations.map(item => item.id === next.id ? next : item);
    return save({ ...index, destinations, landingId: clearStart ? null : index.landingId }, label);
  };
  const withFollow = (item, groupId) => {
    const { follow: _follow, ...fixed } = item;
    if (!groupId) return fixed;
    const group = content.workbenchGroups?.find(group => group.id === groupId);
    const anchorId = group && workbenchGroupWindowIds(content, group).find(id =>
      workbenchDestinationAnchor(content, { groupId, anchorId: id }, getFrame));
    const origin = anchorId && workbenchDestinationAnchor(content, { groupId, anchorId }, getFrame);
    if (!origin) throw new Error('Open a member of this group before linking a view to it.');
    return { ...fixed, follow: { groupId, anchorId, origin: { left: origin.left, top: origin.top } } };
  };
  const capture = () => {
    if (Object.keys(view.presentationTransforms || {}).length) throw new Error('Return from the expanded group before saving its canvas view.');
    const region = navigation.captureView();
    if (!region) throw new Error('Let the camera settle before saving a view.');
    return region;
  };
  const run = action => { try { return action(); } catch (failure) { setError(failure.message); } };
  const isStrip = compact && index.destinations.length > 0;
  const go = id => {
    if (visit(id)) setError('');
    else { setError('This view is unavailable while another interaction is active.'); setCompact(false); }
  };
  const add = () => run(() => {
    let number = index.destinations.length + 1;
    while (index.destinations.some(item => item.name === `View ${number}`)) number++;
    const item = { id: `workbench-view:${crypto.randomUUID()}`, name: `View ${number}`, view: capture(), visibility: 'PUBLIC' };
    if (save({ ...index, destinations: [...index.destinations, item] }, 'Save view')) { setPreferredId(item.id); return item.id; }
  });
  const replace = item => run(() => {
    if (update(withFollow({ ...item, view: capture() }, item.follow?.groupId), 'Replace saved view')) setPreferredId(item.id);
  });
  const commitFrame = next => {
    const position = { left: next.left, top: next.top };
    if (!owner) { setVisitorPosition(position); return true; }
    const window = isStrip ? { ...index.window, ...position } : next;
    const saved = save({ ...index, window }, 'Move or resize Index');
    if (!saved) setCompact(false);
    return saved;
  };
  const modeLabel = isStrip ? 'Expand Index' : 'Show compact Index';
  const dockable = owner && !isStrip;
  const modeControl = <button type="button" ref={modeButton} aria-label={modeLabel} title={modeLabel}
    className={dockable ? 'workbench-tool-panel-close' : 'system-workflow__window-cap'}
    disabled={!index.destinations.length} onClick={() => { returnToModeButton.current = true; setCompact(!isStrip); }}>
    {isStrip ? <List /> : <Minimize2 />}
  </button>;
  const list = !isStrip && <div className="workbench-index__body" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor">
    <WorkbenchIndexRows {...{ index, owner, content, getFrame, navigation, go, save, update, add, replace, activeId }}
      follow={(item, groupId) => run(() => update(withFollow({ ...item, view: resolveWorkbenchDestination(item, content, getFrame) }, groupId)))} />
    {error && <p role="alert">{error}</p>}
  </div>;
  const panel = open && hostRef.current && createPortal(dockable
    ? <WorkbenchToolPanel dockId="Index" title="Index" label="Index — Destinations" role="complementary" moveLabel="Move Index window"
        onClose={toggle} closeLabel="Close Index" headerActions={modeControl} panelRef={panelRoot}
        chrome="flat" className="workbench-index__editor workbench-utility-panel workbench-editor-panel"
        data-workbench-index="true" data-system-workflow-panel="index" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor"
        frame={frame} onFrameChange={commitFrame} minimumWidth={240} minimumHeight={180} commitFloatingFrameOnRelease>{list}</WorkbenchToolPanel>
    : <div ref={panelRoot} className="workbench-index" data-system-workflow-panel="index" data-workbench-index="true">
    <WorkbenchWindow key={isStrip ? 'strip' : 'panel'} label="Index" title="Destinations" viewportBottom={globalThis.innerHeight - 8}
      chrome="flat" className={`workbench-tool-window workbench-index__window${isStrip ? ' workbench-index__strip' : ''}`}
      registerView={false} preserveAuthoredLayout width={frame.width} initialHeight={frame.height} initialX={frame.left} initialY={frame.top}
      minimumWidth={isStrip ? 80 : 240} minimumHeight={isStrip ? 40 : 180} resizableWidth resizable={false}
      committedFrame={frame} onLayoutCommit={commitFrame}
      titleContent={isStrip ? <>
        <GripVertical aria-hidden="true" />
        <nav className="workbench-index__numbers" aria-label="Saved views">{index.destinations.map((item, order) =>
          <button type="button" key={item.id} aria-label={`Go to ${item.name}`} title={`${order + 1} · ${item.name}`} disabled={navigation.locked}
            aria-current={activeId === item.id ? 'location' : undefined} onClick={() => go(item.id)}>{order + 1}</button>)}</nav>
      </> : <strong>Index</strong>}
      controls={<>
        {modeControl}
        {!isStrip && <button type="button" aria-label="Close Index" title="Close Index" className="system-workflow__window-cap" onClick={toggle}><X /></button>}
      </>}>
      {list}
    </WorkbenchWindow>
  </div>, hostRef.current);
  return <>{showTrigger && <button className="workflow-tactile-control" type="button" aria-label="Toggle Index" aria-expanded={open} disabled={navigation.locked} onClick={toggle}>Index</button>}{panel}</>;
}
