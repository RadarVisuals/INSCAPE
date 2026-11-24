import { useWorkspaceSaveLabel } from '../workspace/WorkspaceBoundary.jsx';
import { useWorkbenchMiniature } from '../public/ownerSystemWorkflow/workbenchMiniatures.js';
import { useWorkbenchArea } from '../public/ownerSystemWorkflow/WorkbenchAreaContext.jsx';
import { TextContentPage } from './TextContentPage.jsx';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ellipsis, Plus, GripVertical } from 'lucide-react';
import TextPaddingHandles from './TextPaddingHandles.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { useWorkbenchHostView, workbenchModuleTransform, useArtworkOpener, useClosedArtworkLayout, useWorkbenchToolSource } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useEditorCellLayout } from '../reception/EditorCellsContext.jsx';
import { CellPositionButton } from '../reception/EditorCellPositionControls.jsx';
import { transformedCellWindow } from '../reception/editorCellGeometry.js';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';
import { createTextPresentation, TEXT_WINDOW_LIMITS, CELL_TEXT_WINDOW_LIMITS } from '../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { textAppearance, textOutputStyle, textWindowStyle, MAX_TEXT_MODULES } from './domain/article.js';
import { saveTextModuleResult, prepareTextResize, changeTextFrames, duplicateTextModule } from './textSession.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { TextToolsContent } from './TextTools.jsx';
import { SharedTextToolsProvider, SharedTextToolsContent, SharedTextToolsInspectorContent, useSharedTextTools } from './SharedTextTools.jsx';
import { restoreTextToolsView } from './sharedTextToolsState.js';
import LinkedTextWindow, { TextFrameLinks } from './LinkedTextFrames.jsx';
import { useArticleFlow } from './TextFrame.jsx';
import { textRecoveryScope } from './textEditRecovery.js';
import useTextEditSession from './useTextEditSession.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './text.css';
const TextColourTools = lazy(() => import('./TextColourTools.jsx'));
const ArticleEditor = lazy(() => import('./ArticleEditor.jsx'));
const textValue = record => record;
const saveText = (store, scope, expected, next, options) => saveTextModuleResult(store, scope.profile, expected, next, options);

const TextInstance = memo(function TextInstance({ record, index, store, profileAddress, registerTarget, initialPresentation, onPresentationChange, suspended, active, activateModule, toolsOpen, setToolsOpen, savedLayout, windowSnap, onViewChange, initiallyOpenId, canDuplicate }) {
  const onActivate = useCallback(() => activateModule(record.id), [activateModule, record.id]);
  const { bounds: areaBounds, canvasHost } = useWorkbenchArea();
  const workbenchView = useWorkbenchHostView();
  const cells = useEditorCellLayout();
  const cell = cells?.cells.find(cell => cell.members.includes(record.id));
  const limits = cell ? CELL_TEXT_WINDOW_LIMITS : TEXT_WINDOW_LIMITS;
  const editingCell = cell?.id === cells?.editingCellId ? cell : null;
  const reception = Boolean(store?.getCells);
  const view = workbenchModuleTransform(workbenchView, record.id);
  const scope = textRecoveryScope(profileAddress, record.id);
  const saveLabel = useWorkspaceSaveLabel(scope.profile, 'Saved in this browser');
  const { value: working, failed, error, reason, session: edit } = useTextEditSession({ store, scope, record, valueOf: textValue, saveRecord: saveText });
  const { save: change, setError } = edit;
  const [presentation, setPresentation] = useState(() => ({ ...(initialPresentation || createTextPresentation(record.id, index)), ...(initiallyOpenId === record.id ? { open: true } : {}) }));
  useArtworkOpener(record.id, () => setPresentation(current => ({ ...current, open: true })));
  useClosedArtworkLayout(presentation, setPresentation, savedLayout?.texts?.find(item => item.id === record.id));
  const linked = Boolean(presentation.frames?.length);
  const [flowEditor, setFlowEditor] = useState(null);
  const savedFrames = savedLayout?.texts?.find(item => item.id === record.id)?.frames;
  const savedFramesKey = JSON.stringify(savedFrames || []), previousFramesKey = useRef(savedFramesKey);
  useEffect(() => {
    if (previousFramesKey.current === savedFramesKey) return;
    previousFramesKey.current = savedFramesKey;
    setPresentation(current => { const next = { ...current }; if (savedFrames?.length) next.frames = savedFrames; else delete next.frames; return next; });
  }, [savedFramesKey, savedFrames]);
  const mode = store && !view.presented && (!cell || editingCell) ? 'write' : 'read';
  const [paddingPreview, setPaddingPreview] = useState(null);
  const settings = Boolean(store && toolsOpen && active);
  const setSettings = open => { onActivate(); setToolsOpen?.(open); };
  const [controlsHost, setControlsHost] = useState(null);
  const [quickToolsHost, setQuickToolsHost] = useState(null);
  const [fontPreviewFrame, setFontPreviewFrame] = useState(null);
  const cellId = editingCell?.id;
  const fitFontPreview = useCallback(article => {
    setFontPreviewFrame(article ? store.previewFittedTextFrame(cellId, record.id, article) : null);
  }, [store, cellId, record.id]);
  const toolsTrigger = useRef(null);
  useEffect(() => { onViewChange?.(record.id, { mode }); }, [record.id, mode, onViewChange]);
  useEffect(() => () => onViewChange?.(record.id, null), [record.id, onViewChange]);
  const surface = useRef(null), editor = useRef(null);
  const [colourEditor, setColourEditor] = useState(null), [colourTarget, setColourTarget] = useState('default');
  const [colourPreview, setColourPreview] = useState(null);
  const paginated = working.pagination === 'pages';
  const baseArticle = colourPreview?.source === working ? colourPreview.article : working.article;
  const article = active && paddingPreview?.source === baseArticle
    ? { ...baseArticle, appearance: { ...textAppearance(baseArticle), padding: paddingPreview.padding } } : baseArticle;
  const appearance = textAppearance(article);
  const flow = useArticleFlow(article, [record.id, ...(presentation.frames || []).map(frame => frame.id)]);
  const { id: miniatureFrame, from: miniatureFrom, to: miniatureTo } = flow.ranges.length > 1 ? flow.ranges[0] : {};
  useWorkbenchMiniature(record.id, useMemo(() => ({ kind: 'text', article,
    range: miniatureFrame ? { id: miniatureFrame, from: miniatureFrom, to: miniatureTo } : null, index: 0 }),
  [article, miniatureFrame, miniatureFrom, miniatureTo]));
  const paintScale = view.scale * (globalThis.devicePixelRatio || 1);
  const parentFrame = cell && transformedCellWindow(savedLayout?.shapes?.find(item => item.id === cell.id)?.window, workbenchView.transforms[cell.id]);
  const textFrame = transformedCellWindow(presentation.window, workbenchView.transforms[record.id]);
  const transform = article.appearance?.transform;
  const excerpt = cell && !transform?.quarterTurns && !transform?.mirrorX && !transform?.mirrorY ? {
    singleLine: cell.singleLine,
    clipBounds: parentFrame && cell.clipContent !== false ? { left: parentFrame.left - textFrame.left, top: parentFrame.top - textFrame.top,
      right: parentFrame.left + parentFrame.width - textFrame.left, bottom: parentFrame.top + parentFrame.height - textFrame.top } : undefined,
  } : undefined;
  const editBlocked = view.presented || suspended;
  const changeArticle = value => {
    if (!editBlocked) change({ ...edit.getSnapshot().value, article: value });
  };
  const setEditor = useCallback(value => {
    editor.current = value; setColourEditor(value);
    if (active && (!cell || cellId) && !article.title && value?.isEmpty && value.isEditable) value.commands.focus();
  }, [cellId, cell?.id, active, article.title]);
  useEffect(() => {
    if (!colourEditor || colourEditor.isDestroyed) return;
    const selectBody = () => setColourTarget('body');
    colourEditor.on('focus', selectBody); colourEditor.on('selectionUpdate', selectBody);
    return () => { colourEditor.off('focus', selectBody); colourEditor.off('selectionUpdate', selectBody); };
  }, [colourEditor]);
  const sharedColour = Boolean(workbenchView.store && workbenchView.toolSources);
  const acceptImage = useCallback((asset, point) => {
    if (!edit.isCurrent() || !editor.current || editBlocked || !presentation.open || mode !== 'write') return false;
    const id = asset.stableAssetId || asset.id;
    try {
      const resolved = createProfileDocumentV9AssetResolver([{ ...(asset.assetRecord || asset), id }], { compactContentReference: false })(id, asset.selectedMedia);
      if (resolved.media.type !== 'image') throw new Error('Choose a Library image.');
      return editor.current.chain().insertArticleArtwork({ asset: resolved, alt: resolved.name || '', caption: '' }, point, flowEditor?.bridge.viewAt(point)).focus().run();
    } catch (e) { setError(e.message); return false; }
  }, [edit, editBlocked, presentation.open, mode, flowEditor, setError]);
  useEffect(() => {
    if (!store || !registerTarget || suspended || !presentation.open || mode !== 'write') return;
    registerTarget(record.id, { get node() { return surface.current; }, label: 'Insert artwork into article', placeAsset: acceptImage });
    return () => registerTarget(record.id, null);
  // A passage change retires the Library receiver even when the editor stays mounted.
  }, [record.id, store, registerTarget, suspended, presentation.open, mode, acceptImage]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const layout = useCallback(window => setPresentation(current => JSON.stringify(current.window) === JSON.stringify(window) ? current : { ...current, window }), []);
  const frameLayout = useCallback((id, window) => setPresentation(current => {
    if (JSON.stringify(current.frames?.find(frame => frame.id === id)?.window) === JSON.stringify(window)) return current;
    return { ...current, frames: current.frames?.map(frame => frame.id === id ? { ...frame, window } : frame) };
  }), []);
  const [committedFrame, setCommittedFrame] = useState(null);
  const applyGroupFrame = useCallback(frame => { setCommittedFrame(frame); layout(frame); }, [layout]);
  const resizeTarget = useMemo(() => {
    // Geometry commits clone the draft without changing this article. Keep the
    // resize handle mounted (and focused) across those equivalent snapshots.
    return { enabled: Boolean(store) && !editBlocked && !failed && (working === record || JSON.stringify(working) === JSON.stringify(record)),
      reflow: true, continuousGeometry: true,
      expected: record, store, profileAddress, layoutKey: 'texts', commit: commitWorkbenchSelectionResize, prepare: prepareTextResize,
      applyFrame: applyGroupFrame, reportError: setError, minimumWidth: limits.minimumWidth, minimumHeight: limits.minimumHeight,
      maximumWidth: 7992, maximumHeight: 7992,
    };
  }, [store, profileAddress, editBlocked, failed, working, record, applyGroupFrame, setError, limits]);
  const name = article.title || 'Untitled article';
  const changeFrames = frames => {
    if (reception || editBlocked || failed) return;
    try { setPresentation(changeTextFrames(store, profileAddress, edit.getSnapshot().record, presentation, frames, workbenchView.getPresentation?.())); setError(''); return true; }
    catch (error) { setError(error.message); return false; }
  };
  const addFrame = after => {
    const frames = presentation.frames || [], index = frames.findIndex(frame => frame.id === after);
    if (frames.length >= 7) return;
    const previous = index < 0 ? presentation.window : frames[index].window;
    const window = { ...previous, ...clampWorkbenchPosition({ left: previous.left + previous.width + 24, top: previous.top }, previous, areaBounds) };
    const next = [...frames]; next.splice(index + 1, 0, { id: `text-frame:${crypto.randomUUID()}`, window });
    changeFrames(next);
  };
  const closeTools = () => { setSettings(false); queueMicrotask(() => toolsTrigger.current?.focus()); };
  const colorTools = (target, compact = false) => <Suspense fallback={<p>Opening Color…</p>}>
    <TextColourTools article={working.article} editor={colourEditor} target={target} compact={compact} onTarget={setColourTarget}
      store={store} scopeKey={`${profileAddress}:${record.id}`} disabled={editBlocked || failed || !presentation.open} error={error} onRecovery={() => setSettings(true)} onChange={changeArticle}
      onPreview={value => setColourPreview(value ? { source: working, article: value } : null)} />
  </Suspense>;
  const textControls = (hostTools = {}) => <TextToolsContent {...hostTools} sharedColour={sharedColour} titleInput={reception} defaultOverflow={reception ? 'clip' : 'scroll'} frameLayout={reception} targetId={record.id} available={presentation.open && !suspended} article={article} onChange={changeArticle}
      onBackToCell={cell ? () => cells.leaveCell(true) : undefined}
      onEditText={cell && !editingCell && !view.presented ? () => {
        if (editBlocked || failed || !presentation.open) return;
        if (cell && !editingCell) cells.enterCell(cell.id);
        setSettings(true);
      } : undefined}
      backupScope={JSON.stringify([profileAddress, record.id, null])} recoveryPending={failed}
      controlsRef={setControlsHost} disabled={editBlocked || !presentation.open}
      footer={error ? <div className="text-status" role="alert">{error}
        {failed && <button type="button" onClick={() => change(edit.getSnapshot().value, { retry: true })}>Retry local save</button>}
        {reason === 'conflict' && <button type="button" onClick={() => change(edit.getSnapshot().value, { retry: true, replace: true })}>Replace saved Text with my edits</button>}
      </div> : <p className="text-save-summary" role="status">{saveLabel}</p>}
      readOptions={!reception && !linked && <label className="text-visibility text-settings-wide"><input type="checkbox" checked={working.pagination === 'pages'} onChange={e => {
        const next = { ...edit.getSnapshot().value }; if (e.target.checked) next.pagination = 'pages'; else delete next.pagination; change(next);
      }} />Read as pages</label>}
      publication={<label className="text-visibility"><input type="checkbox" checked={working.visibility === 'PUBLIC'} onChange={e => change({ ...edit.getSnapshot().value, visibility: e.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>}>

    </TextToolsContent>;
  useWorkbenchToolSource(record.id, { actions: { disabled: !store || editBlocked || failed,
    duplicate: { disabled: !canDuplicate,
      reason: !canDuplicate ? 'At most sixteen Text modules are supported.' : undefined,
      run: () => { const id = duplicateTextModule(store, profileAddress, edit.getSnapshot().value, workbenchView.getPresentation()); workbenchView.setSelection([id]); } } },
    text: hostTools => textControls(hostTools),
    color: colorTools(colourTarget) });
  return <div className="text-workbench" hidden={suspended} data-workbench-module="text" data-text-id={record.id} data-text-tools-open={settings || undefined}
    style={{ '--text-z': active ? 49 : 46 }} onPointerDownCapture={onActivate} onFocusCapture={event => { onActivate(); if (event.target.matches('.text-document-title')) setColourTarget('title'); }}>
    {store && active && linked && presentation.open && workbenchView.subscribe && <TextFrameLinks ids={[record.id, ...presentation.frames.map(frame => frame.id)]} />}
    {presentation.open && <WorkbenchWindow label="Text" title={name} titleContent={<span className="editor-object-toolbar-label" title="Drag to move this text box"><GripVertical aria-hidden="true" />{(cell || linked) && 'Text'}{linked ? ` · 1/${flow.ranges.length}` : ''}</span>} chrome="bevel" objectToolbar externalControls controlsGap={cell ? 28 : 8} minimumWidth={limits.minimumWidth} minimumHeight={limits.minimumHeight} resizableWidth viewId={record.id} active={active} snapToGrid={Boolean(store) && windowSnap}
      frameControls={store && !cell && active && !editBlocked && !failed && <TextPaddingHandles article={baseArticle}
        frame={textFrame} preview={article.appearance?.padding} onPreview={setPaddingPreview}
        onCommit={padding => changeArticle({ ...baseArticle, appearance: { ...textAppearance(baseArticle), padding } })} />}
      externalControlsHost={(!cell || editingCell) && active && !suspended && !view.presented ? canvasHost?.parentElement : null} externalControlsClassName="text-workbench"
      surfaceStyle={textWindowStyle(article, paintScale)} placementModule={Boolean(store)} className="text-window text-window--read"
      background={<><span aria-hidden="true" className="text-window-bounds" />{appearance.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
        {appearance.frame && <span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: `inset 0 0 0 ${paintScale}px ${article.appearance ? appearance.color : 'var(--workflow-border)'}` }} />}</>}
      width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top} onLayoutChange={layout}
      resizeTarget={resizeTarget} committedFrame={committedFrame} surfacePreviewFrame={fontPreviewFrame}
      moveFromContent={mode === 'read' && !suspended}
      controls={store && !view.presented && <>{(!cell || editingCell) && active && !suspended && mode === 'write' &&
        <span className="bento-text-toolbar" data-workbench-selection-tools ref={setQuickToolsHost} />}
        {editingCell && active && !suspended && <CellPositionButton cellId={cell.id} memberIds={[record.id]} disabled={editBlocked || failed} />}
        {!cell && <><button ref={toolsTrigger} type="button" className="editor-object-toolbar-button" aria-label="Open text inspector"
          title="Open text inspector" onClick={() => setSettings(true)}><Ellipsis /></button>
        {!reception && <button className="editor-object-toolbar-button" type="button" aria-label="Add linked Text frame" title={working.pagination ? 'Turn off Read as pages first' : 'Add linked frame'}
          disabled={editBlocked || failed || Boolean(working.pagination) || flow.ranges.length >= 8} onClick={() => addFrame(record.id)}><Plus /></button>}</>}
        {error && <button type="button" className="text-save-error" aria-label="Text not saved — open recovery" onClick={() => setSettings(true)}>!</button>}</>}>
      <div className="text-module-body" ref={surface} onClick={event => {
        if (cell || mode !== 'write' || editBlocked || event.target.closest('[contenteditable],textarea,input,button,a')) return;
        if (event.target.closest('.text-module-scroll') && window.getSelection()?.isCollapsed) editor.current?.commands.focus('end');
      }} data-text-single-line={cell?.singleLine || undefined} style={textOutputStyle(article, fontPreviewFrame || view.frame || presentation.window)}>
          <TextContentPage article={article} paginated={paginated} mode={mode} flow={linked ? flow : null}
            defaultOverflow={reception ? 'clip' : 'scroll'} excerpt={excerpt}>
                  {store && <div hidden={mode !== 'write'}><Suspense fallback={<p role="status">Opening editor…</p>}><ArticleEditor saveStatus={saveLabel} sharedColour={sharedColour} titlePlaceholder={!reception} article={article}
                    quickToolsHost={!failed && !view.presented ? quickToolsHost : null} quickColor={target => colorTools(target, true)}
                    onFitFontPreview={editingCell?.fitText?.includes(record.id) && store?.previewFittedTextFrame ? fitFontPreview : undefined}
                    onChange={changeArticle} onEditor={setEditor} onFlowEditor={setFlowEditor} flowRange={linked ? flow.ranges[0] : null} controlsHost={controlsHost} disabled={editBlocked || mode !== 'write'} saveError={error}
                    onFindRequest={() => { if (!editBlocked && mode === 'write') setSettings(true); }} /></Suspense></div>}
          </TextContentPage>
      </div>
    </WorkbenchWindow>}
    {presentation.open && presentation.frames?.map((frame, index) => <LinkedTextWindow key={frame.id} {...{ frame, article, flow, active, store, resizeTarget, windowSnap, mode, flowEditor }} registerTarget={!editBlocked ? registerTarget : null} acceptImage={acceptImage}
      index={index + 1} ownerId={record.id} onLayout={frameLayout} onAdd={addFrame} onRemove={id => { if (changeFrames(presentation.frames.filter(frame => frame.id !== id))) queueMicrotask(() => toolsTrigger.current?.focus()); }}
      onTools={() => { setSettings(true); }} />)}
    {store && !sharedColour && <SharedTextToolsContent targetId={record.id} available={presentation.open && !suspended} label={name} onClose={closeTools}>
      {textControls()}
    </SharedTextToolsContent>}
  </div>;
});
export default function TextWorkbench(props) {
  const tools = useSharedTextTools();
  if (props.store && !tools) return <IsolatedTextWorkbench {...props} />;
  return <TextInstances {...props} />;
}
function IsolatedTextWorkbench(props) {
  const [initial] = useState(() => restoreTextToolsView(props.views, props.records, props.presentations));
  const [active, setActive] = useState(initial.targetId || props.records[0]?.id), [open, setOpen] = useState(initial.open);
  return <SharedTextToolsProvider activeModuleId={active} onActivate={setActive} open={open} onOpenChange={setOpen}>
    {!props.suspended && <aside className="text-isolated-inspector" aria-label="Text inspector"><SharedTextToolsInspectorContent targetId={active} /></aside>}
    <TextInstances {...props} />
  </SharedTextToolsProvider>;
}
function TextInstances({ records, presentations, store, profileAddress, registerTarget, onPresentationChange, suspended = false, windowSnap = false, onViewChange, initiallyOpenId }) {
  const tools = useSharedTextTools();
  const [active, setActive] = useState(null);
  const draft = store?.getSnapshot();
  const activeId = tools ? tools.activeModuleId : active;
  return records.map((record, index) => <TextInstance key={`${profileAddress}:${record.id}`} {...{ record, index, store, profileAddress, registerTarget, onPresentationChange, suspended, windowSnap }}
    canDuplicate={records.length < MAX_TEXT_MODULES} savedLayout={draft?.workbench} activateModule={tools ? tools.activate : setActive} toolsOpen={tools?.open} setToolsOpen={tools?.setOpen}
    initiallyOpenId={initiallyOpenId} onViewChange={onViewChange} initialPresentation={presentations?.find(p => p.id === record.id)} active={activeId === record.id} />);
}
