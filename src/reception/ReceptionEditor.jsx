import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Plus, Image as ImageIcon, Type, Palette, Crop, GripVertical, Info, Undo2, Redo2, Eye, ArrowLeft, Smartphone, Monitor, Settings2, HardDrive, Trash2, Columns2, Rows2, Check } from 'lucide-react';
import { cropFocusBounds, normalizeCropForMask } from '../lattice/rendering/latticeCrop.js';
import { projectSystemWorkflowTransform, unprojectSystemWorkflowCrop } from '../systemWorkflow/systemWorkflowTransform.js';
import { ReceptionButton as Button, ReceptionPanel, ReceptionRange, ReceptionChoices } from './ReceptionControls.jsx';
import { createReception, projectReception, RECEPTION_IMAGE_MIN_ZOOM } from '../profileDocument/domain/receptionPresentation.js';
import useReceptionContent from './useReceptionContent.js';
import ReceptionLibrary from './ReceptionLibrary.jsx';
import ReceptionColourPanel from './ReceptionColourPanel.jsx';
import { OwnerSystemWorkflowMetadataContent } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';
import { createProfileDocumentV9AssetDossier } from '../profileDocument/components/profileDocumentV9FocusViewModel.js';
import useTextRecovery from '../text/useTextRecovery.js';
import { TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import WorkbenchBackupControls from '../systemWorkflow/WorkbenchBackupControls.jsx';
import ReceptionCanvas from './ReceptionCanvas.jsx';
import ReceptionFrameTools from './ReceptionFrameTools.jsx';
import ReceptionNavigation from './ReceptionNavigation.jsx';
import ReceptionHeader from './ReceptionHeader.jsx';
import { splitReception, resizeReception, receptionMinimum, reorderReception, deleteReceptionCell, receptionPixelRect } from './receptionLayout.js';
import { saveReception, addReceptionText, placeReceptionLink } from './receptionSession.js';
import useReceptionGesture from './useReceptionGesture.js';
import useDeferredFocusReturn from '../public/useDeferredFocusReturn.js';
import '../public/ownerSystemWorkflow/workflowTactile.css';
import '../public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../public/ownerSystemWorkflow/workflowFlat.css';
import '../public/ownerSystemWorkflow/workbenchToolChrome.css';
import '../lattice/rendering/latticeMenuSurface.css';
import ReceptionPresentation from './ReceptionPresentation.jsx';
import ReceptionLinkEditor from './ReceptionLinkEditor.jsx';
import ReceptionGridSettings from './ReceptionGridSettings.jsx';
import { ReceptionBrandSettings, ReceptionThemeSettings } from './ReceptionBrandSettings.jsx';
const ReceptionTextEditor = lazy(() => import('./ReceptionTextEditor.jsx'));

export default function ReceptionEditor({ store, rootStore, onClose, onRestored, onCanvases = onClose, onDiscover, onReturn, reviewAssets, reviewCategories, reviewProfile, publishedDocument, storage, editorPreferences }) {
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot), generation = store.getGeneration();
  const [blank] = useState(createReception), value = draft.reception || blank;
  const [selected, setSelected] = useState(null), [preview, setPreview] = useState(null), [theme, setTheme] = useState(value.branding.theme);
  const [previewMode, setPreviewMode] = useState(null), [editing, setEditing] = useState(true), [error, setError] = useState('');
  const [frameSize, setFrameSize] = useState({ width: 1000, height: 700 });
  const mode = previewMode === 'mobile' || frameSize.width <= 640 ? 'mobile' : 'desktop';
  const minimum = receptionMinimum(frameSize.width, frameSize.height, value.gutter);
  const [panel, setPanel] = useState(null), [splitHint, setSplitHint] = useState(null), [cropping, setCropping] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false), [toolsHost, setToolsHost] = useState(null), [dragging, setDragging] = useState(null);
  const [activeTool, setActiveTool] = useState('panel');
  const [spacingAll, setSpacingAll] = useState(false);
  const [settingsTab, setSettingsTab] = useState('grid'), settingsId = useId();
  const [colourOpen, setColourOpen] = useState(false), [colourScope, setColourScope] = useState('cell');
  const [colourMode, setColourMode] = useState('background'), [colourHost, setColourHost] = useState(null);
  const editorHost = useRef(null), workspaceHost = useRef(null), libraryFocus = useRef(null);
  const [libraryPlacing, setLibraryPlacing] = useState(false);
  const preferenceError = useSyncExternalStore(editorPreferences.subscribe, editorPreferences.getError);
  const recoveries = useTextRecovery(store, store.getProfileAddress());
  const [sceneSession] = useState(() => `editor:${crypto.randomUUID()}`);
  const collection = useMemo(() => ({ kind: 'local', profileAddress: rootStore.getProfileAddress(), revision: sceneSession, generation, stale: false,
    entries: rootStore.listWorkbenches().map(item => rootStore.readWorkbench(item.id)) }), [rootStore, generation, sceneSession]);
  const { library, model } = useReceptionContent({ draft, reception: value, collection, libraryOpen, reviewAssets, reviewCategories, reviewProfile, publishedDocument });
  const assets = useMemo(() => new Map(library.canonicalRecords.map(asset => [asset.id || asset.stableAssetId, asset])), [library.canonicalRecords]);
  const shown = !editing ? projectReception(value) : preview?.generation === generation ? preview.value : value, region = value.regions.find(r => r.id === selected) || value.regions[0];
  const image = value.imageModules.find(i => i.id === region.content), text = value.texts.find(i => i.id === region.content), history = store.getHistory();
  const selectedRegion = region.id === selected ? region : null, selectedText = selectedRegion ? text : null;
  const textColour = colourScope === 'cell' && selectedText && colourMode === 'text';
  const colourKey = `${store.getProfileAddress()}:${colourScope}:${colourScope === 'cell' ? selected : ''}`;
  const gesture = useReceptionGesture(generation);
  const { restoreFocus } = useDeferredFocusReturn();
  const fallbackFocus = () => editorHost.current?.querySelector('[data-region-id][data-selected]') || editorHost.current?.querySelector('[aria-label="Settings"]');
  const cancelLibrary = (returnFocus = true) => {
    setLibraryOpen(false); setLibraryPlacing(false);
    if (libraryOpen && returnFocus) restoreFocus(() => libraryFocus.current?.isConnected ? libraryFocus.current
      : [...(workspaceHost.current?.querySelectorAll('[data-region-id]') || [])].find(node => node.dataset.regionId === region.id));
  };
  useEffect(() => { setDragging(null); setPreview(null); setSplitHint(null); }, [generation]);
  useEffect(() => {
    if (selected && !value.regions.some(cell => cell.id === selected)) { setSelected(null); setPanel(current => current === 'settings' ? current : null); setCropping(false); }
  }, [selected, value.regions]);
  useEffect(() => { const narrow = matchMedia('(max-width: 640px)'); const change = () => setPreviewMode(null); narrow.addEventListener('change', change); return () => narrow.removeEventListener('change', change); }, []);
  const run = action => { if (recoveries.length) { setError(TEXT_RECOVERY_MESSAGE); return; } try { const result = action(); setError(''); return result === undefined ? true : result; } catch (failure) { setError(failure.message); return false; } };
  const save = (next, label) => saveReception(store, draft.reception, next, label);
  const guard = () => { if (recoveries.length) { setError(TEXT_RECOVERY_MESSAGE); return false; } return true; };
  const select = id => {
    if (id === selected || !guard()) return;
    gesture.cancel(); setPreview(null); setCropping(false);
    setSelected(id); setPanel(current => current === 'settings' ? current : null); setSpacingAll(false);
  };
  const leave = callback => { if (!guard()) return; gesture.cancel(); cancelLibrary(); callback(); };
  const changeRegion = patch => run(() => save({ ...value, regions: value.regions.map(r => r.id === region.id ? { ...r, ...patch } : r) }, 'Style Reception region'));
  const spacedText = (padding, all = spacingAll) => ({ ...value, regions: value.regions.map(r =>
    (all ? value.texts.some(t => t.id === r.content) : r.id === region.id) ? { ...r, padding } : r) });
  const saveSpacing = (padding, all) => run(() => save(spacedText(padding, all), 'Space Text'));
  const split = axis => run(() => {
    if (!guard()) return;
    const frame = editorHost.current?.querySelector('.reception-canvas');
    const rect = mode === 'mobile' ? { width: frameSize.width, height: mobileItem.height } : receptionPixelRect(region, frame?.clientWidth || 1000, frameSize.height, value.gutter);
    if ((axis === 'x' ? rect.width : rect.height) < 192 + value.gutter) throw new Error('This cell is too small to divide again. Drag its divider to make more room first.');
    const id = `region:${crypto.randomUUID()}`;
    let next = splitReception(value, region.id, axis, id);
    if (mode === 'mobile') next = { ...next, mobile: next.mobile.map(m => [region.id, id].includes(m.id) ? { ...m, columns: axis === 'x' ? 1 : 2 } : m) };
    save(next, 'Add Reception cell'); setSelected(id); setPanel(null); setSplitHint(null); setCropping(false);
  });
  const openLibrary = (id = region.id) => run(() => {
    if (!guard()) return;
    setSelected(id); libraryFocus.current = document.activeElement; gesture.cancel(); setSplitHint(null); setLibraryOpen(true); setActiveTool('library'); setPanel(null); setCropping(false);
  });
  const createText = (id = region.id) => run(() => {
    if (!guard()) return;
    addReceptionText(store, draft.reception, id, value); setSelected(id); showTextTools();
  });
  const changeImage = patch => run(() => save({ ...value, imageModules: value.imageModules.map(i => i.id === image.id ? { ...i, ...patch } : i) }, 'Edit Reception Image'));
  const changeCrop = crop => changeImage({ sides: image.sides.map((side, index) => index ? side : { ...side, crop }) });
  const beginDivider = (event, divider, frame) => {
    if (!guard()) return;
    const origin = value, expected = draft.reception, version = generation, bounds = frame.getBoundingClientRect(); let candidate = origin;
    gesture.begin(event, {
      update(e) {
        const coordinate = divider.axis === 'x' ? e.clientX - bounds.left : e.clientY - bounds.top;
        const extent = divider.axis === 'x' ? bounds.width : bounds.height;
        candidate = resizeReception(origin, divider.id, (coordinate + origin.gutter / 2) / (extent + origin.gutter) * 10000, minimum);
        setPreview({ generation: version, value: candidate });
      },
      commit() { setPreview(null); if (JSON.stringify(candidate) !== JSON.stringify(origin)) run(() => saveReception(store, expected, candidate, 'Resize Reception divider', version)); },
      cancel() { setPreview(null); },
    });
  };
  const mobileItem = value.mobile.find(m => m.id === region.id);
  const setMobile = patch => run(() => save({ ...value, mobile: value.mobile.map(m => m.id === region.id ? { ...m, ...patch } : m) }, 'Arrange mobile Reception'));
  const openPanel = name => { gesture.cancel(); setSplitHint(null); setPanel(panel === name ? null : name); setActiveTool('panel'); setCropping(false); setSpacingAll(false); };
  const showTextTools = () => { setPanel('text'); setActiveTool('panel'); setCropping(false); };
  const openColour = scope => { setColourScope(scope); setColourMode('background'); setColourOpen(true); setActiveTool('colour'); };
  const colourValue = surface => colourScope === 'grid' ? { ...value, surface } : { ...value, regions: value.regions.map(r => r.id === selected ? { ...r, surface } : r) };
  const closePanel = () => { setPanel(null); setSplitHint(null); };
  const deleteCell = () => run(() => {
    gesture.cancel(); save(deleteReceptionCell(value, region.id), 'Delete Reception cell');
    setSelected(null); closePanel(); setCropping(false);
    restoreFocus(() => editorHost.current?.querySelector('[aria-label="Add cell"]'));
  });
  const moveCellKey = event => {
    const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!delta) return;
    event.preventDefault(); event.stopPropagation();
    const ordered = mode === 'mobile' ? value.mobile : [...value.regions].sort((a, b) => a.y - b.y || a.x - b.x);
    const target = ordered[ordered.findIndex(cell => cell.id === region.id) + delta];
    if (target) run(() => save(reorderReception(value, region.id, target.id, mode), 'Move Reception cell'));
  };
  const beginCellMove = event => {
    if (!guard() || value.regions.length < 2) return;
    const origin = value, expected = draft.reception, version = generation, from = region.id;
    const cells = [...(workspaceHost.current?.querySelectorAll('[data-region-id]') || [])].map(node => ({ id: node.dataset.regionId, rect: node.getBoundingClientRect() }));
    let candidate = origin;
    closePanel(); setCropping(false); setDragging(from);
    gesture.begin(event, {
      // Reordering relocates the cell DOM. Capture belongs to the stable host,
      // otherwise moving the handle itself can emit lostpointercapture.
      captureHost: workspaceHost.current,
      update(point) {
        const target = cells.find(({ rect }) => point.clientX >= rect.left && point.clientX <= rect.right && point.clientY >= rect.top && point.clientY <= rect.bottom);
        candidate = target ? reorderReception(origin, from, target.id, mode) : origin;
        setPreview({ generation: version, value: candidate });
      },
      commit() { setPreview(null); setDragging(null); if (candidate !== origin) run(() => saveReception(store, expected, candidate, 'Move Reception cell', version)); },
      cancel() { setPreview(null); setDragging(null); },
    });
  };
  const imageValue = (crop, origin = value) => ({ ...origin, imageModules: origin.imageModules.map(i => i.id === image.id ? { ...i, sides: i.sides.map((side, index) => index ? side : { ...side, crop }) } : i) });
  const cropPreview = crop => setPreview(crop ? { generation, value: imageValue(crop) } : null);
  const beginCrop = (event, node) => {
    if (!image || !guard()) return;
    const origin = value, expected = draft.reception, version = generation, side = image.sides[0];
    const bounds = node.getBoundingClientRect(), mask = { left: 0, top: 0, width: bounds.width, height: bounds.height };
    const visual = projectSystemWorkflowTransform(side.transform, side.asset.media, side.crop || { x: .5, y: .5, zoom: 1 });
    const start = normalizeCropForMask(visual.crop, mask, visual.dimensions), size = cropFocusBounds(mask, visual.dimensions, start.zoom).renderedSize;
    const x = event.clientX, y = event.clientY; let candidate = null;
    gesture.begin(event, {
      update(e) {
        const crop = unprojectSystemWorkflowCrop(side.transform, normalizeCropForMask({ ...start, x: Math.min(1, Math.max(0, start.x - (e.clientX - x) / size.width)), y: Math.min(1, Math.max(0, start.y - (e.clientY - y) / size.height)) }, mask, visual.dimensions));
        candidate = imageValue(crop, origin); setPreview({ generation: version, value: candidate });
      },
      commit() { setPreview(null); if (candidate && JSON.stringify(candidate) !== JSON.stringify(origin)) run(() => saveReception(store, expected, candidate, 'Reframe Reception image', version)); },
      cancel() { setPreview(null); },
    });
  };
  const cropKey = (event, node) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta || !image) return;
    event.preventDefault(); event.stopPropagation();
    const side = image.sides[0], visual = projectSystemWorkflowTransform(side.transform, side.asset.media, side.crop || { x: .5, y: .5, zoom: 1 });
    const mask = { left: 0, top: 0, width: node.clientWidth, height: node.clientHeight }, start = normalizeCropForMask(visual.crop, mask, visual.dimensions);
    const size = cropFocusBounds(mask, visual.dimensions, start.zoom).renderedSize, step = event.shiftKey ? 24 : 8;
    changeCrop(unprojectSystemWorkflowCrop(side.transform, normalizeCropForMask({ ...start, x: Math.max(0, Math.min(1, start.x - delta[0] * step / size.width)), y: Math.max(0, Math.min(1, start.y - delta[1] * step / size.height)) }, mask, visual.dimensions)));
  };
  const togglePreview = () => { if (!guard()) return; gesture.cancel(); cancelLibrary(); closePanel(); setCropping(false); setEditing(!editing); };
  const historyAction = redo => { if (!guard()) return; gesture.cancel(); run(() => { if (!(redo ? store.redo() : store.undo())) throw new Error('History could not be saved. Your accepted layout is unchanged.'); }); };
  const nav = <ReceptionNavigation reception={shown} model={model} theme={theme} onTheme={setTheme}
    onCanvases={() => leave(onCanvases)} onDiscover={onDiscover ? () => leave(onDiscover) : undefined}
    onEditBrand={editing ? () => openPanel('brand') : undefined} />;
  const cellNumber = value.regions.indexOf(region) + 1;
  const toolTop = workspaceHost.current ? workspaceHost.current.getBoundingClientRect().top - editorHost.current.getBoundingClientRect().top + 8 : 16;
  return <ReceptionPresentation snapshot={collection} assets={assets}><main ref={editorHost} className={'reception-page system-workflow__token-scope ' + (editing ? 'reception-editor' : 'reception-preview')} data-reception-editor
    data-menu-surface={theme} data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat" aria-label="Reception editor"
    onPointerDown={event => { if (editing && !event.target.closest('[data-region-id], .workbench-tool-panel, .reception-tool-panel, .reception-library, .reception-library-window, .reception-divider, .reception-window-header')) select(null); }}
    onKeyDown={event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        if (colourOpen && activeTool === 'colour') { setColourOpen(false); return; }
        gesture.cancel(); cancelLibrary(); closePanel(); setCropping(false); setSelected(null); if (!editing) setEditing(true); return;
      }
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); historyAction(event.key.toLowerCase() === 'y' || event.shiftKey); }
    }}>
    <div className="reception-window reception-editor-window" data-editing={editing || undefined} data-panel-side={region.x >= 5000 ? 'left' : 'right'}>
      <ReceptionHeader className="reception-editor-header" navigation={nav}>
        {onReturn && <Button label="Back to my Workbench" onClick={() => leave(onReturn)}>Workbench</Button>}
        {editing ? <>
          <Button icon={Undo2} label="Undo Reception" disabled={!history.undo} onClick={() => historyAction(false)} />
          <Button icon={Redo2} label="Redo Reception" disabled={!history.redo} onClick={() => historyAction(true)} />
          <Button icon={mode === 'mobile' ? Smartphone : Monitor} label="Mobile layout" aria-pressed={mode === 'mobile'} disabled={mode === 'mobile' && !previewMode} onClick={() => { gesture.cancel(); setPreviewMode(previewMode === 'mobile' ? null : 'mobile'); }} />
          <Button icon={Settings2} label="Settings" aria-expanded={panel === 'settings'} onClick={() => openPanel('settings')}>Settings</Button>
          <Button icon={HardDrive} label="Backup and recovery" aria-expanded={panel === 'recovery'} onClick={() => openPanel('recovery')} />
          <Button icon={Eye} label="Preview" onClick={togglePreview} />
          <Button icon={Check} onClick={() => leave(onClose)}>Done</Button>
        </> : <Button icon={ArrowLeft} onClick={togglePreview}>Back to editing</Button>}
      </ReceptionHeader>
      {preferenceError && <div role="alert" className="reception-editor-error">{preferenceError}<Button onClick={editorPreferences.retry}>Save current editor preferences</Button></div>}
      {error && <div className="reception-editor-error" role="alert">{error}<Button onClick={() => setError('')}>Dismiss</Button></div>}
      <div ref={workspaceHost} className="reception-window-workspace reception-editor-workspace" data-library-open={libraryOpen || undefined} data-library-placing={libraryPlacing || undefined}>
      <div className="reception-window-main reception-editor-main" data-preview={previewMode || undefined}>
        <ReceptionCanvas reception={shown} model={model} address={store.getProfileAddress()}
          selected={editing ? selected : null} dragging={dragging} mode={previewMode || undefined} onSize={setFrameSize} splitHint={splitHint}
          onSelect={editing ? select : undefined}
          renderMoveHandle={editing && !cropping ? () => <Button icon={GripVertical} label="Move cell" className="workflow-tactile-control reception-cell-drag" disabled={value.regions.length < 2}
            title="Drag to move this cell, or use the arrow keys" onPointerDown={beginCellMove} onKeyDown={moveCellKey} /> : undefined}
          renderFrameTools={editing && selected ? bounds => <ReceptionFrameTools {...bounds} reception={shown} selected={selected} onDividerStart={beginDivider} onDividerKey={(event, divider) => {
            const delta = { ArrowLeft: -100, ArrowUp: -100, ArrowRight: 100, ArrowDown: 100 }[event.key]; if (delta === undefined) return;
            event.preventDefault(); run(() => save(resizeReception(value, divider.id, divider.position + delta, minimum), 'Resize Reception divider'));
          }} /> : undefined}
          cropTarget={editing && cropping ? region.id : null} onCropStart={beginCrop} onCropKey={cropKey}
          renderEmpty={editing ? cell => <div className="reception-empty-actions workbench-tool-controls" data-window-chrome="flat"><span>Make room for your work.</span><div>
            <Button icon={ImageIcon} onClick={() => openLibrary(cell.id)}>Image from Library</Button>
            <Button icon={Type} onClick={() => createText(cell.id)}>New Text</Button>
          </div></div> : undefined}
          renderText={editing ? (record, cell) => record.id === text?.id && cell.id === selected
            ? <Suspense fallback={<p>Opening Text…</p>}><ReceptionTextEditor record={record} store={store} toolsHost={toolsHost} colourHost={textColour ? colourHost : null} onRevealTools={showTextTools} /></Suspense> : null : undefined} />
      </div>
      </div>
    </div>
      {editing && <div className="reception-editor-toolbar" onPointerDown={event => event.stopPropagation()}>
        {selectedRegion ? <div className="reception-cell-actions workbench-tool-controls" data-window-chrome="flat" role="toolbar" aria-label={'Cell ' + cellNumber + ' tools'}>
            {cropping ? <><span>Drag image to reframe</span><Button icon={Check} onClick={() => { closePanel(); setCropping(false); }}>Finish crop</Button></> : <>
              {image && <><Button icon={ImageIcon} label="Replace image" onClick={() => openLibrary()} /><Button icon={Crop} label="Crop image" onClick={() => { if (!image.sides[0].crop) changeCrop({ x: .5, y: .5, zoom: 1 }); setPanel('image'); setActiveTool('panel'); setCropping(true); }} /><Button icon={Info} label="Artwork information" onClick={() => openPanel('info')} /></>}
              {text && <Button icon={Type} label="Edit text" onClick={showTextTools} />}
              {region.content?.startsWith('link:') && <Button onClick={() => openPanel('link')}>Edit link</Button>}
              <Button icon={Palette} label="Cell color" onClick={() => openColour('cell')} />
              <Button icon={Plus} label="Add cell" aria-expanded={panel === 'add'} onClick={() => openPanel('add')}>Add cell</Button>
              <Button icon={Trash2} label="Delete cell" onClick={deleteCell} />
            </>}
          </div> : <div className="workbench-tool-controls" data-window-chrome="flat"><Button icon={Plus} label="Add cell" onClick={() => { setSelected(region.id); openPanel('add'); }}>Add cell</Button></div>}
      </div>}
      {editing && panel && <ReceptionPanel key={panel} panelId={panel} preferences={editorPreferences} boundsRef={editorHost} initialTop={toolTop} side={region.x >= 5000 ? 'left' : 'right'}
        active={activeTool === 'panel'} onActivate={() => setActiveTool('panel')} onFocusReturn={restoreFocus} fallbackFocus={fallbackFocus} className={panel === 'text' ? 'text-tools-window' : ''} title={({ add: 'Add cell', link: 'Link canvas content', image: 'Image framing', info: 'Artwork information', settings: 'Settings', text: 'Text', brand: 'Header', recovery: 'Backup and recovery' })[panel]} onClose={() => { closePanel(); setCropping(false); }}>
        {panel === 'add' && <><p>Divide this cell. Its content stays in place.</p><div className="reception-split-options">
          {[['x', 'Beside', Columns2], ['y', 'Below', Rows2]].map(([axis, label, Icon]) => <Button key={axis} icon={Icon} onPointerEnter={() => setSplitHint(axis)} onFocus={() => setSplitHint(axis)}
            onPointerLeave={() => setSplitHint(null)} onBlur={() => setSplitHint(null)} onClick={() => split(axis)}>{label}</Button>)}
        </div></>}
        {panel === 'link' && <ReceptionLinkEditor key={`${region.id}:${generation}`} snapshot={collection} link={value.links?.find(link => link.id === region.content)} onSave={link => run(() => { save(placeReceptionLink(value, region.id, link), 'Link Reception content'); closePanel(); })} />}
        {panel === 'settings' && <>
          <div className="reception-settings-tabs" role="tablist" aria-label="Settings sections">
            {['grid', 'text'].map((tab, index) => <Button key={tab} role="tab" id={`${settingsId}-${tab}-tab`} aria-controls={`${settingsId}-${tab}`}
              aria-selected={settingsTab === tab} tabIndex={settingsTab === tab ? 0 : -1} onClick={() => setSettingsTab(tab)} onKeyDown={event => {
                const next = { ArrowLeft: 1 - index, ArrowRight: 1 - index, Home: 0, End: 1 }[event.key];
                if (next === undefined) return; event.preventDefault(); setSettingsTab(next ? 'text' : 'grid'); event.currentTarget.parentElement.children[next].focus();
              }}>{tab === 'grid' ? 'Grid' : 'Text'}</Button>)}
          </div>
          <section className="reception-settings-section" role="tabpanel" id={`${settingsId}-grid`} aria-labelledby={`${settingsId}-grid-tab`} hidden={settingsTab !== 'grid'}>
            <ReceptionGridSettings value={value} generation={generation} onColour={() => openColour('grid')}
              onSave={(next, label) => run(() => save(next, label))} onPreview={next => setPreview(next ? { generation, value: next } : null)} />
            <ReceptionThemeSettings value={value} theme={theme} onTheme={setTheme} onSave={(next, label) => run(() => save(next, label))} />
            {selectedRegion && <fieldset className="reception-selected-settings"><legend>Cell {cellNumber}</legend>
              {(image || text) && <label className="reception-check"><input type="checkbox" checked={(image || text).visibility === 'PUBLIC'}
                onChange={event => image ? changeImage({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })
                  : run(() => save({ ...value, texts: value.texts.map(item => item.id === text.id ? { ...item, visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' } : item) }, 'Reception Text publication choice'))} />Include in publication</label>}
              {mode === 'mobile' && <><ReceptionChoices label="Mobile width" value={mobileItem.columns} choices={[[2, 'Full row'], [1, 'Half row']]} onChange={columns => setMobile({ columns })} />
                <ReceptionChoices label="Mobile height" value={mobileItem.height} choices={[[200, 'Compact'], [320, 'Medium'], [480, 'Tall']]} onChange={height => setMobile({ height })} /></>}
            </fieldset>}
          </section>
          <section className="reception-settings-section" role="tabpanel" id={`${settingsId}-text`} aria-labelledby={`${settingsId}-text-tab`} hidden={settingsTab !== 'text'}>
            {!selectedText && <p>Select a text cell or choose New Text in an empty cell to edit text.</p>}
            <fieldset className="reception-selected-settings" disabled={!selectedText}><legend>Text layout</legend>
              <div className="reception-spacing">
                <ReceptionRange label="Content spacing" unit="px" value={selectedText ? region.padding ?? 24 : 24} max={128} version={generation}
                  onCommit={saveSpacing} onPreview={padding => setPreview(padding === null ? null : { generation, value: spacedText(padding) })} />
                <label className="reception-check"><input type="checkbox" checked={spacingAll} onChange={event => {
                  const all = event.target.checked;
                  if (!all || saveSpacing(region.padding ?? 24, true)) setSpacingAll(all);
                }} />Apply to all</label>
              </div>
              <ReceptionChoices label="Horizontal alignment" value={selectedText ? region.alignX : 'left'} choices={['left', 'center', 'right'].map(v => [v, v])} onChange={alignX => changeRegion({ alignX })} />
              <ReceptionChoices label="Vertical alignment" value={selectedText ? region.alignY : 'top'} choices={['top', 'center', 'bottom'].map(v => [v, v])} onChange={alignY => changeRegion({ alignY })} />
            </fieldset>
          </section>
        </>}
        {panel === 'text' && text && <div className="text-tools-content" ref={setToolsHost} />}
        {panel === 'image' && image && <>
          <p>Drag the image inside its cell, or use the arrow keys. Zoom out to leave space around it.</p>
          <ReceptionChoices label="Image fitting" value={image.sides[0].crop ? (image.sides[0].crop.zoom >= 1 ? 'fill' : null) : 'fit'} choices={[['fill', 'Fill cell'], ['fit', 'Fit inside']]} onChange={choice => { changeCrop(choice === 'fit' ? null : { x: .5, y: .5, zoom: 1 }); setCropping(choice === 'fill'); }} />
          {image.sides[0].crop && <ReceptionRange label="Image zoom" min={RECEPTION_IMAGE_MIN_ZOOM} max={4} step={.01} value={image.sides[0].crop.zoom} version={generation}
            onCommit={zoom => changeCrop({ ...image.sides[0].crop, zoom })} onPreview={zoom => cropPreview(zoom === null ? null : { ...image.sides[0].crop, zoom })} />}
          <Button onClick={() => { closePanel(); setCropping(false); }}>Finish crop</Button>
        </>}
        {panel === 'info' && image && <OwnerSystemWorkflowMetadataContent dossier={createProfileDocumentV9AssetDossier(image.sides[0]?.asset)} />}
        {panel === 'brand' && <ReceptionBrandSettings value={value} model={model} onSave={(next, label) => run(() => save(next, label))} />}
        {panel === 'recovery' && <><p>Edits save locally. Publish profile details in Workbench when you are ready to share.</p>
          <WorkbenchBackupControls store={rootStore} storage={storage || globalThis.localStorage} recoveryPending={recoveries.length > 0} onRestored={onRestored} /></>}
      </ReceptionPanel>}
      {editing && colourOpen && <ReceptionPanel title="Color" panelId="colour" preferences={editorPreferences} boundsRef={editorHost} initialTop={toolTop}
        side={region.x >= 5000 ? 'right' : 'left'} active={activeTool === 'colour'} onActivate={() => setActiveTool('colour')}
        onClose={() => setColourOpen(false)} onFocusReturn={restoreFocus} fallbackFocus={fallbackFocus}>
        <p>{colourScope === 'grid' ? 'Grid background' : selectedRegion ? `Cell ${cellNumber}` : 'Select a cell to change its color.'}</p>
        {colourScope === 'cell' && selectedText && <ReceptionChoices label="Apply color to" value={textColour ? 'text' : 'background'}
          choices={ [['background', 'Background'], ['text', 'Text']] } onChange={setColourMode} />}
        {textColour ? <div ref={setColourHost} /> : <ReceptionColourPanel key={colourKey} scopeKey={colourKey}
          color={(colourScope === 'cell' ? selectedRegion?.surface : null) || value.surface || (theme === 'carbon' ? '#202222' : '#f4f4f4')}
          disabled={colourScope === 'cell' && !selectedRegion} getVersion={store.getGeneration}
          onChange={patch => run(() => save(colourValue(patch.color), 'Change color'))}
          onPreview={patch => setPreview(patch ? { generation, value: colourValue(patch.color) } : null)}
          onReset={() => run(() => save(colourValue(null), 'Reset color'))} resetLabel={colourScope === 'grid' ? 'Use theme background' : 'Use grid background'} />}
      </ReceptionPanel>}
      {libraryOpen && <ReceptionLibrary library={library} menuSurface={theme} onClose={cancelLibrary}
        store={store} value={value} expected={draft.reception} regionId={selected} boundsRef={workspaceHost} toolBoundsRef={editorHost} initialTop={toolTop}
        active={activeTool === 'library'} onActivate={() => setActiveTool('library')}
        preferences={editorPreferences.section('library')} framePreferences={editorPreferences.section('receptionFrames')} onPlacingChange={setLibraryPlacing}
        onPlaced={id => { setSelected(id); setCropping(true); setPanel('image'); setActiveTool('panel');
          restoreFocus(() => [...(workspaceHost.current?.querySelectorAll('[data-region-id]') || [])].find(node => node.dataset.regionId === id)?.querySelector('.reception-crop-target')); }} />}
  </main></ReceptionPresentation>;
}
