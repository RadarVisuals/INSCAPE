import { useWorkspaceSaveLabel } from '../workspace/WorkspaceBoundary.jsx';
import { useWorkbenchMiniature } from '../public/ownerSystemWorkflow/workbenchMiniatures.js';
import { useWorkbenchArea } from '../public/ownerSystemWorkflow/WorkbenchAreaContext.jsx';
import { editPassage, textDisplays } from './scenePassages.js';
import { useTextScene, SceneTextViewport, TextContentPage } from './SceneTextContent.jsx';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings2 as Settings, Eye, Pencil, Plus, GripVertical } from 'lucide-react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { useWorkbenchHostView, workbenchModuleTransform, useArtworkOpener, useClosedArtworkLayout, useWorkbenchToolSource } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useEditorCellLayout } from '../reception/EditorCellsContext.jsx';
import { CellPositionButton } from '../reception/EditorCellPositionControls.jsx';
import { transformedCellWindow } from '../reception/editorCellGeometry.js';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';
import { createTextPresentation, TEXT_WINDOW_LIMITS, CELL_TEXT_WINDOW_LIMITS } from '../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { textAppearance, textOutputStyle, textWindowStyle, MAX_TEXT_MODULES } from './domain/article.js';
import { saveTextModuleResult, unlinkTextModuleResult, prepareTextResize, changeTextFrames, duplicateTextModule } from './textSession.js';
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

const TextInstance = memo(function TextInstance({ record, index, store, profileAddress, registerTarget, initialPresentation, onPresentationChange, suspended, active, activateModule, toolsOpen, setToolsOpen, displays, savedLayout, windowSnap, initialView, onViewChange, initiallyOpenId, canDuplicate }) {
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
  const [editingMode, setMode] = useState(store ? initialView?.mode || 'write' : 'read');
  const mode = view.presented || (cell && !editingCell) ? 'read' : editingCell && store ? 'write' : editingMode;
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
  useEffect(() => { onViewChange?.(record.id, { mode: editingMode }); }, [record.id, editingMode, onViewChange]);
  useEffect(() => () => onViewChange?.(record.id, null), [record.id, onViewChange]);
  const surface = useRef(null), editor = useRef(null), shortcut = useRef(null);
  const [colourEditor, setColourEditor] = useState(null), [colourTarget, setColourTarget] = useState('default');
  const [colourPreview, setColourPreview] = useState(null);
  const sceneState = useTextScene(working, mode);
  const { sectionLink, sectionRead, paginated, gridId, article: savedArticle, unavailable, swiping } = sceneState;
  const article = colourPreview?.source === working && colourPreview.gridId === gridId ? colourPreview.article : savedArticle;
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
  const missingDisplay = Boolean(store && working.sceneLink && !displays.some(display => display.id === working.sceneLink.displayId));
  const editBlocked = view.presented || suspended || (!sectionLink && (unavailable || swiping));
  const changeArticle = value => {
    if (!editBlocked) change(editPassage(edit.getSnapshot().value, gridId, value));
  };
  const setEditor = useCallback(value => {
    editor.current = value; setColourEditor(value);
    if (cellId && active && !article.title && value?.isEmpty && value.isEditable) value.commands.focus();
  }, [cellId, active, article.title]);
  useEffect(() => {
    if (!colourEditor || colourEditor.isDestroyed) return;
    const selectBody = () => setColourTarget('body');
    colourEditor.on('focus', selectBody); colourEditor.on('selectionUpdate', selectBody);
    return () => { colourEditor.off('focus', selectBody); colourEditor.off('selectionUpdate', selectBody); };
  }, [colourEditor]);
  useEffect(() => { setColourTarget('default'); setColourPreview(null); }, [gridId]);
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
  }, [record.id, store, registerTarget, suspended, presentation.open, mode, acceptImage, gridId]);
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
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'text', record });
  const close = () => { if (failed) { setSettings(true); return; } setPresentation(p => ({ ...p, open: false })); queueMicrotask(() => shortcut.current?.focus()); };
  const closeTools = () => { setSettings(false); queueMicrotask(() => toolsTrigger.current?.focus()); };
  const unlink = () => {
    if (suspended || failed) return;
    const result = unlinkTextModuleResult(store, profileAddress, edit.getSnapshot().record);
    if (!result.saved) { setError(result.message, result.reason); return; }
    edit.accept(result.record); setMode('write');
  };
  const colorTools = (target, compact = false) => <Suspense fallback={<p>Opening Color…</p>}>
    <TextColourTools key={gridId || 'article'} article={sectionLink ? working.article : savedArticle} editor={colourEditor} target={target} compact={compact} onTarget={setColourTarget}
      store={store} scopeKey={`${profileAddress}:${record.id}:${gridId || 'article'}`} disabled={editBlocked || failed || !presentation.open} error={error} onRecovery={() => setSettings(true)} onChange={changeArticle}
      onPreview={value => setColourPreview(value ? { source: working, gridId, article: value } : null)} />
  </Suspense>;
  const textControls = (hostTools = {}) => <TextToolsContent {...hostTools} sharedColour={sharedColour} titleInput={reception} defaultOverflow={reception ? 'clip' : 'scroll'} frameLayout={reception} targetId={record.id} available={presentation.open && !suspended} article={sectionLink ? working.article : article} onChange={changeArticle}
      onBackToCell={cell ? () => cells.leaveCell(true) : undefined}
      onEditText={mode === 'read' ? () => {
        if (editBlocked || failed || !presentation.open) return;
        if (cell && !editingCell) cells.enterCell(cell.id);
        setMode('write'); setSettings(true);
      } : undefined}
      backupScope={JSON.stringify([profileAddress, record.id, sectionLink ? null : gridId])} recoveryPending={failed}
      controlsRef={setControlsHost} disabled={editBlocked || !presentation.open}
      footer={error ? <div className="text-status" role="alert">{error}
        {failed && <button type="button" onClick={() => change(edit.getSnapshot().value, { retry: true })}>Retry local save</button>}
        {reason === 'conflict' && <button type="button" onClick={() => change(edit.getSnapshot().value, { retry: true, replace: true })}>Replace saved Text with my edits</button>}
      </div> : <p className="text-save-summary" role="status">{saveLabel}</p>}
      connection={!reception && working.sceneLink && <button type="button" disabled={suspended || failed} onClick={unlink}>Unlink Text from Display</button>}
      readOptions={!reception && !linked && !sectionLink && <label className="text-visibility text-settings-wide"><input type="checkbox" checked={working.pagination === 'pages'} onChange={e => {
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
  const module = <div className="text-workbench" hidden={suspended} data-workbench-module="text" data-text-id={record.id} data-text-tools-open={settings || undefined}
    style={{ '--text-z': active ? 49 : 46, '--text-shortcut-bottom': `${64 + index * 38}px` }} onPointerDownCapture={onActivate} onFocusCapture={event => { onActivate(); if (event.target.matches('.text-document-title')) setColourTarget('title'); }}>
    {shortcutMenu.content}
    {store && active && linked && presentation.open && workbenchView.subscribe && <TextFrameLinks ids={[record.id, ...presentation.frames.map(frame => frame.id)]} />}
    {!presentation.open && <button ref={shortcut} className="text-shortcut" onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown}
      onClick={() => setPresentation(p => ({ ...p, open: true }))}>{name}</button>}
    {presentation.open && <WorkbenchWindow label="Text" title={name} titleContent={<span className="editor-object-toolbar-label" title="Drag to move this text box"><GripVertical aria-hidden="true" />Text{linked ? ` · 1/${flow.ranges.length}` : ''}</span>} chrome="bevel" objectToolbar externalControls minimumWidth={limits.minimumWidth} minimumHeight={limits.minimumHeight} resizableWidth viewId={record.id} active={active} snapToGrid={Boolean(store) && windowSnap}
      externalControlsHost={editingCell && active && !suspended && !view.presented ? canvasHost?.parentElement : null} externalControlsClassName="text-workbench"
      surfaceStyle={textWindowStyle(article, paintScale)} placementModule={Boolean(store)} className="text-window text-window--read"
      background={<><span aria-hidden="true" className="text-window-bounds" />{appearance.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
        {appearance.frame && <span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: `inset 0 0 0 ${paintScale}px ${article.appearance ? appearance.color : 'var(--workflow-border)'}` }} />}</>}
      width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top} onLayoutChange={layout}
      resizeTarget={resizeTarget} committedFrame={committedFrame} surfacePreviewFrame={fontPreviewFrame}
      moveFromContent={mode === 'read' && !suspended}
      controls={<>{store && !view.presented && <>{cell ? (editingCell && active && !suspended && <>
        <span className="bento-text-toolbar" data-workbench-selection-tools ref={setQuickToolsHost} />
        <CellPositionButton cellId={cell.id} memberIds={[record.id]} disabled={editBlocked || failed} />
      </>) : <><button type="button" className="editor-object-toolbar-button" aria-label={mode === 'write' ? 'Read' : 'Write'} title={mode === 'write' ? 'Read' : 'Write'}
          onClick={() => { const next = mode === 'write' ? 'read' : 'write'; setMode(next); setSettings(next === 'write' || failed); }}>{mode === 'write' ? <Eye /> : <Pencil />}</button>
        <button ref={toolsTrigger} type="button" className="editor-object-toolbar-button" aria-label="Text tools" title="Text tools" aria-expanded={settings} onClick={() => { setMode('write'); setSettings(true); }}><Settings /></button>
        {!reception && <button className="editor-object-toolbar-button" type="button" aria-label="Add linked Text frame" title={working.sceneLink || working.pagination ? 'Unlink Follow Display and turn off Read as pages first' : 'Add linked frame'}
          disabled={editBlocked || failed || Boolean(working.sceneLink || working.pagination) || flow.ranges.length >= 8} onClick={() => addFrame(record.id)}><Plus /></button>}</>}
        {error && <button type="button" className="text-save-error" aria-label="Text not saved — open recovery" onClick={() => setSettings(true)}>!</button>}</>}
        <button type="button" className="editor-object-toolbar-button" aria-label={`Close ${name}`} onClick={close}><X /></button></>}>
      <div className="text-module-body" ref={surface} data-text-single-line={cell?.singleLine || undefined} style={textOutputStyle(article, fontPreviewFrame || view.frame || presentation.window)}>
        {unavailable && <p className="text-status" role="status">{missingDisplay ? 'The linked Display was removed. Your text is preserved. Open Text tools to unlink it.' : sectionLink ? 'Open the linked Display to read its current section. You can still edit the full article in Write.' : 'Open the linked Display to read or edit its passage.'}</p>}
        <SceneTextViewport record={working} state={sceneState} open={presentation.open} mode={mode}>
          <TextContentPage article={article} paginated={paginated} mode={mode} flow={linked ? flow : null}
            defaultOverflow={reception ? 'clip' : 'scroll'} excerpt={excerpt} resetKey={sectionRead || paginated ? gridId : null}>
                  {store && <div hidden={mode !== 'write'}><Suspense fallback={<p role="status">Opening editor…</p>}><ArticleEditor saveStatus={saveLabel} sharedColour={sharedColour} titlePlaceholder={!reception} key={sectionLink ? 'article' : gridId || 'article'} article={sectionLink && colourPreview?.source !== working ? working.article : article}
                    quickToolsHost={editingCell && active && !failed && !view.presented ? quickToolsHost : null} quickColor={target => colorTools(target, true)}
                    onFitFontPreview={editingCell?.fitText?.includes(record.id) && store?.previewFittedTextFrame ? fitFontPreview : undefined}
                    onChange={changeArticle} onEditor={setEditor} onFlowEditor={setFlowEditor} flowRange={linked ? flow.ranges[0] : null} controlsHost={controlsHost} disabled={editBlocked || mode !== 'write'} saveError={error}
                    onFindRequest={() => { if (!editBlocked && mode === 'write') setSettings(true); }} /></Suspense></div>}
          </TextContentPage>
        </SceneTextViewport>
      </div>
    </WorkbenchWindow>}
    {presentation.open && presentation.frames?.map((frame, index) => <LinkedTextWindow key={frame.id} {...{ frame, article, flow, active, store, resizeTarget, windowSnap, mode, flowEditor }} registerTarget={!editBlocked ? registerTarget : null} acceptImage={acceptImage}
      index={index + 1} ownerId={record.id} onLayout={frameLayout} onAdd={addFrame} onRemove={id => { if (changeFrames(presentation.frames.filter(frame => frame.id !== id))) queueMicrotask(() => toolsTrigger.current?.focus()); }}
      onEdit={() => { setMode('write'); setSettings(true); }} onTools={() => { setMode('write'); setSettings(true); }} />)}
    {store && !sharedColour && <SharedTextToolsContent targetId={record.id} available={presentation.open && !suspended} label={name} onClose={closeTools}>
      {textControls()}
    </SharedTextToolsContent>}
  </div>;
  // A closed module is viewport navigation, outside the authored canvas clip
  // and camera transform. Its state, focus and context menu stay with Text.
  return !presentation.open && canvasHost?.parentElement ? createPortal(module, canvasHost.parentElement) : module;
});
export default function TextWorkbench(props) {
  const tools = useSharedTextTools();
  // Isolated Workbench mounts use the same host; the production owner supplies
  // it above both standalone Text and Display-owned articles.
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
function TextInstances({ records, presentations, store, profileAddress, registerTarget, onPresentationChange, suspended = false, windowSnap = false, views, onViewChange, initiallyOpenId }) {
  const tools = useSharedTextTools();
  const [active, setActive] = useState(null);
  const draft = store?.getSnapshot();
  // Other articles changing must not render every editor. Explicitly retain the
  // cross-module inputs: Display choices and saved geometry (including undo).
  const grids = draft?.grids, displayRecords = draft?.displays, workbench = draft?.workbench;
  const displays = useMemo(() => textDisplays({ grids, displays: displayRecords, workbench }), [grids, displayRecords, workbench]);
  const activeId = tools ? tools.activeModuleId : active;
  // Targets can become unavailable without changing a saved article (locking,
  // opening or closing a Display). Refresh the active transfer menu from live
  // host refs on every host render without waking unrelated editors.
  return records.map((record, index) => <TextInstance key={`${profileAddress}:${record.id}`} {...{ record, index, store, profileAddress, registerTarget, onPresentationChange, suspended, windowSnap }}
    canDuplicate={records.length < MAX_TEXT_MODULES} displays={displays} savedLayout={draft?.workbench} activateModule={tools ? tools.activate : setActive} toolsOpen={tools?.open} setToolsOpen={tools?.setOpen}
    initiallyOpenId={initiallyOpenId} initialView={views?.[record.id]} onViewChange={onViewChange} initialPresentation={presentations?.find(p => p.id === record.id)} active={activeId === record.id} />);
}
