import { lazy, Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { WorkspaceBrand } from '../menus/WorkspaceHeader.jsx';
import CompositionStartLayout from '../../ui/CompositionStartLayout.jsx';
import { ArrowLeft } from 'lucide-react';
import EditorHeaderActions from './EditorHeaderActions.jsx';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import { EditorCellEditingNotice, useEditorCells } from '../../reception/EditorCellsContext.jsx';
import { toolIsVisible } from './workbenchToolDockState.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './editorMenuBar.css';


const CanvasControls = lazy(() => import('./WorkbenchCanvasControls.jsx'));

// The bar owns its screen boundary and name form. The document session saves
// composition changes and guards every transition.
export default function OwnerEditorMenuBar({ busy, hidden, documentNavigation, initialNew, onNewOpened, onManageCompositions,
  navigationRef, hostRef, navigation, focusOnMount, onPreview, onOpenPanel, onLibrary, onPublish, publicationOpen, onReturnToWorks, workspaceDestinations, returnLabel = 'Gallery', saveState, publicationState, dirty, history, onHistory, historyBlocked,
  preferences, onPreferencesChange, editorPreferences, artworkLayersOpen, onToggleLayers, creationBarVisible, onCreationBarChange, onSearchCommands, openPanels }) {
  const cells = useEditorCells();
  const camera = useWorkbenchCamera();
  const docks = editorPreferences.tools;
  const layout = useSyncExternalStore(docks.subscribe, docks.getSnapshot);
  const bar = useRef(null), trigger = useRef(null), input = useRef(null);
  const { setNavigationTop, setInteractionTool } = useWorkbenchView();
  useLayoutEffect(() => {
    const host = bar.current.closest('main') || hostRef.current;
    const measure = () => {
      const top = hidden ? 0 : bar.current.getBoundingClientRect().bottom;
      setNavigationTop(top);
      host?.style.setProperty('--workspace-navigation-top', `${top}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bar.current); measure();
    return () => { observer.disconnect(); setNavigationTop(0); host?.style.removeProperty('--workspace-navigation-top'); };
  }, [hidden, hostRef, setNavigationTop]);
  const [form, setForm] = useState(null), [name, setName] = useState('');
  const [startLayout, setStartLayout] = useState('canvas');
  const [error, setError] = useState(''), [sizeOpen, setSizeOpen] = useState(false);
  const { items, activeId } = documentNavigation;
  const profileBento = activeId === 'reception';
  const documentName = profileBento ? 'Profile' : items.find(item => item.id === activeId)?.name || 'Untitled';
  const blocked = Boolean(busy || historyBlocked || camera.locked);
  useLayoutEffect(() => { if (focusOnMount) trigger.current?.focus({ preventScroll: true }); }, [focusOnMount]);
  useLayoutEffect(() => { if (form) { input.current?.focus(); input.current?.select?.(); } }, [form]);
  useLayoutEffect(() => { setForm(null); setSizeOpen(false); setError(''); }, [hidden, activeId]);
  const openedNew = useRef(false);
  useLayoutEffect(() => {
    if (!initialNew) { openedNew.current = false; return; }
    if (hidden || openedNew.current) return;
    openedNew.current = true;
    setName('Composition ' + (items.length + 1)); setStartLayout('canvas'); setForm('new');
    onNewOpened?.();
  }, [initialNew, hidden, items.length, onNewOpened]);
  const formTrigger = useRef(null);
  const closeForm = () => { setForm(null); setError(''); (formTrigger.current || trigger.current)?.focus(); formTrigger.current = null; };
  const perform = action => { try { action(); setError(''); return true; } catch (failure) { setError(failure.message); return false; } };
  const startForm = (kind, source = trigger.current) => {
    formTrigger.current = source;
    setName(kind === 'new' ? 'Composition ' + (items.length + 1) : documentName);
    setStartLayout('canvas'); setForm(kind);
  };
  const command = (id, label, run, state = {}) => ({ id, label, run, ...state });
  const check = (id, label, selected, run, state = {}) => command(id, label, run, { checkable: true, selected, ...state });
  const change = patch => onPreferencesChange(current => ({ ...current, ...patch }));
  const historyCommands = ['undo', 'redo'].map(id => command(id, id === 'undo' ? 'Undo' : 'Redo',
    () => onHistory(id), { disabled: blocked || !history[id] }));
  const zoomCommands = [
    command('zoom-in', 'Zoom in', () => navigation.navigatorZoom(Math.min(300, camera.getCamera().scale * 125)), { disabled: camera.locked }),
    command('zoom-out', 'Zoom out', () => navigation.navigatorZoom(Math.max(10, camera.getCamera().scale * 80)), { disabled: camera.locked }),
    command('fit-canvas', 'Fit canvas in view', navigation.navigatorHome, { disabled: camera.locked }),
    command('actual-size', 'Actual size · 100%', navigation.resetZoom, { disabled: camera.locked }),
  ];
  const studioCommands = [
    command('new', 'New composition', source => startForm('new', source), { disabled: blocked || items.length >= MAX_WORKBENCHES }),
    ...(onManageCompositions ? [command('manage', 'Manage works', onManageCompositions, { disabled: blocked })] : []),
    command('rename', 'Rename composition', source => startForm('rename', source), { disabled: profileBento || blocked }),
  ];
  const commands = {
    Canvas: [
      { ...studioCommands[0], label: '+ New' },
      { id: 'compositions', label: 'Compositions', children: items.length
        ? items.map(item => check(item.id, item.name, activeId === item.id, () => documentNavigation.select(item.id)))
        : [command('empty', 'Create your first composition with + New.', undefined, { disabled: true })] },
      command('delete', 'Delete local composition…', () => setForm('delete'), { disabled: profileBento || blocked || items.length < 2,
        reason: items.length === 1 ? 'Studio keeps at least one composition.' : undefined }),
      ...(documentNavigation.beginFirstCell || documentNavigation.cellsUnavailableReason ? [command('add-cell', 'Add cell', () => {
        if (!creationBarVisible) onCreationBarChange(true);
        setInteractionTool('cell');
        hostRef.current?.focus({ preventScroll: true });
      }, { disabled: blocked || Boolean(documentNavigation.cellsUnavailableReason), reason: documentNavigation.cellsUnavailableReason })] : []),
      ...(documentNavigation.enableCanvasModules ? [command('enable-canvas-modules', 'Use canvas modules',
        documentNavigation.enableCanvasModules, { disabled: blocked })] : []),
      command('size', cells ? 'Cell settings' : 'Canvas size', () => cells ? cells.openSettings() : setSizeOpen(true), { disabled: blocked }),
      command('preview', 'Preview', () => onPreview(trigger.current), { disabled: blocked }),
    ],
    Edit: historyCommands,
    View: [
      ...zoomCommands,
      command('focus', 'Focus selection', navigation.focusSelection, { disabled: camera.locked || !navigation.canFocusSelection }),
      command('back', 'Previous view', navigation.goBack, { disabled: camera.locked || !navigation.canGoBack }),
      check('snap-grid', 'Snap to grid', preferences.shortcutSnap, () => change({ shortcutSnap: !preferences.shortcutSnap })),
      ...(!cells ? [check('grid', 'Grid', preferences.gridMode !== 'NONE', () => change({ gridMode: preferences.gridMode === 'NONE' ? 'DOTS' : 'NONE' })),
      check('snap-edges', 'Snap to edges', preferences.edgeSnap, () => change({ edgeSnap: !preferences.edgeSnap }))] : []),
    ],
    Tools: [
      ...(cells ? [command('bento', 'Bento settings', cells.openSettings, { disabled: blocked })] : []),
      check('library', 'Library', openPanels.includes('library'), () => onLibrary(trigger.current)),
      command('grids', 'Grids', () => onOpenPanel('grids', trigger.current)),
      ...(navigation.openGroups ? [command('groups', 'Groups', navigation.openGroups, { disabled: camera.locked })] : []),
      check('drawing', 'Drawing toolbar', creationBarVisible, () => onCreationBarChange(!creationBarVisible)),
      check('Layers', 'Layers', artworkLayersOpen, onToggleLayers),
      check('Inspector', 'Inspector', toolIsVisible(layout, 'Inspector'),
        () => docks.change({ type: toolIsVisible(layout, 'Inspector') ? 'close' : 'open', tab: 'Inspector' })),
    ],
  };
  return <div hidden={hidden} inert={hidden ? '' : undefined} className="editor-menu-shell" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" data-system-workflow-overlay data-workbench-selection-tools>
    <header className="workspace-header editor-menu-bar" data-document={activeId} ref={node => { bar.current = node; navigationRef.current = node; }}>
      <div className="editor-menu-start">
        {!hidden && <WorkspaceBrand key={activeId} current="Studio" trigger={trigger} groups={commands}
          editorActions={onManageCompositions ? [command('manage', 'Manage compositions', onManageCompositions, { disabled: blocked })] : []}
          destinations={{ Discover: source => onOpenPanel('discover', source), ...workspaceDestinations }}
          blocked={blocked} onPanel={onOpenPanel} onError={setError} onSearch={!camera.locked && onSearchCommands}
          onOpen={() => { setForm(null); setSizeOpen(false); setError(''); }} />}
        {onReturnToWorks && <button className="editor-return-link" type="button" aria-label={'Back to ' + returnLabel}
          disabled={blocked} onClick={() => perform(onReturnToWorks)}><ArrowLeft size={15} aria-hidden="true" /><span>{returnLabel}</span></button>}
        <span className="editor-workspace-context" title={documentName}><span className="editor-workspace-name">{documentName}</span></span>
      </div>
      <EditorHeaderActions key={activeId} studioCommands={studioCommands} runStudioCommand={(entry, source) => perform(() => entry.run(source))} {...{ saveState, publicationState, dirty, onPreview, onPublish, publicationOpen, blocked }} />
    </header>
    {form === 'delete' && <section role="alertdialog" aria-label="Delete local composition" aria-describedby="delete-canvas-question" className="editor-menu-form"
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeForm(); } }}>
      <span id="delete-canvas-question">Delete “{documentName}” from this device? This permanently removes the local composition and its edit history. Published versions stay online.</span>
      <div><button type="button" ref={input} onClick={closeForm}>Cancel</button>
        <button type="button" disabled={blocked} onClick={() => {
          if (perform(documentNavigation.remove)) closeForm();
        }}>Delete local composition</button></div>
    </section>}
    {(form === 'new' || form === 'rename') && <form role="dialog" aria-label={form === 'new' ? 'New composition' : 'Rename composition'} className="editor-menu-form"
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeForm(); } }}
      onSubmit={event => { event.preventDefault(); if (perform(() => {
        if (form === 'new') documentNavigation.create(name.trim(), startLayout);
        else documentNavigation.rename(name.trim());
      })) closeForm(); }}>
      {form === 'new' && <CompositionStartLayout value={startLayout} onChange={setStartLayout} />}
      <label>Composition name<input ref={input} value={name} maxLength={64} required onChange={event => setName(event.target.value)} /></label>
      <div><button type="submit">{form === 'new' ? 'Create composition' : 'Save name'}</button><button type="button" onClick={closeForm}>Cancel</button></div>
    </form>}
    {error && <p className="editor-menu-error" role="alert">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></p>}
    <Suspense fallback={null}><CanvasControls hostRef={hostRef} navigation={navigation} historyBlocked={historyBlocked}
      open={sizeOpen} onOpenChange={setSizeOpen} returnFocus={trigger.current} /></Suspense>
    <EditorCellEditingNotice />
  </div>;
}
