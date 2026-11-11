import { lazy, Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import RackMenu from '../menus/RackMenu.jsx';
import WorkspaceSwitcher from '../menus/WorkspaceSwitcher.jsx';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import { EditorCellEditingNotice, useEditorCells } from '../../reception/EditorCellsContext.jsx';
import { createNamedWorkbenchActions } from './namedWorkbenchActions.js';
import { toolIsVisible } from './workbenchToolDockState.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './editorMenuBar.css';
import EditorHeaderActions from './EditorHeaderActions.jsx';
import WorkspaceMenuLabel from './WorkspaceMenuLabel.jsx';

const CanvasControls = lazy(() => import('./WorkbenchCanvasControls.jsx'));

// The bar presents the existing session, history, camera and tool commands.
// It owns its measured screen boundary, open menu and temporary name form.
export default function OwnerEditorMenuBar({ store, projection, flushLayout, busy, hidden, documentNavigation,
  navigationRef, hostRef, navigation, focusOnMount, onPreview, onOpenPanel, onPublish, publicationOpen, workspaceDestinations, saveState, profileName, history, onHistory, historyBlocked,
  preferences, onPreferencesChange, editorPreferences, artworkLayersOpen, onToggleLayers, creationBarVisible, onCreationBarChange, onSearchCommands, openPanels, overview = false, overviewControls, animateEntry = false }) {
  const cells = useEditorCells();
  const MENUS = overview ? ['My Inscape', 'Edit', 'View', 'Docs', 'Backup'] : ['Canvas', ...(cells ? ['Bento'] : []), 'Edit', 'View', 'Tools', 'Docs', 'Backup'];
  const camera = useWorkbenchCamera();
  const docks = editorPreferences.tools;
  const layout = useSyncExternalStore(docks.subscribe, docks.getSnapshot);
  const bar = useRef(null), triggers = useRef({}), input = useRef(null);
  const { setNavigationTop } = useWorkbenchView();
  useLayoutEffect(() => {
    const host = bar.current.closest('main') || hostRef.current;
    const measure = () => {
      const top = hidden ? 0 : bar.current.getBoundingClientRect().bottom;
      setNavigationTop(top);
      host?.style.setProperty('--workspace-navigation-top', `${top}px`);
      setMenu(current => {
        const trigger = current && triggers.current[current.label]?.getBoundingClientRect();
        if (!trigger || (current.anchor.x === trigger.left && current.anchor.y === trigger.bottom)) return current;
        return { ...current, anchor: { x: trigger.left, y: trigger.bottom } };
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bar.current); measure();
    return () => { observer.disconnect(); setNavigationTop(0); host?.style.removeProperty('--workspace-navigation-top'); };
  }, [hidden, hostRef, setNavigationTop]);
  const [focusedMenu, setFocusedMenu] = useState('Canvas');
  const [menu, setMenu] = useState(null), [form, setForm] = useState(null), [name, setName] = useState('');
  const [error, setError] = useState(''), [sizeOpen, setSizeOpen] = useState(false);
  const items = documentNavigation?.items || store.listWorkbenches();
  const activeId = documentNavigation?.activeId || store.getWorkbenchId();
  const reception = activeId === 'reception';
  const documentLabel = reception ? 'Reception Editor' : `Canvas Editor · ${items.find(item => item.id === activeId)?.name || 'Untitled'}`;
  const actions = createNamedWorkbenchActions({ store, projection, flushLayout, busy });
  const blocked = Boolean(busy || historyBlocked || camera.locked);
  useLayoutEffect(() => { if (focusOnMount) triggers.current.Canvas?.focus({ preventScroll: true }); }, [focusOnMount]);
  useLayoutEffect(() => { if (form) { input.current?.focus(); input.current?.select(); } }, [form]);
  useLayoutEffect(() => { setMenu(null); setForm(null); setSizeOpen(false); setError(''); setFocusedMenu(overview ? 'My Inscape' : 'Canvas'); }, [overview, activeId]);
  const closeForm = () => { setForm(null); setError(''); triggers.current.Canvas?.focus(); };
  const perform = action => { try { action(); setError(''); return true; } catch (failure) { setError(failure.message); return false; } };
  const openMenu = (label, focusLast = false) => {
    setForm(null); setSizeOpen(false); setError('');
    if (label === 'Bento') { setMenu(null); cells.openSettings(); return; }
    if (label === 'Docs' || label === 'Backup') { setMenu(null); onOpenPanel(label.toLowerCase(), triggers.current[label]); return; }
    const rect = triggers.current[label].getBoundingClientRect();
    setMenu({ label, focusLast, anchor: { x: rect.left, y: rect.bottom } });
  };
  const startForm = kind => { setName(kind === 'new' ? `Canvas ${items.length + 1}` : items.find(item => item.id === activeId)?.name || ''); setForm(kind); };
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
  const commands = overview ? {
    'My Inscape': [
      command('new', 'New canvas', () => overviewControls.dispatch('new', triggers.current['My Inscape']), { disabled: !overviewControls || overviewControls.count >= MAX_WORKBENCHES || overviewControls.editing }),
      command('edit-canvas', 'Open in Editor', () => overviewControls.dispatch('edit'), { disabled: !overviewControls || overviewControls.editing }),
      command('edit-reception', 'Edit Reception', () => overviewControls.dispatch('reception'), { disabled: !overviewControls || overviewControls.editing }),
    ],
    Edit: [
      command('details', 'Rename and introduction', () => overviewControls.dispatch('details', triggers.current.Edit), { disabled: !overviewControls || overviewControls.editing }),
      ...(overviewControls?.layout === 'grid' ? [
        command('crop', 'Adjust thumbnail', () => overviewControls.dispatch('crop', triggers.current.Edit), { disabled: overviewControls.editing }),
        check('arrange', 'Arrange canvases', overviewControls.arranging, () => overviewControls.dispatch('arrange'), { disabled: overviewControls.count < 2 || overviewControls.editing }),
      ] : []),
      command('settings', 'Settings', () => onOpenPanel('settings', triggers.current.Edit)),
    ],
    View: [
      ...['list', 'grid'].map(value => check(value, value === 'list' ? 'List' : 'Grid', overviewControls?.layout === value,
        () => overviewControls.dispatch('layout', value), { disabled: !overviewControls || overviewControls.editing })),
      ...(overviewControls?.layout === 'grid' ? [
        ...['Small', 'Medium', 'Large'].map((label, index) => check(`size-${index}`, `${label} cards`, overviewControls.cardSize === index + 1, () => overviewControls.dispatch('size', index + 1))),
        check('wrap', 'Wrap around', overviewControls.wrap, () => overviewControls.dispatch('wrap'), { disabled: overviewControls.count < 2 }),
      ] : []),
      command('immersive', 'Immersive view', () => overviewControls.dispatch('immersive'), { disabled: !overviewControls || overviewControls.editing }),
    ],
  } : {
    Zoom: zoomCommands,
    Canvas: [
      ...items.map(item => check(`canvas:${item.id}`, item.name, activeId === item.id, () => (documentNavigation?.select || actions.switchTo)(item.id))),
      command('new', items.length >= MAX_WORKBENCHES ? `New canvas (${MAX_WORKBENCHES}/${MAX_WORKBENCHES} used)` : 'New canvas', () => startForm('new'), { disabled: reception || blocked || items.length >= MAX_WORKBENCHES }),
      command('rename', 'Rename', () => startForm('rename'), { disabled: reception || blocked }),
      command('size', reception ? 'Bento settings' : 'Canvas size', () => reception ? cells.openSettings() : setSizeOpen(true), { disabled: blocked }),
      command('preview', 'Preview', () => onPreview(triggers.current.Canvas), { disabled: blocked }),
    ],
    Edit: [
      command('search', 'Search commands', () => onSearchCommands(triggers.current.Edit), { disabled: camera.locked || !onSearchCommands }),
      ...historyCommands,
      command('settings', 'Settings', () => onOpenPanel('settings', triggers.current.Edit)),
    ],
    View: [
      ...zoomCommands,
      command('focus', 'Focus selection', navigation.focusSelection, { disabled: camera.locked || !navigation.canFocusSelection }),
      command('back', 'Previous view', navigation.goBack, { disabled: camera.locked || !navigation.canGoBack }),
      ...(!reception ? [check('grid', 'Grid', preferences.gridMode !== 'NONE', () => change({ gridMode: preferences.gridMode === 'NONE' ? 'DOTS' : 'NONE' })),
      check('snap-grid', 'Snap to grid', preferences.shortcutSnap, () => change({ shortcutSnap: !preferences.shortcutSnap })),
      check('snap-edges', 'Snap to edges', preferences.edgeSnap, () => change({ edgeSnap: !preferences.edgeSnap }))] : []),
    ],
    Tools: [
      ...(navigation.openGroups ? [command('groups', 'Groups', navigation.openGroups, { disabled: camera.locked })] : []),
      check('drawing', 'Drawing toolbar', creationBarVisible, () => onCreationBarChange(!creationBarVisible)),
      check('Layers', 'Layers', artworkLayersOpen, onToggleLayers),
      check('Inspector', 'Inspector', toolIsVisible(layout, 'Inspector'),
        () => docks.change({ type: toolIsVisible(layout, 'Inspector') ? 'close' : 'open', tab: 'Inspector' })),
    ],
  };
  return <div hidden={hidden} inert={hidden ? '' : undefined} className="editor-menu-shell" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette={overview ? undefined : 'editor'} data-system-workflow-overlay data-workbench-selection-tools>
    <header className="editor-menu-bar" onClickCapture={event => {
      if (menu && (!event.target.closest('[aria-haspopup="menu"]') || event.target.closest('.workspace-switcher'))) setMenu(null);
    }} ref={node => { bar.current = node; navigationRef.current = node; }}>
      <div className="editor-menu-start"><button className="editor-menu-brand" type="button" aria-label="Inscape sidebar" title="Show or hide sidebar"
        aria-expanded={preferences.dockVisible} onClick={() => { setMenu(null); change({ dockVisible: !preferences.dockVisible }); }}>
        <svg viewBox="0 0 480 154" role="img" aria-label="Inscape"><use href="/assets/brand/inscape-wordmark-new.svg#inscape-wordmark" /></svg>
      </button>
      <nav role="menubar" aria-label={overview ? 'My Inscape commands' : 'Editor commands'} data-document={activeId} onKeyDown={event => {
        const index = MENUS.indexOf(event.target.dataset.menu);
        if (index < 0) return;
        if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); setMenu(null);
          triggers.current[MENUS[event.key === 'Home' ? 0 : event.key === 'End' ? MENUS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + MENUS.length) % MENUS.length]]?.focus();
        } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openMenu(MENUS[index], event.key === 'ArrowUp'); }
      }}>
        {MENUS.map((label, index) => <button key={index === 0 ? 'context' : label} ref={node => { triggers.current[label] = node; }} type="button" role="menuitem" data-menu={label} aria-label={label}
          className={index === 0 ? 'workspace-context-menu' : undefined}
          tabIndex={focusedMenu === label ? 0 : -1} onFocus={() => setFocusedMenu(label)}
          aria-haspopup={['Bento', 'Docs', 'Backup'].includes(label) ? 'dialog' : 'menu'} aria-expanded={label === 'Bento' ? cells?.bentoOpen : menu?.label === label || openPanels.includes(label.toLowerCase())}
          data-system-workflow-panel-trigger onPointerEnter={() => { if (MENUS.includes(menu?.label) && !['Docs', 'Backup'].includes(label) && menu.label !== label) openMenu(label); }}
          onClick={() => menu?.label === label ? setMenu(null) : openMenu(label)}><WorkspaceMenuLabel label={label} context={overview ? 'overview' : 'editor'} index={index} animateEntry={animateEntry} /></button>)}
      </nav></div>
      <WorkspaceSwitcher current={overview ? 'My Inscape' : reception ? 'Reception Editor' : 'Canvas Editor'}
        label={overview ? 'My Inscape' : documentLabel} destinations={workspaceDestinations} onChoose={perform}
        disabled={blocked || (overview && overviewControls?.editing)} />
      {!overview && <EditorHeaderActions menu={menu?.label} triggers={triggers}
        toggle={(label, focusLast) => menu?.label === label && focusLast === undefined ? setMenu(null) : openMenu(label, focusLast)}
        saveState={saveState} undo={historyCommands[0]} redo={historyCommands[1]} zoom={Math.round(camera.getCamera().scale * 100)}
        onPreview={onPreview} onPublish={onPublish} publicationOpen={publicationOpen} onOpenPanel={onOpenPanel}
        openPanels={openPanels} profileName={profileName} blocked={blocked} />}
    </header>
    {menu && commands[menu.label] && <RackMenu label={`${menu.label} menu`} anchor={menu.anchor} palette={overview ? undefined : 'editor'} commands={commands[menu.label]} systemWorkflowOverlay
      menuBarRef={bar} focusLast={menu.focusLast} returnFocus={triggers.current[menu.label]} onClose={() => setMenu(null)}
      onNavigateMenu={!MENUS.includes(menu.label) ? undefined : direction => { const next = MENUS[(MENUS.indexOf(menu.label) + direction + MENUS.length) % MENUS.length];
        if (['Docs', 'Backup'].includes(next)) { setMenu(null); triggers.current[next]?.focus(); } else openMenu(next); }}
      onCommand={id => { const entry = commands[menu.label].find(item => item.id === id); setMenu(null); triggers.current[menu.label]?.focus(); perform(entry.run); }} />}
    {form && <form role="dialog" aria-label={form === 'new' ? 'New canvas' : 'Rename canvas'} className="editor-menu-form"
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeForm(); } }}
      onSubmit={event => { event.preventDefault(); if (perform(() => form === 'new' ? actions.create(name) : actions.rename(name))) closeForm(); }}>
      <label>{form === 'new' ? 'New canvas name' : 'Canvas name'}<input ref={input} value={name} maxLength={64} required onChange={event => setName(event.target.value)} /></label>
      <div><button type="submit">{form === 'new' ? 'Create canvas' : 'Save name'}</button><button type="button" onClick={closeForm}>Cancel</button></div>
    </form>}
    {error && <p className="editor-menu-error" role="alert">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></p>}
    <Suspense fallback={null}><CanvasControls hostRef={hostRef} navigation={navigation} historyBlocked={historyBlocked}
      open={sizeOpen} onOpenChange={setSizeOpen} returnFocus={triggers.current.Canvas} /></Suspense>
    {!overview && <EditorCellEditingNotice />}
  </div>;
}
