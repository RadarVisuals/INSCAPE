import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { X, Settings, Eye, Pencil } from '../public/InscapeIcons.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { assertArticle, textOutputStyle } from './domain/article.js';
import { saveTextModuleResult } from './textSession.js';
import TextTools from './TextTools.jsx';
import TextMoveHandle from './TextMoveHandle.jsx';
import ArticleView from './ArticleView.jsx';
import TextViewport from './TextViewport.jsx';
import { textRecoveryScope, readTextRecovery, retainTextRecovery, clearTextRecovery } from './textEditRecovery.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './text.css';
const ArticleEditor = lazy(() => import('./ArticleEditor.jsx'));

function TextInstance({ record, index, store, profileAddress, assets, registerTarget, placementTargets, initialPresentation, onPresentationChange, suspended, active, onActivate, windowSnap, initialView, onViewChange }) {
  const scope = textRecoveryScope(profileAddress, record.id);
  const recovered = readTextRecovery(store, scope);
  const [presentation, setPresentation] = useState(() => initialPresentation || createTextPresentation(record.id, index));
  const [mode, setMode] = useState(store ? initialView?.mode || 'write' : 'read'), [settings, setSettings] = useState(Boolean(store) && (initialView?.settings ?? true));
  const [controlsHost, setControlsHost] = useState(null), [reason, setReason] = useState(recovered?.failure.reason || null), [destination, setDestination] = useState('');
  const toolsTrigger = useRef(null);
  useEffect(() => { onViewChange?.(record.id, { mode, settings }); }, [record.id, mode, settings, onViewChange]);
  useEffect(() => () => onViewChange?.(record.id, null), [record.id, onViewChange]);
  const [working, setWorking] = useState(recovered?.value || record), [error, setError] = useState(recovered?.failure.message || '');
  const latest = useRef(recovered?.expected || record), workingRef = useRef(working), failed = useRef(Boolean(recovered)), surface = useRef(null), editor = useRef(null), shortcut = useRef(null), live = useRef(true);
  workingRef.current = working;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!failed.current) return;
    const guard = event => { event.preventDefault(); event.returnValue = ''; };
    globalThis.addEventListener('beforeunload', guard);
    return () => globalThis.removeEventListener('beforeunload', guard);
  }, [error]);
  useEffect(() => {
    if (!failed.current) { latest.current = record; setWorking(record); }
  }, [record]);
  const change = useCallback((next, options) => {
    try {
      assertArticle(next.article); setWorking(next); workingRef.current = next;
      if (!live.current) return false;
      const result = saveTextModuleResult(store, profileAddress, latest.current, next, options);
      setReason(result.reason || null);
      if (!result.saved) { retainTextRecovery(store, scope, latest.current, next, result); throw new Error(result.message); }
      clearTextRecovery(store, scope);
      latest.current = result.record; workingRef.current = result.record; setWorking(result.record);
      failed.current = false; setError(''); return true;
    } catch (e) { failed.current = true; setError(e.message); return false; }
  }, [store, profileAddress, record.id]);
  const setEditor = useCallback(value => { editor.current = value; }, []);
  const acceptImage = useCallback(asset => {
    if (!live.current || !editor.current || suspended || !presentation.open || mode !== 'write') return false;
    const id = asset.stableAssetId || asset.id;
    try {
      const resolved = createProfileDocumentV9AssetResolver([{ ...(asset.assetRecord || asset), id }], { compactContentReference: false })(id, asset.selectedMedia);
      if (resolved.media.type !== 'image') throw new Error('Choose a Library image.');
      return editor.current.chain().focus().insertContent({ type: 'artwork', attrs: { asset: resolved, alt: resolved.name || '', caption: '' } }).run();
    } catch (e) { setError(e.message); return false; }
  }, [suspended, presentation.open, mode]);
  useEffect(() => {
    if (!store || !registerTarget || suspended || !presentation.open || mode !== 'write') return;
    registerTarget(record.id, { get node() { return surface.current; }, label: 'Insert artwork into article', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  }, [record.id, store, registerTarget, suspended, presentation.open, mode, acceptImage]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const layout = useCallback(window => setPresentation(current => JSON.stringify(current.window) === JSON.stringify(window) ? current : { ...current, window }), []);
  const name = working.article.title || 'Untitled article';
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'text', record });
  const close = () => { if (failed.current) { setSettings(true); return; } setPresentation(p => ({ ...p, open: false })); queueMicrotask(() => shortcut.current?.focus()); };
  const closeTools = () => { setSettings(false); queueMicrotask(() => toolsTrigger.current?.focus()); };
  const moveInto = preview => {
    if (!preview?.target?.isCurrent()) throw new Error('Choose an open, unlocked Display.');
    if (!change(workingRef.current, { retry: true })) return;
    preview.target.attachText(latest.current, preview);
  };
  const destinations = placementTargets?.current?.textTargets?.() || [];
  return <div className="text-workbench" data-workbench-module="text" data-text-id={record.id}
    style={{ '--text-z': active ? 49 : 46, '--text-shortcut-bottom': `${64 + index * 38}px` }} onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    {shortcutMenu.content}
    {!presentation.open && <button ref={shortcut} className="text-shortcut" onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown}
      onClick={() => setPresentation(p => ({ ...p, open: true }))}>{name}</button>}
    {presentation.open && <WorkbenchWindow label="Text" title={name} titleContent={<span />} chrome="bevel" resizableWidth snapToGrid={Boolean(store) && windowSnap}
      surfaceStyle={working.article.appearance?.edges ? { boxShadow: working.article.appearance.edges.shadow ? 'var(--workflow-window-chrome-shadow)' : 'none', borderRadius: working.article.appearance.edges.corners.map(v => `${v}px`).join(' ') } : undefined} placementModule={Boolean(store)} className="text-window text-window--read"
      width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top} onLayoutChange={layout}
      controls={<>{store && <><button type="button" className="system-workflow__round-control" aria-label={mode === 'write' ? 'Read' : 'Write'} title={mode === 'write' ? 'Read' : 'Write'}
          onClick={() => { setMode(current => current === 'write' ? 'read' : 'write'); }}>{mode === 'write' ? <Eye /> : <Pencil />}</button>
        <TextMoveHandle label="Drag Text into Display" disabled={suspended} previewAt={(point, rectangle) => placementTargets?.current?.previewTextAt?.(point, rectangle)}
          onDrop={preview => { if (preview) moveInto(preview); }} onKeyboardMove={() => setSettings(true)} onError={setError} />
        <button ref={toolsTrigger} type="button" className="system-workflow__round-control" aria-label="Text tools" title="Text tools" aria-expanded={settings} onClick={() => setSettings(s => !s)}><Settings /></button>
        {error && <button type="button" className="text-save-error" aria-label="Text not saved — open recovery" onClick={() => setSettings(true)}>!</button>}</>}
        <button type="button" className="system-workflow__round-control" aria-label={`Close ${name}`} onClick={close}><X /></button></>}>
      <div className="text-module-body" data-module-edges={Boolean(working.article.appearance?.edges) || undefined} ref={surface} style={{ ...textOutputStyle(working.article, presentation.window), ...(working.article.appearance?.edges ? { boxShadow: 'none' } : {}) }}>
        <TextViewport automaticPadding={!working.article.appearance?.padding && !working.article.appearance?.compact} mode={mode}>
          {store && <div hidden={mode !== 'write'}><Suspense fallback={<p role="status">Opening editor…</p>}><ArticleEditor article={working.article}
            onChange={article => change({ ...workingRef.current, article })} onEditor={setEditor} controlsHost={controlsHost} disabled={suspended || mode !== 'write'} /></Suspense></div>}
          {mode === 'read' && <ArticleView article={working.article} />}
        </TextViewport>
        {working.article.appearance?.edges && <><span aria-hidden="true" className="module-surface-grain" /><span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: working.article.appearance.frame ? `inset 0 0 0 1px ${working.article.appearance.color}` : undefined }} /></>}
      </div>
    </WorkbenchWindow>}
    {store && presentation.open && settings && !suspended && <TextTools article={working.article} onChange={article => change({ ...workingRef.current, article })}
      controlsRef={setControlsHost} onClose={closeTools} disabled={suspended} initialX={presentation.window.left + presentation.window.width + 12} initialY={presentation.window.top}>
      <label className="text-visibility"><input type="checkbox" checked={working.visibility === 'PUBLIC'} onChange={e => change({ ...workingRef.current, visibility: e.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in Workbench publication</label>
      <label>Insert Library artwork<select aria-label="Insert Library artwork" value="" disabled={mode !== 'write'} onChange={e => acceptImage(assets.find(a => (a.id || a.stableAssetId) === e.target.value))}>
        <option value="">Choose an image…</option>{assets.filter(a => a.imageUrl || a.media?.type === 'image' || a.src).map(a => <option key={a.id || a.stableAssetId} value={a.id || a.stableAssetId}>{a.name || 'Artwork'}</option>)}</select></label>
      {destinations.length > 0 && <><label>Move into Display<select aria-label="Text destination" value={destination} onChange={e => setDestination(e.target.value)}>
        <option value="">Choose a Display…</option>{destinations.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
        <button type="button" disabled={!destination} onClick={() => {
          try {
            const target = destinations.find(item => item.id === destination), bounds = target?.node?.getBoundingClientRect();
            if (!bounds) throw new Error('Display is no longer available.');
            const rectangle = surface.current.getBoundingClientRect();
            const point = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
            const preview = target.previewTextAt(point, { left: point.x - rectangle.width / 2, top: point.y - rectangle.height / 2, width: rectangle.width, height: rectangle.height }, true);
            moveInto({ ...preview, target });
          } catch (failure) { setError(failure.message); }
        }}>Move into Display</button></>}
      {error ? <div className="text-status" role="alert">{error}
        {failed.current && <button type="button" onClick={() => change(workingRef.current, { retry: true })}>Retry local save</button>}
        {reason === 'conflict' && <button type="button" onClick={() => change(workingRef.current, { retry: true, replace: true })}>Replace saved Text with my edits</button>}
      </div> : <p className="text-save-summary" role="status">Saved in this browser</p>}
    </TextTools>}
  </div>;
}
export default function TextWorkbench({ records, presentations, store, profileAddress, assets = [], registerTarget, placementTargets, onPresentationChange, suspended = false, windowSnap = false, views, onViewChange }) {
  const [active, setActive] = useState(null);
  return records.map((record, index) => <TextInstance key={`${profileAddress}:${record.id}`} {...{ record, index, store, profileAddress, assets, registerTarget, placementTargets, onPresentationChange, suspended, windowSnap }}
    initialView={views?.[record.id]} onViewChange={onViewChange} initialPresentation={presentations?.find(p => p.id === record.id)} active={active === record.id} onActivate={() => setActive(record.id)} />);
}
