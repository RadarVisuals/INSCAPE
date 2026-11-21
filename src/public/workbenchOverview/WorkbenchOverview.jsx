import { lazy, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import IconSwitch from '../../ui/IconSwitch.jsx';
import CompositionStartLayout from '../../ui/CompositionStartLayout.jsx';
import { GallerySelectionTools, useGallerySelection } from './GallerySelection.jsx';
import { Ellipsis, GalleryHorizontalEnd, Image, Rows3, Grid2X2, Infinity as WrapIcon, SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import VisitorMenu from '../../profileDocument/components/VisitorMenu.jsx';
import OverviewNavigation from './OverviewNavigation.jsx';
import CompositionIndex from './CompositionIndex.jsx';
import { MAX_WORKBENCH_INTRODUCTION, MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import useDeferredFocusReturn from '../useDeferredFocusReturn.js';
import '../ownerSystemWorkflow/workflowTactile.css';
import '../ownerSystemWorkflow/workflowFlat.css';
import './workbenchOverview.css';
import CanvasJourney from './CanvasJourney.jsx';
import useGalleryLayoutJourney from './useGalleryLayoutJourney.js';
import { GalleryStudioMotion, useGalleryStudioDestination, useGalleryStudioEndpoint } from '../../profileDiscovery/galleryStudioMotion.js';
import { fitCanvasRegion } from './fitCanvasRegion.js';
import { captureOverviewCanvas, overviewCanvasNode } from './overviewCanvasFrame.js';

import GalleryWall from './GalleryWall.jsx';
import WorkbenchOverviewGrid from './WorkbenchOverviewGrid.jsx';
const CanvasPresentation = lazy(() => import('./CanvasPresentation.jsx'));
const ThumbnailCropForm = lazy(() => import('./ThumbnailCropForm.jsx'));

function DetailsForm({ selected, onSave, onCancel, creating }) {
  const [layout, setLayout] = useState('canvas');
  const [name, setName] = useState(creating ? '' : selected.name);
  const [introduction, setIntroduction] = useState(creating ? '' : selected.introduction);
  const [error, setError] = useState('');
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  return <form className="workbench-overview-form" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
  }} onSubmit={event => {
    event.preventDefault();
    try { onSave(creating ? { name: name.trim(), layout } : { name: name.trim(), introduction: introduction.trim() }); } catch (failure) { setError(failure.message); }
  }}>
    <h2>{creating ? 'New composition' : 'Edit details'}</h2>
    <label>Composition name<input ref={input} value={name} onChange={event => setName(event.target.value)} required maxLength={64} /></label>
    {creating && <CompositionStartLayout value={layout} onChange={setLayout} />}
    {!creating && <label>Introduction <span>optional</span><textarea value={introduction} onChange={event => setIntroduction(event.target.value)} maxLength={MAX_WORKBENCH_INTRODUCTION} rows={4} />
      <small>{introduction.length} / {MAX_WORKBENCH_INTRODUCTION}</small></label>}
    {error && <p role="alert">{error}</p>}
    <div className="workbench-overview-actions"><button className="workbench-overview-primary" type="submit">{creating ? 'Create composition' : 'Save details'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export default function WorkbenchOverview({ toolbarHost, items, selected, model, previews, view, onViewChange, profile, onSelect, onEdit, onCreate, onRequestNew, onManageWorks, onDeleteDraft, onRemoveFromGallery, collectionManager, onSave, onOpenReception, onEditReception,
  cardSize, onCardSize, onRename, onReorder, preferenceError, onRetryPreferences, workspace, visitorHeader, galleryAddress, cameraMemory }) {
  const selection = useGallerySelection(items, Boolean(onRemoveFromGallery));
  const [editing, setEditing] = useState(null), [error, setError] = useState('');
  const [arranging, setArranging] = useState(false);
  const [presentation, setPresentation] = useState(null);
  const [cropRatio, setCropRatio] = useState(1);
  const root = useRef(null), memory = workspace?.memory || cameraMemory;
  const editFrame = useRef(null);
  const routeMotion = useContext(GalleryStudioMotion);
  const capture = (item, node) => captureOverviewCanvas(node || overviewCanvasNode(root.current, item.id), item.model, item.name, item.id);
  const incoming = useGalleryStudioEndpoint('gallery', galleryAddress, id => {
    const item = previews.find(entry => entry.id === id);
    if (!item) return null;
    const tile = editFrame.current?.closest('[data-card-id]') || presentation?.origin;
    routeMotion.galleryMemory.current = { address: galleryAddress, memory,
      tileCycle: tile?.closest('[data-gallery-cycle]')?.dataset.galleryCycle };
    const surface = routeMotion.surface.current;
    return capture(item, surface?.dataset.canvasId === id ? surface : editFrame.current);
  }, root, CanvasJourney);
  const routeJourney = useMemo(() => incoming?.source.id === selected.id ? {
    ...incoming, source: { ...incoming.source, model: selected.model, name: selected.name,
      paint: incoming.source.fitPublished ? fitCanvasRegion(selected.model.area, selected.model.area, incoming.source.frame, 0) : incoming.source.paint },
  } : null, [incoming, selected]);
  const returnTile = useRef(null);
  useLayoutEffect(() => () => {
    returnTile.current?.removeAttribute('data-studio-return-tile');
    returnTile.current = null;
  }, [routeJourney]);
  useGalleryStudioDestination(incoming, routeJourney, root, () => {
    const cycle = routeMotion.galleryMemory.current?.tileCycle;
    const node = overviewCanvasNode(root.current, selected.id, cycle);
    const target = node && capture(selected, node);
    if (target && node.matches('[data-card-id]')) {
      returnTile.current?.removeAttribute('data-studio-return-tile');
      node.setAttribute('data-studio-return-tile', '');
      returnTile.current = node;
    }
    return target;
  });
  const movingCanvasId = workspace?.movingCanvasId || routeJourney?.source.id;
  const list = useRef(null), menuButton = useRef(null), returnFocus = useRef(null);
  const published = visitorHeader && !collectionManager;
  const viewportSize = view.viewportSize ?? 65;
  const wall = published && view.layout === 'wall';
  const grid = view.layout === 'grid';
  const layoutFlight = useGalleryLayoutJourney({ root, selected, model, layout: view.layout, onViewChange });
  const lastLayout = useRef(view.layout);
  useLayoutEffect(() => {
    const switched = lastLayout.current !== view.layout;
    lastLayout.current = view.layout;
    if (switched) (toolbarHost || root.current)?.querySelector('.gallery-layout-switch input:checked, button.gallery-layout-switch')?.focus({ preventScroll: true });
  }, [view.layout, toolbarHost]);
  const { restoreFocus } = useDeferredFocusReturn();
  const selectedButton = () => list.current?.querySelector('button[data-previewed="true"]');
  const returning = Boolean(workspace?.returning), entering = Boolean(workspace?.entering);
  useLayoutEffect(() => {
    if (!returning || entering) return;
    const target = root.current?.querySelector('.gallery-edit-work') || selectedButton();
    target?.focus({ preventScroll: true });
  }, [returning, entering]);
  useEffect(() => {
    if (workspace) return;
    const trigger = memory?.returnToDetails && root.current?.querySelector('.gallery-edit-work');
    if (memory) delete memory.returnToDetails;
    (trigger || selectedButton())?.focus({ preventScroll: true });
  }, [workspace, memory]);
  const run = action => { try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const closeForm = () => { setEditing(null); restoreFocus(() => {
    if (!grid && editing === 'details') return list.current?.closest('.composition-index')?.querySelector('.composition-explorer-secondary button');
    return returnFocus.current?.isConnected ? returnFocus.current : selectedButton();
  }); };
  const startNew = onRequestNew || (onCreate && (trigger => { returnFocus.current = trigger; setEditing('new'); }));
  const preview = id => { if (!editing && !presentation) { setError(''); onSelect(id); } };
  const manage = (id, kind, trigger) => {
    preview(id);
    const card = trigger?.closest('.workbench-overview-card'), bounds = card?.getBoundingClientRect();
    returnFocus.current = card?.querySelector('.workbench-overview-card-open') || trigger;
    if (kind === 'crop') setCropRatio(bounds ? bounds.width / bounds.height : 1);
    setEditing(kind);
  };
  const open = (id, trigger) => {
    const tile = trigger.closest('.workbench-overview-card');
    preview(id);
    if (published && !view.quickView) {
      const item = previews.find(entry => entry.id === id);
      if (memory) memory.expanded = false;
      layoutFlight.switchView({ ...view, layout: 'list' }, item, tile);
    } else {
      setPresentation({ origin: tile, trigger });
    }
  };
  const closePresentation = () => {
    const trigger = presentation?.trigger;
    setPresentation(null);
    restoreFocus(() => trigger?.isConnected && !trigger.closest('[aria-hidden="true"]') ? trigger : selectedButton());
  };
  const edit = (id, node, action) => run(() => {
    const item = previews.find(item => item.id === id);
    if (memory && node && document.activeElement?.classList.contains('gallery-edit-work')) memory.returnToDetails = true;
    editFrame.current = node;
    try { onEdit(id, workspace && item ? capture(item, node) : undefined, action); }
    finally { editFrame.current = null; }
    // A Gallery route change will unmount the dialog. Keep the clicked artwork
    // visible while the browser captures it and Studio prepares its first frame.
    if (!galleryAddress) setPresentation(null);
  });
  useLayoutEffect(() => {
    if (!memory || grid || wall) return;
    const node = root.current;
    node.scrollTop = memory.scroll?.list || 0;
    return () => { memory.scroll = { ...memory.scroll, list: node.scrollTop }; };
  }, [grid, wall, memory]);
  const settings = editing === 'crop' ? <Suspense fallback={<p role="status">Opening crop controls…</p>}><ThumbnailCropForm key={selected.id} selected={selected} model={model} ratio={cropRatio}
    onCancel={closeForm} onSave={thumbnailCrop => { onSave({ name: selected.name, introduction: selected.introduction, thumbnailCrop }); closeForm(); }} /></Suspense>
    : editing ? <DetailsForm key={`${selected.id}:${editing}`} creating={editing === 'new'} selected={selected} onCancel={closeForm}
      onSave={details => { if (editing === 'new') onCreate(details.name, details.layout); else { onSave(details); closeForm(); } }} /> : null;
  const actionsTrigger = useRef(null);
  const navigation = grid && !published && <OverviewNavigation showLayouts={!visitorHeader} label={collectionManager ? 'View options' : 'Gallery options'} disabled={Boolean(editing)} view={view} onViewChange={next => { setError(''); onViewChange(next); }} count={items.length} triggerRef={menuButton}
      arranging={arranging} onArrange={onReorder ? () => setArranging(!arranging) : undefined} cardSize={cardSize} onCardSize={onCardSize} selecting={selection.active}
      onCreate={!visitorHeader && startNew ? () => startNew(menuButton.current) : undefined} limited={!onRequestNew} />;
  const layoutSwitch = visitorHeader && <IconSwitch className="gallery-layout-switch" disabled={Boolean(editing || arranging)} label="Grid view" checked={grid} offIcon={List} onIcon={LayoutGrid}
        title={grid ? 'Switch to List' : layoutFlight.fromTile ? 'Back to Tiles' : 'Switch to Grid'}
        onChange={next => layoutFlight.switchView({ ...view, layout: next ? 'grid' : 'list' })} />;
  const galleryControls = visitorHeader && <div className="gallery-index-controls" inert={editing || arranging ? '' : undefined}>
    {!selection.active && (startNew || onManageWorks || onRemoveFromGallery) &&
      <VisitorMenu name={collectionManager ? 'Composition actions' : 'Gallery actions'} trigger={published ? <Image /> : <Ellipsis size={16} />} buttonRef={actionsTrigger}>
        {startNew && <button type="button" disabled={!onRequestNew && items.length >= MAX_WORKBENCHES} onClick={() => startNew(actionsTrigger.current)}>New composition</button>}
        {onManageWorks && <button type="button" onClick={onManageWorks}>Manage works</button>}
        {onRemoveFromGallery && <button type="button" onClick={selection.start}>Select works…</button>}
      </VisitorMenu>}
  </div>;
  const publishedToolbar = published && toolbarHost && createPortal(
    <div className="gallery-header-toolbar" role="group" aria-label="Gallery controls" inert={presentation ? '' : undefined}>
      {galleryControls}
      <div className="gallery-layout-switch" role="radiogroup" aria-label="Gallery layout">
        {[['wall', GalleryHorizontalEnd, 'Wall view'], ['list', Rows3, 'List view'], ['grid', Grid2X2, 'Grid view']].map(([layout, Icon, label]) =>
          <label key={layout} title={label}>
            <input type="radio" name="published-gallery-layout" aria-label={label} checked={layoutFlight.requestedLayout === layout}
              onChange={() => wall || layout === 'wall' ? onViewChange({ ...view, layout }) : layoutFlight.switchView({ ...view, layout })} />
            <Icon aria-hidden="true" />
          </label>)}
      </div>
      {!wall && <><button type="button" aria-label="Wrap around" title="Horizontal wraparound" disabled={!grid || selection.active || items.length < 2}
        aria-pressed={grid && view.wrap && !selection.active && items.length > 1} onClick={() => onViewChange({ ...view, wrap: !view.wrap })}><WrapIcon /></button>
      <button type="button" aria-label="Quick view" title="Open tiles in quick view" disabled={!grid || selection.active}
        aria-pressed={grid && !selection.active && view.quickView} onClick={() => onViewChange({ ...view, quickView: !view.quickView })}><GalleryHorizontalEnd /></button>
      <VisitorMenu name="Gallery options" trigger={<SlidersHorizontal />}>
        <label>{grid ? 'Tile size' : 'Viewport size'}<input type="range" min={grid ? 1 : 0} max={grid ? 3 : 100} step="1" value={grid ? cardSize : viewportSize}
          onChange={event => {
            const size = Number(event.target.value);
            if (grid) onCardSize(size);
            else onViewChange({ ...view, viewportSize: size });
          }} /></label>
      </VisitorMenu></>}
    </div>, toolbarHost);
  return <div ref={root} data-published-gallery={published || undefined} style={published ? { '--gallery-width-fraction': 0.55 + viewportSize * 0.0045, '--gallery-height-fill': Math.max(0, (viewportSize - 65) / 35) } : undefined} className="workbench-overview system-workflow__token-scope" data-workflow-material="tactile" data-workflow-finish="flat"
     data-layout={view.layout} data-layout-journey={layoutFlight.journey?.direction} data-visitor-header={visitorHeader || undefined} data-selecting={selection.active || undefined}>
    {selection.active && !presentation && <GallerySelectionTools selection={selection} onRemove={onRemoveFromGallery} returnFocus={actionsTrigger} />}
    {publishedToolbar}
    {visitorHeader && !published && <div className="gallery-layout-toolbar" inert={presentation ? '' : undefined}>{galleryControls}{navigation}
      {layoutSwitch}
    </div>}
    {wall ? <GalleryWall items={previews} selected={selected} selection={selection} memory={memory} onSelect={preview} onEdit={onEdit ? edit : undefined} /> : grid ? <div className="workbench-overview-browse" inert={presentation ? '' : undefined}>
    {!visitorHeader && navigation}
    <section className="workbench-overview-main">
      <div className="workbench-overview-grid-host" inert={editing ? '' : undefined}>
        <WorkbenchOverviewGrid horizontalWrap={published} items={previews} selectedId={selected.id} wrap={view.wrap} hostRef={list} movingCanvasId={workspace?.movingCanvasId}
          cardSize={cardSize} arranging={arranging} onFinishArrange={() => { setArranging(false); restoreFocus(() => menuButton.current); }} onReorder={ids => run(() => onReorder(ids))}
          memory={memory} selection={selection.active ? selection : null} onOpen={open} onEdit={onEdit ? edit : undefined} onManage={onSave ? manage : undefined} />
      </div>
      <div className="workbench-overview-content">
        <header className="workbench-overview-heading"><h1>{collectionManager ? 'Works' : 'Gallery'}</h1>
          <div><p>{onEdit ? 'Your compositions, all in one place.' : 'Published compositions.'}</p><span>{items.length} {items.length === 1 ? 'composition' : 'compositions'}</span></div>
        </header>
        {editing && <section className="workbench-overview-detail" aria-label="Canvas settings">{settings}</section>}
      </div>
    </section>
    </div> : <CompositionIndex onDeleteDraft={onDeleteDraft} onRename={onRename} onReorder={onReorder} items={items} selected={selected} model={model} profile={profile} listRef={list} settings={settings} disabled={Boolean(editing)}
      memory={memory} visitorHeader={visitorHeader} movingCanvasId={movingCanvasId}
      onSelect={preview} selection={selection.active ? selection : null} onEdit={onEdit ? edit : undefined} onOpenReception={onOpenReception} onEditReception={onEditReception}
      onGrid={() => onViewChange({ ...view, layout: 'grid' })}
      onDetails={onSave ? event => manage(selected.id, 'details', event.currentTarget) : undefined}
      />}
    {layoutFlight.journey && <div className="gallery-layout-flight" style={{ clipPath: `inset(${layoutFlight.journey.clipTop}px 0 0)` }}><CanvasJourney key={layoutFlight.journey.direction} journey={layoutFlight.journey}
      duration={340} hostRef={root} surface={layoutFlight.surface} resolveTarget={layoutFlight.resolveTarget} onComplete={layoutFlight.finish} /></div>}
    {error && <p role="alert" className="workbench-overview-error">{error}</p>}
    {preferenceError && <p role="alert" className="workbench-overview-error">{preferenceError} <button type="button" onClick={onRetryPreferences}>Retry saving</button></p>}
    {presentation && <Suspense fallback={<p role="status">Opening canvas…</p>}><CanvasPresentation key={selected.id} selected={selected} model={model}
      collection={published ? previews : undefined} wrap={view.wrap} publishedWorks={visitorHeader} origin={presentation.origin} onClose={closePresentation} onEdit={onEdit ? edit : undefined} /></Suspense>}
  </div>;
}
