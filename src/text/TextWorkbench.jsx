import { useSceneNavigation, useSceneProgress } from './SceneNavigation.jsx';
import { passageArticle, editPassage, textDisplays } from './scenePassages.js';
import PagedArticle from './PagedArticle.jsx';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Settings, Eye, Pencil } from '../public/InscapeIcons.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { useWorkbenchView, workbenchModuleTransform } from '../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { assertArticle, textOutputStyle } from './domain/article.js';
import { saveTextModuleResult, unlinkTextModuleResult, prepareTextResize } from './textSession.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import TextTools from './TextTools.jsx';
import TextMoveHandle from './TextMoveHandle.jsx';
import ArticleView from './ArticleView.jsx';
import TextViewport from './TextViewport.jsx';
import { textRecoveryScope, readTextRecovery, retainTextRecovery, clearTextRecovery } from './textEditRecovery.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './text.css';
const ArticleEditor = lazy(() => import('./ArticleEditor.jsx'));

function TextInstance({ record, index, store, profileAddress, assets, registerTarget, placementTargets, initialPresentation, onPresentationChange, suspended, active, onActivate, windowSnap, initialView, onViewChange }) {
  const view = workbenchModuleTransform(useWorkbenchView(), record.id);
  const scope = textRecoveryScope(profileAddress, record.id);
  const recovered = readTextRecovery(store, scope);
  const [presentation, setPresentation] = useState(() => initialPresentation || createTextPresentation(record.id, index));
  const [mode, setMode] = useState(store ? initialView?.mode || 'write' : 'read'), [settings, setSettings] = useState(Boolean(store) && (initialView?.settings ?? true));
  const [controlsHost, setControlsHost] = useState(null), [reason, setReason] = useState(recovered?.failure.reason || null), [destination, setDestination] = useState('');
  const toolsTrigger = useRef(null);
  const scenes = useSceneNavigation();
  const [linkTarget, setLinkTarget] = useState('');
  const displays = store ? textDisplays(store.getDraft()) : [];
  useEffect(() => { onViewChange?.(record.id, { mode, settings }); }, [record.id, mode, settings, onViewChange]);
  useEffect(() => () => onViewChange?.(record.id, null), [record.id, onViewChange]);
  const [working, setWorking] = useState(recovered?.value || record), [error, setError] = useState(recovered?.failure.message || '');
  const latest = useRef(recovered?.expected || record), workingRef = useRef(working), failed = useRef(Boolean(recovered)), surface = useRef(null), editor = useRef(null), shortcut = useRef(null), live = useRef(true);
  workingRef.current = working;
  const scene = working.sceneLink ? scenes[working.sceneLink.displayId] : null;
  const sectionLink = working.sceneLink?.mode === 'sections';
  const sectionRead = sectionLink && mode === 'read';
  const paginated = !sectionLink && working.pagination === 'pages';
  const sceneTrack = useRef(null);
  useSceneProgress(sectionLink && mode === 'write' ? null : scene, sceneTrack, presentation.open);
  const gridId = scene?.gridId || working.sceneLink?.gridId;
  const article = sectionLink && mode === 'write' ? working.article : passageArticle(working, gridId, scene?.gridOrder);
  const unavailable = Boolean(working.sceneLink && !scene);
  const missingDisplay = Boolean(store && working.sceneLink && !displays.some(display => display.id === working.sceneLink.displayId));
  const swiping = Boolean(scene?.targetGridId) && (!sectionLink || sectionRead);
  const editBlocked = suspended || (!sectionLink && (unavailable || swiping));
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
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
  const changeArticle = value => {
    if (!editBlocked) change(editPassage(workingRef.current, gridId, value));
  };
  const setEditor = useCallback(value => { editor.current = value; }, []);
  const acceptImage = useCallback(asset => {
    if (!live.current || !editor.current || editBlocked || !presentation.open || mode !== 'write') return false;
    const id = asset.stableAssetId || asset.id;
    try {
      const resolved = createProfileDocumentV9AssetResolver([{ ...(asset.assetRecord || asset), id }], { compactContentReference: false })(id, asset.selectedMedia);
      if (resolved.media.type !== 'image') throw new Error('Choose a Library image.');
      return editor.current.chain().focus().insertContent({ type: 'artwork', attrs: { asset: resolved, alt: resolved.name || '', caption: '' } }).run();
    } catch (e) { setError(e.message); return false; }
  }, [editBlocked, presentation.open, mode, gridId]);
  useEffect(() => {
    if (!store || !registerTarget || suspended || !presentation.open || mode !== 'write') return;
    registerTarget(record.id, { get node() { return surface.current; }, label: 'Insert artwork into article', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  }, [record.id, store, registerTarget, suspended, presentation.open, mode, acceptImage]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const layout = useCallback(window => setPresentation(current => JSON.stringify(current.window) === JSON.stringify(window) ? current : { ...current, window }), []);
  const [committedFrame, setCommittedFrame] = useState(null);
  const applyGroupFrame = useCallback(frame => { setCommittedFrame(frame); layout(frame); }, [layout]);
  const resizeTarget = useMemo(() => {
    return { enabled: Boolean(store) && !editBlocked && !failed.current && working === record,
      reflow: true,
      expected: record, store, profileAddress, layoutKey: 'texts', commit: commitWorkbenchSelectionResize, prepare: prepareTextResize,
      applyFrame: applyGroupFrame, reportError: setError, minimumWidth: 180, minimumHeight: 100,
      maximumWidth: 7992, maximumHeight: 7992,
    };
  }, [store, profileAddress, editBlocked, working, record, applyGroupFrame]);
  const name = article.title || 'Untitled article';
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'text', record });
  const close = () => { if (failed.current) { setSettings(true); return; } setPresentation(p => ({ ...p, open: false })); queueMicrotask(() => shortcut.current?.focus()); };
  const closeTools = () => { setSettings(false); queueMicrotask(() => toolsTrigger.current?.focus()); };
  const moveInto = preview => {
    if (!preview?.target?.isCurrent()) throw new Error('Choose an open, unlocked Display.');
    if (!change(workingRef.current, { retry: true })) return;
    preview.target.attachText(latest.current, { ...preview, cellSize: preview.cellSize / view.scale });
  };
  const destinations = placementTargets?.current?.textTargets?.() || [];
  const unlink = () => {
    if (suspended || failed.current) return;
    const result = unlinkTextModuleResult(store, profileAddress, latest.current);
    if (!result.saved) { setReason(result.reason); setError(result.message); return; }
    latest.current = result.record; workingRef.current = result.record; setWorking(result.record);
    setReason(null); setError(''); setLinkTarget(''); setMode('write');
  };
  return <div className="text-workbench" data-workbench-module="text" data-text-id={record.id}
    style={{ '--text-z': active ? 49 : 46, '--text-shortcut-bottom': `${64 + index * 38}px` }} onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    {shortcutMenu.content}
    {!presentation.open && <button data-workbench-pan ref={shortcut} className="text-shortcut" onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown}
      onClick={() => setPresentation(p => ({ ...p, open: true }))}>{name}</button>}
    {presentation.open && <WorkbenchWindow label="Text" title={name} titleContent={<span />} chrome="bevel" resizableWidth viewId={record.id} snapToGrid={Boolean(store) && windowSnap}
      surfaceStyle={article.appearance?.edges ? { boxShadow: article.appearance.edges.shadow ? 'var(--workflow-window-chrome-shadow)' : 'none', borderRadius: article.appearance.edges.corners.map(v => `${v}px`).join(' ') } : undefined} placementModule={Boolean(store)} className="text-window text-window--read"
      width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top} onLayoutChange={layout}
      resizeTarget={resizeTarget} committedFrame={committedFrame}
      controls={<>{store && <><button type="button" className="system-workflow__round-control" aria-label={mode === 'write' ? 'Read' : 'Write'} title={mode === 'write' ? 'Read' : 'Write'}
          onClick={() => { setMode(current => current === 'write' ? 'read' : 'write'); }}>{mode === 'write' ? <Eye /> : <Pencil />}</button>
        <TextMoveHandle label="Drag Text into Display" disabled={suspended || Boolean(working.sceneLink)} previewAt={(point, rectangle) => placementTargets?.current?.previewTextAt?.(point, rectangle)}
          onDrop={preview => { if (preview) moveInto(preview); }} onKeyboardMove={() => setSettings(true)} onError={setError} />
        <button ref={toolsTrigger} type="button" className="system-workflow__round-control" aria-label="Text tools" title="Text tools" aria-expanded={settings} onClick={() => setSettings(s => !s)}><Settings /></button>
        {error && <button type="button" className="text-save-error" aria-label="Text not saved — open recovery" onClick={() => setSettings(true)}>!</button>}</>}
        <button type="button" className="system-workflow__round-control" aria-label={`Close ${name}`} onClick={close}><X /></button></>}>
      <div className="text-module-body" data-module-edges={Boolean(article.appearance?.edges) || undefined} ref={surface} style={{ ...textOutputStyle(article, view.frame || presentation.window), ...(article.appearance?.edges ? { boxShadow: 'none' } : {}) }}>
        {unavailable && <p className="text-status" role="status">{missingDisplay ? 'The linked Display was removed. Your text is preserved. Open Text tools to unlink it.' : sectionLink ? 'Open the linked Display to read its current section. You can still edit the full article in Write.' : 'Open the linked Display to read or edit its passage.'}</p>}
        <div className="text-scene-viewport" style={unavailable && (!sectionLink || sectionRead) ? { visibility: 'hidden' } : undefined} data-settling={swiping && scene?.settling || undefined}>
          <div className="text-scene-track" ref={sceneTrack}>
            <div className="text-scene-page">
              <div className="text-authoring-viewport" hidden={mode === 'read' && paginated}>
                <TextViewport resetKey={sectionRead ? gridId : null} automaticPadding={!article.appearance?.padding && !article.appearance?.compact} mode={mode}>
                  {store && <div hidden={mode !== 'write'}><Suspense fallback={<p role="status">Opening editor…</p>}><ArticleEditor key={sectionLink ? 'article' : gridId || 'article'} article={sectionLink ? working.article : article}
                    onChange={changeArticle} onEditor={setEditor} controlsHost={controlsHost} disabled={editBlocked || mode !== 'write'} /></Suspense></div>}
                  {mode === 'read' && !paginated && <ArticleView article={article} />}
                </TextViewport>
              </div>
              {mode === 'read' && paginated && <PagedArticle key={gridId || 'article'} article={article} />}
            </div>
            {swiping && <div className="text-scene-page text-scene-incoming" aria-hidden="true" inert="" style={{ left: scene.direction === 'next' ? '100%' : '-100%' }}>
              {sectionLink ? <TextViewport automaticPadding={!article.appearance?.padding && !article.appearance?.compact} mode="read">
                <ArticleView article={passageArticle(working, scene.targetGridId, scene.gridOrder)} />
              </TextViewport> : <PagedArticle key={scene.targetGridId} article={passageArticle(working, scene.targetGridId)} />}
            </div>}
          </div>
        </div>
        {article.appearance?.edges && <><span aria-hidden="true" className="module-surface-grain" /><span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: article.appearance.frame ? `inset 0 0 0 1px ${article.appearance.color}` : undefined }} /></>}
      </div>
    </WorkbenchWindow>}
    {store && presentation.open && settings && !suspended && <TextTools article={sectionLink ? working.article : article} onChange={changeArticle}
      controlsRef={setControlsHost} onClose={closeTools} disabled={editBlocked} initialX={presentation.window.left + presentation.window.width + 12} initialY={presentation.window.top}>
      {!working.sceneLink ? <><label>Follow Display<select aria-label="Follow Display" value={linkTarget} onChange={e => setLinkTarget(e.target.value)}>
        <option value="">Choose a Display…</option>{displays.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select></label><button type="button" disabled={!scenes[linkTarget]?.gridId || failed.current} onClick={() => {
        const target = scenes[linkTarget];
        if (target) {
          const next = { ...workingRef.current, sceneLink: { mode: 'sections', displayId: linkTarget } };
          delete next.pagination; change(next);
        }
      }}>Link Text to Display</button><p>Each page break starts the next Grid’s text. Longer sections scroll inside the window.</p></> : <p>Following {displays.find(d => d.id === working.sceneLink.displayId)?.name || 'Display'} · {displays.find(d => d.id === working.sceneLink.displayId)?.grids.find(g => g.id === gridId)?.title || 'Grid unavailable'}. {sectionLink ? 'Write edits the full article. In Read, each page break starts the next Grid’s section; longer sections scroll.' : 'Change Grid in the Display to edit its passage.'}</p>}
      {working.sceneLink && <>
        <button type="button" disabled={suspended || failed.current} onClick={unlink}>Unlink Text from Display</button>
        <p>{sectionLink || working.sceneLink.passages.length === 0 ? 'Keeps the full article as independent Text.' : 'Keeps the original article here and opens each additional passage as a private Text window, preserving its formatting.'}</p>
      </>}
      {working.sceneLink && !sectionLink && working.sceneLink.passages.length === 0 && <button type="button" disabled={failed.current} onClick={() => {
        const next = { ...workingRef.current, sceneLink: { mode: 'sections', displayId: working.sceneLink.displayId } };
        delete next.pagination; change(next);
      }}>Use article page breaks for Grids</button>}
      {!sectionLink && <label className="text-visibility"><input type="checkbox" checked={working.pagination === 'pages'} onChange={e => {
        const next = { ...workingRef.current }; if (e.target.checked) next.pagination = 'pages'; else delete next.pagination; change(next);
      }} />Read as pages</label>}
      <label className="text-visibility"><input type="checkbox" checked={working.visibility === 'PUBLIC'} onChange={e => change({ ...workingRef.current, visibility: e.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in Workbench publication</label>
      <label>Insert Library artwork<select aria-label="Insert Library artwork" value="" disabled={mode !== 'write' || editBlocked} onChange={e => acceptImage(assets.find(a => (a.id || a.stableAssetId) === e.target.value))}>
        <option value="">Choose an image…</option>{assets.filter(a => a.imageUrl || a.media?.type === 'image' || a.src).map(a => <option key={a.id || a.stableAssetId} value={a.id || a.stableAssetId}>{a.name || 'Artwork'}</option>)}</select></label>
      {!working.sceneLink && destinations.length > 0 && <><label>Move into Display<select aria-label="Text destination" value={destination} onChange={e => setDestination(e.target.value)}>
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
