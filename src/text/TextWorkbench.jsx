import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { X, Settings, Eye, Pencil } from '../public/InscapeIcons.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { ARTICLE_FONTS, assertArticle } from './domain/article.js';
import { saveTextModule } from './textSession.js';
import ArticleView from './ArticleView.jsx';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './text.css';
const ArticleEditor = lazy(() => import('./ArticleEditor.jsx'));

function TextInstance({ record, index, store, profileAddress, assets, registerTarget, initialPresentation, onPresentationChange, suspended, active, onActivate }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createTextPresentation(record.id, index));
  const [mode, setMode] = useState(store ? 'write' : 'read'), [settings, setSettings] = useState(false);
  const [working, setWorking] = useState(record), [error, setError] = useState('');
  const latest = useRef(record), workingRef = useRef(working), failed = useRef(false), surface = useRef(null), editor = useRef(null), shortcut = useRef(null), live = useRef(true);
  workingRef.current = working;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!failed.current) { latest.current = record; setWorking(record); }
  }, [record]);
  const change = useCallback(next => {
    try {
      assertArticle(next.article); setWorking(next); workingRef.current = next;
      if (!live.current || !saveTextModule(store, profileAddress, latest.current, next)) throw new Error('Not saved locally. Retry saving. The saved draft may have changed in another tab.');
      latest.current = next; failed.current = false; setError(''); return true;
    } catch (e) { failed.current = true; setError(e.message); return false; }
  }, [store, profileAddress]);
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
  const close = () => { setPresentation(p => ({ ...p, open: false })); queueMicrotask(() => shortcut.current?.focus()); };
  return <div className="text-workbench" data-workbench-module="text" data-text-id={record.id}
    style={{ '--text-z': active ? 49 : 46, '--text-shortcut-bottom': `${64 + index * 38}px` }} onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    {shortcutMenu.content}
    {!presentation.open && <button ref={shortcut} className="text-shortcut" onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown}
      onClick={() => setPresentation(p => ({ ...p, open: true }))}>{name}</button>}
    {presentation.open && <WorkbenchWindow label="Text" title={name} titleContent={<span />} chrome="bevel" resizableWidth
      className={`text-window${mode === 'read' ? ' text-window--read' : ''}`}
      width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top} onLayoutChange={layout}
      controls={<>{store && <><button type="button" className="system-workflow__round-control" aria-label={mode === 'write' ? 'Read' : 'Write'} title={mode === 'write' ? 'Read' : 'Write'}
          onClick={() => { setSettings(false); setMode(current => current === 'write' ? 'read' : 'write'); }}>{mode === 'write' ? <Eye /> : <Pencil />}</button>
        <button type="button" className="system-workflow__round-control" aria-label="Text settings" title="Text settings" aria-expanded={settings} onClick={() => setSettings(s => !s)}><Settings /></button></>}
        <button type="button" className="system-workflow__round-control" aria-label={`Close ${name}`} onClick={close}><X /></button></>}>
      <div className="text-module-body" ref={surface}>
        <div className="text-module-scroll" tabIndex={0} role="region" aria-label="Article content">
          {store && settings && <section className="text-settings" aria-label="Text settings">
            <button type="button" aria-label="Close Text settings" onClick={() => setSettings(false)}><X /></button>
            <label>Document font<select aria-label="Document font" value={working.article.font} onChange={e => change({ ...working, article: { ...working.article, font: e.target.value } })}>
              {ARTICLE_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
            <label className="text-visibility"><input type="checkbox" checked={working.visibility === 'PUBLIC'} onChange={e => change({ ...working, visibility: e.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in Workbench publication</label>
            {!failed.current && <p className="text-save-summary">Saved in this browser</p>}
            <label>Insert Library artwork<select aria-label="Insert Library artwork" value="" disabled={mode !== 'write'} onChange={e => acceptImage(assets.find(a => (a.id || a.stableAssetId) === e.target.value))}>
              <option value="">Choose an image…</option>{assets.filter(a => a.imageUrl || a.media?.type === 'image' || a.src).map(a => <option key={a.id || a.stableAssetId} value={a.id || a.stableAssetId}>{a.name || 'Artwork'}</option>)}</select></label>
          </section>}
          {store && <div hidden={mode !== 'write'}><Suspense fallback={<p role="status">Opening editor…</p>}><ArticleEditor article={working.article}
            onChange={article => change({ ...workingRef.current, article })} onEditor={setEditor} disabled={suspended || mode !== 'write'} /></Suspense></div>}
          {mode === 'read' && <ArticleView article={working.article} />}
        </div>
        {store && error && <div className="text-status" role="alert">{error}
          {failed.current && <button type="button" onClick={() => change(working)}>Retry local save</button>}</div>}
      </div>
    </WorkbenchWindow>}
  </div>;
}
export default function TextWorkbench({ records, presentations, store, profileAddress, assets = [], registerTarget, onPresentationChange, suspended = false }) {
  const [active, setActive] = useState(null);
  return records.map((record, index) => <TextInstance key={`${profileAddress}:${record.id}`} {...{ record, index, store, profileAddress, assets, registerTarget, onPresentationChange, suspended }}
    initialPresentation={presentations?.find(p => p.id === record.id)} active={active === record.id} onActivate={() => setActive(record.id)} />);
}
