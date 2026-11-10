import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppWindow, Settings, X } from 'lucide-react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { createMiniAppPresentation, MINI_APP_WINDOW_LIMITS } from '../profileDocument/domain/workbenchPresentation.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { useClosedArtworkLayout, useWorkbenchView, workbenchModuleTransform } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { unprojectWorkbenchFrame } from '../public/ownerSystemWorkflow/workbenchSpace.js';
import { WORKBENCH_EDITING_BOUNDS } from '../systemWorkflow/domain/workbenchArea.js';
import { miniAppUrl } from './domain/miniApps.js';
import { saveMiniApp } from './miniAppSession.js';
import MiniAppFrame from './MiniAppFrame.jsx';
import HtmlArtworkFrame from './HtmlArtworkFrame.jsx';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import '../public/ownerSystemWorkflow/workbenchSharedTools.css';
import './miniApps.css';

function MiniAppSettings({ record, onSave, onCancel, onRemove }) {
  const camera = useWorkbenchCamera(), view = useWorkbenchView();
  const [original] = useState(record);
  const [name, setName] = useState(record.name), [url, setUrl] = useState(record.url);
  const [isPublic, setPublic] = useState(record.visibility === 'PUBLIC');
  const [error, setError] = useState('');
  const [artwork, setArtwork] = useState(record.surface === 'artwork');
  const submit = event => {
    event.preventDefault();
    const destination = miniAppUrl(url.trim(), { hostOrigin: location.origin, published: isPublic, allowLocal: import.meta.env.DEV, artwork });
    if (!destination) { setError('Enter an HTTPS URL for an external app.'); return; }
    const { surface: _surface, ...base } = original;
    let frame;
    if (artwork !== (original.surface === 'artwork')) {
      // The screen shell may already be clamped by the viewport. Start from
      // what the user sees, not the larger stored window behind that projection.
      const { left, top, width, height } = event.currentTarget.closest('[data-detached-window]').getBoundingClientRect();
      frame = { left, top, width, height };
      if (artwork) {
        const { scale, offset } = camera.getCamera();
        const target = workbenchModuleTransform({ ...view, scale }, original.id);
        frame = unprojectWorkbenchFrame({ scale: target.scale, offset: { x: offset.x + target.x, y: offset.y + target.y } }, frame);
      }
      const { minimumWidth, minimumHeight, maximumSize } = MINI_APP_WINDOW_LIMITS;
      frame.width = Math.min(maximumSize, Math.max(minimumWidth, frame.width));
      frame.height = Math.min(maximumSize, Math.max(minimumHeight, frame.height));
      const bounds = WORKBENCH_EDITING_BOUNDS;
      if (frame.left < bounds.left || frame.left > bounds.right || frame.top < bounds.top || frame.top > bounds.bottom) {
        setError('This position is outside the editing range. Move closer to the canvas and try again.'); return;
      }
    }
    if (!onSave(original, { ...base, ...(artwork ? { surface: 'artwork' } : {}), name: name.trim(), url: destination.href, visibility: isPublic ? 'PUBLIC' : 'PRIVATE' }, frame)) {
      setError('Changes could not be saved. The app or profile may have changed. Reopen settings before trying again.');
    }
  };
  return <form className="mini-app-settings workbench-inspector" onSubmit={submit}
    data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor">
    <label className="workbench-inspector-row"><span>Name</span>
      <input autoFocus required maxLength={48} value={name} onChange={e => setName(e.target.value)} /></label>
    <label className="workbench-inspector-row"><span>App URL</span>
      <input type="url" required maxLength={2048} placeholder="https://radar725.netlify.app/" value={url} onChange={e => setUrl(e.target.value)} /></label>
    <label className="workbench-inspector-check"><input type="checkbox" checked={artwork} onChange={e => setArtwork(e.target.checked)} />Transparent HTML artwork</label>
    <label className="workbench-inspector-check"><input type="checkbox" checked={isPublic} onChange={e => setPublic(e.target.checked)} />Include in publication</label>
    <p className="workbench-inspector-muted">{artwork ? 'The HTML file controls its animation in an isolated frame without wallet or microphone access.' : 'The app runs from its own website.'} Including it in publication shares its name and URL with visitors.</p>
    <div className="workbench-inspector-actions">
      <button className="workflow-tactile-control" type="button" onClick={onCancel}>Cancel</button>
      <button className="workflow-tactile-control" data-primary type="submit">Save</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="mini-app-settings__remove">
      <button className="workflow-tactile-control" type="button" onClick={() => { if (!onRemove(original)) setError('The app could not be removed. Reopen settings before trying again.'); }}>Remove app</button>
    </div>
  </form>;
}

function MiniAppInstance({ record, initialPresentation, index, store, profileAddress, onPresentationChange, onConnect, suspended, active, onActivate }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createMiniAppPresentation(record.id, index));
  const saved = store?.getSnapshot().workbench?.miniApps?.find(item => item.id === record.id);
  // Identical coordinates in the two spaces still represent different frames.
  const committedLayout = useMemo(() => ({ surface: record.surface, window: saved?.window && { ...saved.window } }), [saved?.window, record.surface]);
  const committedFrame = committedLayout.window;
  useClosedArtworkLayout(presentation, setPresentation, saved);
  const [editing, setEditing] = useState(!record.url), [microphone, setMicrophone] = useState(false), [reload, setReload] = useState(0);
  const settingsTrigger = useRef(null), shortcut = useRef(null), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (suspended) setMicrophone(false); }, [suspended]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const changeLayout = useCallback(window => setPresentation(current => JSON.stringify(window) === JSON.stringify(current.window)
    ? current : { ...current, window }), []);
  const close = () => {
    setPresentation(current => ({ ...current, open: false })); setMicrophone(false);
    queueMicrotask(() => shortcut.current?.focus());
  };
  const finishEditing = () => { setEditing(false); queueMicrotask(() => settingsTrigger.current?.focus()); };
  const save = (expected, next, window) => {
    if (!mounted.current || !saveMiniApp(store, profileAddress, expected, next, window && { previous: presentation, window })) return false;
    if (next) finishEditing();
    return true;
  };
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'mini-app', record: record });
  const artwork = record.surface === 'artwork';
  const settingsOpen = editing && Boolean(store) && presentation.open;
  const headerButtonClass = settingsOpen ? 'workflow-tactile-control workflow-tactile-control--quiet' : 'system-workflow__round-control';
  const url = miniAppUrl(record.url, { hostOrigin: location.origin, allowLocal: import.meta.env.DEV, artwork });
  return <div className="mini-app-workbench" data-workbench-module="mini-app" data-mini-app-id={record.id} data-editing={settingsOpen || undefined}
    style={{ '--mini-app-z': active ? 49 : 45, '--mini-app-shortcut-bottom': `${64 + index * 38}px` }} onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    {shortcutMenu.content}
    {!presentation.open && <button data-workbench-pan ref={shortcut} className="mini-app-shortcut" onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown} type="button" onClick={() => {
      setPresentation(current => ({ ...current, open: true })); onActivate();
    }}><AppWindow size={18} /><span>{record.name}</span></button>}
    {presentation.open && <WorkbenchWindow label={artwork ? "Artwork" : "Mini app"} chrome={settingsOpen ? 'flat' : undefined}
      className={settingsOpen ? 'mini-app-settings-window' : artwork ? 'mini-app-artwork-window' : ''} title={record.name} width={presentation.window.width} resizableWidth
      viewId={artwork ? record.id : undefined} preserveAuthoredLayout={!artwork} placementModule={artwork && Boolean(store)}
      minimumWidth={MINI_APP_WINDOW_LIMITS.minimumWidth} minimumHeight={MINI_APP_WINDOW_LIMITS.minimumHeight}
      initialX={presentation.window.left} initialY={presentation.window.top} initialHeight={presentation.window.height} committedFrame={committedFrame}
      onLayoutChange={changeLayout} controls={<>
        {store && <button ref={settingsTrigger} type="button" className={headerButtonClass} aria-label={`Settings for ${record.name}`}
          onClick={() => { setMicrophone(false); setEditing(current => !current); }}><Settings /></button>}
        <button type="button" className={headerButtonClass} aria-label={`Close ${record.name}`} onClick={close}><X /></button>
      </>}>
      {settingsOpen ? <MiniAppSettings record={record} onSave={save} onCancel={finishEditing} onRemove={expected => save(expected, null)} />
        : !url ? <div className="mini-app-status">Set this app’s URL in Settings to open it.</div>
          : suspended ? <div className="mini-app-status">App paused during preview.</div>
            : artwork ? <HtmlArtworkFrame url={url} name={record.name} width={presentation.window.width} height={presentation.window.height} />
            : <MiniAppFrame key={`${record.url}:${microphone}:${reload}`} {...{ url, profileAddress, microphone, onConnect }} name={record.name}
              onMicrophoneChange={setMicrophone} onReload={() => { setMicrophone(false); setReload(current => current + 1); }} />}
    </WorkbenchWindow>}
  </div>;
}

export default function MiniAppsWorkbench({ records, presentations, store, profileAddress, onPresentationChange, onConnect, suspended }) {
  const [active, setActive] = useState(null);
  return records.map((record, index) => <MiniAppInstance key={`${profileAddress}:${record.id}`} {...{ record, index, store, profileAddress, onPresentationChange, onConnect, suspended }}
    initialPresentation={presentations?.find(item => item.id === record.id)} active={active === record.id}
    onActivate={() => setActive(record.id)} />);
}
