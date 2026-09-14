import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppWindow, Settings, X } from 'lucide-react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { createMiniAppPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { miniAppUrl } from './domain/miniApps.js';
import { saveMiniApp } from './miniAppSession.js';
import MiniAppFrame from './MiniAppFrame.jsx';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './miniApps.css';

function MiniAppSettings({ record, onSave, onCancel, onRemove }) {
  const [original] = useState(record);
  const [name, setName] = useState(record.name), [url, setUrl] = useState(record.url);
  const [isPublic, setPublic] = useState(record.visibility === 'PUBLIC');
  const [error, setError] = useState('');
  const submit = event => {
    event.preventDefault();
    const destination = miniAppUrl(url.trim(), { hostOrigin: location.origin, published: isPublic, allowLocal: import.meta.env.DEV });
    if (!destination) { setError('Enter an HTTPS URL for an external app.'); return; }
    if (!onSave(original, { ...original, name: name.trim(), url: destination.href, visibility: isPublic ? 'PUBLIC' : 'PRIVATE' })) {
      setError('Changes could not be saved. The app or profile may have changed. Reopen settings before trying again.');
    }
  };
  return <form className="mini-app-settings" onSubmit={submit}>
    <label>Name<input autoFocus required maxLength={48} value={name} onChange={e => setName(e.target.value)} /></label>
    <label>App URL<input type="url" required maxLength={2048} placeholder="https://radar725.netlify.app/" value={url} onChange={e => setUrl(e.target.value)} /></label>
    <label className="mini-app-settings__visibility"><input type="checkbox" checked={isPublic} onChange={e => setPublic(e.target.checked)} />Include in publication</label>
    <p>The app runs from its own website. Including it in publication shares its name and URL with visitors.</p>
    <div className="mini-app-settings__actions"><button type="submit">Save</button><button type="button" onClick={onCancel}>Cancel</button>
      <button type="button" onClick={() => { if (!onRemove(original)) setError('The app could not be removed. Reopen settings before trying again.'); }}>Remove app</button></div>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function MiniAppInstance({ record, initialPresentation, index, store, profileAddress, onPresentationChange, onConnect, suspended, active, onActivate }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createMiniAppPresentation(record.id, index));
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
  const save = (expected, next) => {
    if (!mounted.current || !saveMiniApp(store, profileAddress, expected, next)) return false;
    if (next) finishEditing();
    return true;
  };
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'mini-app', record: record });
  const url = miniAppUrl(record.url, { hostOrigin: location.origin, allowLocal: import.meta.env.DEV });
  return <div className="mini-app-workbench" data-workbench-module="mini-app" data-mini-app-id={record.id}
    style={{ '--mini-app-z': active ? 49 : 45, '--mini-app-shortcut-bottom': `${64 + index * 38}px` }} onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    {shortcutMenu.content}
    {!presentation.open && <button ref={shortcut} className="mini-app-shortcut" onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown} type="button" onClick={() => {
      setPresentation(current => ({ ...current, open: true })); onActivate();
    }}><AppWindow size={18} /><span>{record.name}</span></button>}
    {presentation.open && <WorkbenchWindow label="Mini app" title={record.name} width={presentation.window.width} resizableWidth
      initialX={presentation.window.left} initialY={presentation.window.top} initialHeight={presentation.window.height}
      onLayoutChange={changeLayout} controls={<>
        {store && <button ref={settingsTrigger} type="button" className="system-workflow__round-control" aria-label={`Settings for ${record.name}`}
          onClick={() => { setMicrophone(false); setEditing(current => !current); }}><Settings /></button>}
        <button type="button" className="system-workflow__round-control" aria-label={`Close ${record.name}`} onClick={close}><X /></button>
      </>}>
      {editing && store ? <MiniAppSettings record={record} onSave={save} onCancel={finishEditing} onRemove={expected => save(expected, null)} />
        : !url ? <div className="mini-app-status">Set this app’s URL in Settings to open it.</div>
          : suspended ? <div className="mini-app-status">App paused during preview.</div>
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
